// /api/import-confluence  (관리자 PIN)
//   POST { url, dryRun?, nameOverride?, categoryOverride? }
//   컨플 "AX 동향 히스토리 - {기업}" 페이지를 읽어 타임라인 표를 reports 로 병합 업서트.
//   - dryRun: 파싱 미리보기만 반환(저장 안 함)
//   - 실행: 날짜별 병합(같은 기업 항목은 컨플로 교체) → RAG 재색인 → AI 요약 백그라운드 재생성
//   시크릿: CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN (Atlassian API 토큰)
import { reindexDate } from '../_rag.js';
import { generateAndStore } from '../_summary.js';

const CONF_BASE = 'https://hancom.atlassian.net/wiki';
// 컨플 영문 표기 → 서비스 한글 표기 통일 (기존 데이터·DART 매핑 유지)
const NAME_MAP = { Naver: '네이버', Upstage: '업스테이지', 'SK Telecom': 'SK텔레콤', ESTsoft: '이스트소프트', Microsoft: '마이크로소프트' };
const CATEGORIES = ['대기업', '중견기업', '스타트업·중소'];

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/gi, ' ');
const stripTags = (s) => decode(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
function normDate(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  return m ? `${m[1]}-${m[2]}-${m[3] || '01'}` : null;
}

// URL → pageId: /pages/<id>/ · /wiki/x/<code>(리다이렉트 해석) · 숫자 ID
async function resolvePageId(url, auth) {
  const s = String(url || '').trim();
  if (/^\d{6,}$/.test(s)) return s;
  let m = s.match(/\/pages\/(\d+)/);
  if (m) return m[1];
  m = s.match(/\/wiki\/x\/([A-Za-z0-9_-]+)/);
  if (m) {
    // 리다이렉트를 따라가 최종 URL 에서 pageId 추출 (manual+Location 방식은 환경에 따라 미동작)
    try {
      const r = await fetch(`${CONF_BASE}/x/${m[1]}`, { headers: { Authorization: auth } });
      const m2 = String(r.url || '').match(/\/pages\/(\d+)/);
      if (m2) return m2[1];
    } catch { /* 아래 null */ }
  }
  return null;
}

// storage XHTML 의 첫 표 → 행 파싱 (열: 날짜|유형|주요내용|시사점|한컴인사이트|출처|태그)
function parseTable(html) {
  const tm = String(html || '').match(/<table[\s\S]*?<\/table>/i);
  if (!tm) return [];
  const rows = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trRe.exec(tm[0])) !== null) {
    const tr = m[0];
    if (/<th[\s>]/i.test(tr)) continue; // 헤더 행
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let c;
    while ((c = tdRe.exec(tr)) !== null) cells.push(c[1]);
    if (cells.length < 7) continue;
    const date = normDate(stripTags(cells[0]));
    if (!date) continue;
    const hrefM = cells[5].match(/href="([^"]+)"/i);
    rows.push({
      date,
      keyPoint: stripTags(cells[2]),
      implication: stripTags(cells[3]),
      insight: stripTags(cells[4]),
      sourceUrl: hrefM ? decode(hrefM[1]) : '',
      // 유형(cells[1])은 태그로 변환하지 않음(관리자 정책)
      tags: stripTags(cells[6]).split(',').map((t) => t.trim()).filter(Boolean),
    });
  }
  return rows;
}

