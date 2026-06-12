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

// 한 행의 셀 추출 (header=true 면 <th>, 아니면 <td>)
function cellsOf(tr, header) {
  const re = header ? /<th[^>]*>([\s\S]*?)<\/th>/gi : /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const out = []; let m;
  while ((m = re.exec(tr)) !== null) out.push(m[1]);
  return out;
}
// 헤더 텍스트 → 열 인덱스 매핑. 못 읽으면 null(위치기반 폴백).
function mapHeader(headerCells) {
  const t = headerCells.map((c) => stripTags(c));
  const find = (...keys) => t.findIndex((h) => keys.some((k) => h.includes(k)));
  const date = find('날짜'), key = find('주요'), impl = find('시사'), insight = find('한컴', '인사이트'), source = find('출처'), tags = find('태그');
  if (date < 0 || key < 0) return null;
  return { date, key, impl, insight, source, tags };
}
// 헤더 없을 때 열 수로 추정. 7열=날짜|유형|주요|시사점|한컴|출처|태그 / 6열=날짜|주요|시사점|한컴|출처|태그
function positionalIndex(n) {
  return n >= 7 ? { date: 0, key: 2, impl: 3, insight: 4, source: 5, tags: 6 }
                : { date: 0, key: 1, impl: 2, insight: 3, source: 4, tags: 5 };
}
const cell = (cells, i) => (i != null && i >= 0 ? (cells[i] || '') : '');

// storage XHTML 첫 표 → 행 파싱. 헤더 기반 열 매핑으로 6열·7열(유형 유무) 모두 처리.
export function parseTable(html) {
  const tm = String(html || '').match(/<table[\s\S]*?<\/table>/i);
  if (!tm) return [];
  const trs = tm[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
  if (!trs.length) return [];

  // 헤더(첫 <th> 포함 행) → 인덱스 매핑
  let idx = null;
  for (const tr of trs) {
    if (/<th[\s>]/i.test(tr)) { idx = mapHeader(cellsOf(tr, true)); break; }
  }

  const rows = [];
  for (const tr of trs) {
    if (/<th[\s>]/i.test(tr)) continue; // 헤더 행 스킵
    const cells = cellsOf(tr, false);
    if (cells.length < 5) continue;
    const col = idx || positionalIndex(cells.length);
    const date = normDate(stripTags(cell(cells, col.date)));
    if (!date) continue;
    const hrefM = String(cell(cells, col.source)).match(/href="([^"]+)"/i);
    rows.push({
      date,
      keyPoint: stripTags(cell(cells, col.key)),
      implication: stripTags(cell(cells, col.impl)),
      insight: stripTags(cell(cells, col.insight)),
      sourceUrl: hrefM ? decode(hrefM[1]) : '',
      tags: stripTags(cell(cells, col.tags)).split(',').map((t) => t.trim()).filter(Boolean),
    });
  }
  return rows;
}

// 페이지 조회 공용: URL → { ok, pageId, title, html, confUrl } | { ok:false, error, status, hint }
export async function fetchPage(env, url) {
  if (!env.CONFLUENCE_EMAIL || !env.CONFLUENCE_API_TOKEN) {
    return { ok: false, status: 503, error: 'NOT_CONFIGURED', hint: 'CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN 시크릿 필요' };
  }
  const auth = 'Basic ' + btoa(`${env.CONFLUENCE_EMAIL}:${env.CONFLUENCE_API_TOKEN}`);
  const pageId = await resolvePageId(url, auth);
  if (!pageId) return { ok: false, status: 400, error: 'INVALID_URL', hint: '컨플 페이지 URL(/pages/<id>) 또는 /wiki/x/ 단축링크를 입력하세요' };

  let page;
  try {
    const r = await fetch(`${CONF_BASE}/rest/api/content/${pageId}?expand=body.storage,space`, { headers: { Authorization: auth, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) return { ok: false, status: 502, error: 'CONFLUENCE_AUTH', hint: 'API 토큰/권한을 확인하세요' };
    if (r.status === 404) return { ok: false, status: 404, error: 'PAGE_NOT_FOUND' };
    if (!r.ok) return { ok: false, status: 502, error: 'CONFLUENCE_ERROR' };
    page = await r.json();
  } catch (err) {
    console.error('fetchPage: fetch', err);
    return { ok: false, status: 502, error: 'CONFLUENCE_FETCH_FAILED' };
  }
  return {
    ok: true,
    pageId,
    title: page?.title || '',
    html: page?.body?.storage?.value || '',
    confUrl: `${CONF_BASE}/spaces/${page?.space?.key || ''}/pages/${pageId}`,
  };
}

// 고수준(히스토리): URL → 페이지 조회·표 파싱 → { ok, name, category, pageId, confUrl, title, rows } | { ok:false, ... }
export async function parseConfluencePage(env, opts) {
  const res = await fetchPage(env, opts?.url);
  if (!res.ok) return res;
  const { pageId, title, html, confUrl } = res;
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
