// 컨플루언스 파싱 공용 모듈 — import-confluence·dev/import 공용.
// "AX 동향 히스토리 - {기업}" 페이지의 타임라인 표를 행으로 파싱.
export const CONF_BASE = 'https://hancom.atlassian.net/wiki';
// 컨플 영문 표기 → 서비스 한글 표기 통일
export const NAME_MAP = { Naver: '네이버', Upstage: '업스테이지', 'SK Telecom': 'SK텔레콤', ESTsoft: '이스트소프트', Microsoft: '마이크로소프트' };
export const CATEGORIES = ['대기업', '중견기업', '스타트업·중소'];

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', times: '×', rarr: '→', larr: '←', uarr: '↑', darr: '↓' };
export const decode = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return _; } })
  .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
export const stripTags = (s) => decode(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
export function normDate(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  return m ? `${m[1]}-${m[2]}-${m[3] || '01'}` : null;
}

// URL → pageId: /pages/<id>/ · /wiki/x/<code>(리다이렉트 해석) · 숫자 ID
export async function resolvePageId(url, auth) {
  const s = String(url || '').trim();
  if (/^\d{6,}$/.test(s)) return s;
  let m = s.match(/\/pages\/(\d+)/);
  if (m) return m[1];
  m = s.match(/\/wiki\/x\/([A-Za-z0-9_-]+)/);
  if (m) {
    try {
      const r = await fetch(`${CONF_BASE}/x/${m[1]}`, { headers: { Authorization: auth } });
      const m2 = String(r.url || '').match(/\/pages\/(\d+)/);
      if (m2) return m2[1];
    } catch { /* 아래 null */ }
  }
  return null;
}

// storage XHTML 첫 표 → 행 파싱 (열: 날짜|유형|주요내용|시사점|한컴인사이트|출처|태그)
export function parseTable(html) {
  const tm = String(html || '').match(/<table[\s\S]*?<\/table>/i);
  if (!tm) return [];
  const rows = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trRe.exec(tm[0])) !== null) {
    const tr = m[0];
    if (/<th[\s>]/i.test(tr)) continue;
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
      tags: stripTags(cells[6]).split(',').map((t) => t.trim()).filter(Boolean),
    });
  }
  return rows;
}

// 고수준: URL → 페이지 조회·파싱 → { ok, name, category, pageId, confUrl, title, rows } | { ok:false, error, status, hint }
export async function parseConfluencePage(env, opts) {
  if (!env.CONFLUENCE_EMAIL || !env.CONFLUENCE_API_TOKEN) {
    return { ok: false, status: 503, error: 'NOT_CONFIGURED', hint: 'CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN 시크릿 필요' };
  }
  const auth = 'Basic ' + btoa(`${env.CONFLUENCE_EMAIL}:${env.CONFLUENCE_API_TOKEN}`);
  const pageId = await resolvePageId(opts?.url, auth);
  if (!pageId) return { ok: false, status: 400, error: 'INVALID_URL', hint: '컨플 페이지 URL(/pages/<id>) 또는 /wiki/x/ 단축링크를 입력하세요' };

  let page;
  try {
    const r = await fetch(`${CONF_BASE}/rest/api/content/${pageId}?expand=body.storage,space`, { headers: { Authorization: auth, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) return { ok: false, status: 502, error: 'CONFLUENCE_AUTH', hint: 'API 토큰/권한을 확인하세요' };
    if (r.status === 404) return { ok: false, status: 404, error: 'PAGE_NOT_FOUND' };
    if (!r.ok) return { ok: false, status: 502, error: 'CONFLUENCE_ERROR' };
    page = await r.json();
  } catch (err) {
    console.error('parseConfluencePage: fetch', err);
    return { ok: false, status: 502, error: 'CONFLUENCE_FETCH_FAILED' };
  }

  const title = page?.title || '';
  const html = page?.body?.storage?.value || '';
  const text = stripTags(html);

  let name = (title.match(/-\s*(.+?)\s*\(/) || [])[1] || title;
  name = NAME_MAP[name] || name;
  if (opts?.nameOverride) name = String(opts.nameOverride).trim().slice(0, 200);

  let category = '대기업';
  const catM = text.match(/분류[^:：]{0,10}[:：]\s*([^|]{0,30})/);
  const catS = catM ? catM[1] : '';
  if (/중견/.test(catS)) category = '중견기업';
  else if (/스타트업|중소/.test(catS)) category = '스타트업·중소';
  if (opts?.categoryOverride && CATEGORIES.includes(opts.categoryOverride)) category = opts.categoryOverride;

  const rows = parseTable(html);
  if (!rows.length) return { ok: false, status: 422, error: 'NO_TABLE_ROWS', hint: '타임라인 표(날짜|유형|주요 내용|시사점|한컴 인사이트|출처|태그)를 찾지 못했습니다' };

  const confUrl = `${CONF_BASE}/spaces/${page?.space?.key || ''}/pages/${pageId}`;
  return { ok: true, name, category, pageId, confUrl, title, rows };
}

// 파싱 행(rows) → reports companies 항목(기업별). 한 기업의 날짜별 항목 배열.
export function rowsToEntries(name, category, confUrl, rows) {
  return rows.map((r) => ({
    name, category,
    sourceUrl: r.sourceUrl, confluenceUrl: confUrl,
    keyPoints: [r.keyPoint],
    implications: r.implication ? [r.implication] : [],
    hancomInsight: r.insight ? [r.insight] : [],
    tags: r.tags,
  }));
}