export async function onRequestPost({ request, env, waitUntil }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!env.CONFLUENCE_EMAIL || !env.CONFLUENCE_API_TOKEN) {
    return Response.json({ error: 'NOT_CONFIGURED', hint: 'CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN 시크릿 필요' }, { status: 503 });
  }
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const auth = 'Basic ' + btoa(`${env.CONFLUENCE_EMAIL}:${env.CONFLUENCE_API_TOKEN}`);
  const pageId = await resolvePageId(body?.url, auth);
  if (!pageId) return Response.json({ error: 'INVALID_URL', hint: '컨플 페이지 URL(/pages/<id>) 또는 /wiki/x/ 단축링크를 입력하세요' }, { status: 400 });

  // 페이지 본문(storage) 조회
  let page;
  try {
    const r = await fetch(`${CONF_BASE}/rest/api/content/${pageId}?expand=body.storage`, { headers: { Authorization: auth, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) return Response.json({ error: 'CONFLUENCE_AUTH', hint: 'API 토큰/권한을 확인하세요' }, { status: 502 });
    if (r.status === 404) return Response.json({ error: 'PAGE_NOT_FOUND' }, { status: 404 });
    if (!r.ok) return Response.json({ error: 'CONFLUENCE_ERROR', status: r.status }, { status: 502 });
    page = await r.json();
  } catch (err) {
    console.error('import-confluence: fetch', err);
    return Response.json({ error: 'CONFLUENCE_FETCH_FAILED' }, { status: 502 });
  }

  const title = page?.title || '';
  const html = page?.body?.storage?.value || '';
  const text = stripTags(html);

  // 기업명: "AX 동향 히스토리 - {기업} (2026)" → {기업} (영문은 한글 매핑)
  let name = (title.match(/-\s*(.+?)\s*\(/) || [])[1] || title;
  name = NAME_MAP[name] || name;
  if (body?.nameOverride) name = String(body.nameOverride).trim().slice(0, 200);

  // 분류: 본문 "분류: 국내 대기업 (Tier 2)" → 서비스 카테고리 (해외→대기업)
  let category = '대기업';
  const catM = text.match(/분류[^:：]{0,10}[:：]\s*([^|]{0,30})/);
  const catS = catM ? catM[1] : '';
  if (/중견/.test(catS)) category = '중견기업';
  else if (/스타트업|중소/.test(catS)) category = '스타트업·중소';
  if (body?.categoryOverride && CATEGORIES.includes(body.categoryOverride)) category = body.categoryOverride;

  const rows = parseTable(html);
  if (!rows.length) return Response.json({ error: 'NO_TABLE_ROWS', hint: '타임라인 표(날짜|유형|주요 내용|시사점|한컴 인사이트|출처|태그)를 찾지 못했습니다' }, { status: 422 });

  const confUrl = `${CONF_BASE}/spaces/${page?.space?.key || ''}/pages/${pageId}`;
  const preview = {
    name, category, pageTitle: title, count: rows.length,
    dates: rows.map((r) => r.date),
    sample: { date: rows[0].date, keyPoint: rows[0].keyPoint.slice(0, 120), tags: rows[0].tags },
  };
  if (body?.dryRun) return Response.json({ ok: true, dryRun: true, ...preview });

  // ===== 실행: 날짜별 병합 업서트 + 재색인 =====
  const byDate = {};
  for (const r of rows) {
    (byDate[r.date] = byDate[r.date] || []).push({
      name, category,
      sourceUrl: r.sourceUrl, confluenceUrl: confUrl,
      keyPoints: [r.keyPoint], implications: r.implication ? [r.implication] : [], hancomInsight: r.insight ? [r.insight] : [],
      tags: r.tags,
    });
  }
  const dates = Object.keys(byDate).sort();
  const saved = [];
  for (const d of dates) {
    try {
      const row = await env.DB.prepare('SELECT companies FROM reports WHERE date = ?').bind(d).first();
      let existing = [];
      if (row) { try { existing = JSON.parse(row.companies || '[]'); } catch { existing = []; } }
      if (!Array.isArray(existing)) existing = [];
      const oldCount = existing.length;
      const companies = existing.filter((c) => c && c.name !== name).concat(byDate[d]); // 컨플=진실원
      await env.DB
        .prepare(`INSERT INTO reports (date, companies, updated_at) VALUES (?, ?, datetime('now'))
                  ON CONFLICT(date) DO UPDATE SET companies = excluded.companies, updated_at = datetime('now')`)
        .bind(d, JSON.stringify(companies)).run();
      if (env.AI && env.VECTORIZE) {
        try { await reindexDate(env, d, oldCount, companies); } catch (err) { console.error('import: reindex', d, err); }
      }
      saved.push(d);
    } catch (err) {
      console.error('import: save', d, err);
    }
  }

  // AI 요약 백그라운드 재생성
  if (typeof waitUntil === 'function') waitUntil(generateAndStore(env, name));

  return Response.json({ ok: true, name, category, count: rows.length, savedDates: saved, failedDates: dates.filter((d) => !saved.includes(d)) });
}
