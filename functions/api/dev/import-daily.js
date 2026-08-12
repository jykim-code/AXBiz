// POST /api/dev/import-daily  (관리자 PIN)
//   { url } → 컨플 "AX 플랫폼 주요 경쟁사 사업동향 [YYMMDD]" 데일리 페이지의
//   📰 섹션 A(상위 보고용)를 LLM으로 기업별 구조화 → draft_entries(source='daily') 적재.
//   라이브 reports 무변경. 같은 (date,company,'daily') draft는 갱신.
import { pinOk, forbidden } from '../../_auth.js';
import { fetchPage, decode, CATEGORIES } from '../../_confluence.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// XHTML → 줄바꿈 보존 텍스트 (링크는 "텍스트 (URL)" 로 보존 → LLM이 출처 URL 추출 가능)
function toText(html) {
  let s = String(html || '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => t.replace(/<[^>]+>/g, '') + ' (' + h + ')')
    .replace(/<\/(p|li|tr|h[1-6]|div|td|th)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decode(s);
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// 섹션 A(상위 보고용)만 슬라이스. 마커 못 찾으면 전체(상한)로 폴백.
function sliceSectionA(text) {
  const a = text.search(/섹션\s*A/);
  const b = text.search(/섹션\s*B/);
  if (a >= 0 && b > a) return text.slice(a, b);
  if (a >= 0) return text.slice(a, a + 12000);
  return text.slice(0, 12000);
}

// 조사 기준일: 본문 "조사 기준일: YYYY-MM-DD" → 제목 [YYMMDD] 폴백
function findDate(text, title) {
  let m = String(text).match(/조사\s*기준일[^0-9]{0,10}(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  m = String(title).match(/\[(\d{2})(\d{2})(\d{2})\]/);
  if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const SYSTEM = `당신은 "AX Biz Radar"의 데이터 추출기입니다.
컨플루언스 데일리 모니터링 보고서의 "섹션 A(상위 보고용)" 텍스트에서 기업별 동향을 JSON 배열로 추출하세요.
각 항목 형식: {"name":"기업명","category":"대기업|중견기업|스타트업·중소","keyPoints":["..."],"implications":["..."],"hancomInsight":["..."],"sourceUrl":"http...","tags":["..."]}
규칙:
- name: 모니터링 대상 기업명으로 정규화. 그룹 차원 보도에 대상 기업이 병기되면 그 기업명 사용(예: "현대차그룹(현대오토에버)" → "현대오토에버"). 알려진 대상 목록을 우선 사용.
- keyPoints: "◆ 주요 내용" 불릿들을 각각 간결한 1문장으로. implications: "◆ 시사점". hancomInsight: "◆ 한컴 관점에서의 의미"/"한컴 인사이트" 불릿들.
- sourceUrl: "◆ 출처"의 첫 번째 URL 하나만.
- tags: 해시태그·본문에서 핵심 태그 4~8개(# 제거, 1~3어절).
- 섹션 A에 명시된 기업 항목만 추출(참고 동향·당일 신규 없음은 제외). 내용 창작 금지.
- 출력은 JSON 배열만(다른 텍스트 금지). 항목이 없으면 [].`;

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) return Response.json({ error: 'LLM_NOT_CONFIGURED' }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const page = await fetchPage(env, body?.url);
  if (!page.ok) return Response.json({ error: page.error, ...(page.hint ? { hint: page.hint } : {}) }, { status: page.status || 400 });

  const text = toText(page.html);
  const date = findDate(text, page.title);
  if (!date) return Response.json({ error: 'NO_DATE', hint: '조사 기준일(YYYY-MM-DD) 또는 제목 [YYMMDD]를 찾지 못했습니다' }, { status: 422 });
  const sectionA = sliceSectionA(text);

  // 알려진 기업명 힌트 (name 정규화용)
  let known = [];
  try {
    const r = await env.DB.prepare('SELECT DISTINCT company FROM company_entries LIMIT 100').all();
    known = (r.results || []).map((x) => x.company);
  } catch { /* 힌트 없이 진행 */ }

  // LLM 추출
  let raw;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ax-biz-radar.pages.dev', 'X-Title': 'AX Biz Radar' },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        temperature: 0.2,
        max_tokens: 3000, // 추론·응답 토큰 여유(모델 무관)
        reasoning: { enabled: false }, // qwen 등 추론모델: 추론이 응답 예산을 잡아먹어 빈 출력(NO_ITEMS) → 추론 비활성
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `알려진 대상 기업: ${known.join(', ') || '(없음)'}\n날짜: ${date}\n\n${sectionA.slice(0, 14000)}` },
        ],
      }),
    });
    if (!res.ok) { console.error('/api/dev/import-daily openrouter', res.status); return Response.json({ error: 'LLM_FAILED' }, { status: 502 }); }
    const data = await res.json();
    raw = data?.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('/api/dev/import-daily fetch', err);
    return Response.json({ error: 'LLM_FAILED' }, { status: 502 });
  }

  // JSON 배열 파싱(코드블록/잡텍스트 방어)
  let items = [];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(m ? m[0] : raw);
    if (Array.isArray(parsed)) items = parsed;
  } catch { /* 빈 목록 */ }
  if (!items.length) return Response.json({ error: 'NO_ITEMS', hint: '섹션 A에서 기업 항목을 추출하지 못했습니다', rawHead: raw.slice(0, 200) }, { status: 422 });

  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 50) : []);
  let upserted = 0;
  const companies = [];
  for (const it of items.slice(0, 30)) {
    const name = String(it?.name || '').trim().slice(0, 200);
    if (!name) continue;
    const category = CATEGORIES.includes(it?.category) ? it.category : '대기업';
    const data = JSON.stringify({
      name, category, summary: '',
      sourceUrl: String(it?.sourceUrl || '').trim().slice(0, 1000),
      confluenceUrl: page.confUrl,
      keyPoints: arr(it?.keyPoints), implications: arr(it?.implications), hancomInsight: arr(it?.hancomInsight),
      tags: arr(it?.tags).map((t) => t.replace(/^#/, '')).slice(0, 10),
    });
    try {
      // 같은 데일리 페이지 재추출은 갱신, 다른 페이지의 같은 (날짜,기업)은 별개 동향으로 공존.
      await env.DB.prepare("DELETE FROM draft_entries WHERE date = ? AND company = ? AND source = 'daily' AND source_ref = ? AND status = 'draft'").bind(date, name, String(page.pageId)).run();
      await env.DB.prepare(
        `INSERT INTO draft_entries (date, company, category, data, source, source_ref, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'daily', ?, 'draft', datetime('now'), datetime('now'))`
      ).bind(date, name, category, data, String(page.pageId)).run();
      upserted++;
      companies.push(name);
    } catch (err) { console.error('dev/import-daily upsert', name, err); }
  }

  return Response.json({ ok: true, date, count: upserted, companies, pageTitle: page.title });
}
