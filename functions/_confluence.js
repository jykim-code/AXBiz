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

// Basic 인증 헤더. 대시보드에 붙여넣을 때 섞여 들어오는 앞뒤 공백·개행을 제거하고
// (공백 하나로도 401), 비ASCII가 있어도 btoa 가 던지지 않게 UTF-8 바이트로 인코딩한다.
export function basicAuth(email, token) {
  const bytes = new TextEncoder().encode(`${String(email).trim()}:${String(token).trim()}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'Basic ' + btoa(bin);
}

// URL → pageId: /pages/<id>/ · /wiki/x/<code>(리다이렉트 해석) · 숫자 ID
// 단축링크 해석 중 인증이 막히면 { authError: 401|403 } — URL 형식 오류로 오진하지 않도록.
export async function resolvePageId(url, auth) {
  const s = String(url || '').trim();
  if (/^\d{6,}$/.test(s)) return s;
  let m = s.match(/\/pages\/(\d+)/);
  if (m) return m[1];
  m = s.match(/\/wiki\/x\/([A-Za-z0-9_-]+)/);
  if (m) {
    try {
      const r = await fetch(`${CONF_BASE}/x/${m[1]}`, { headers: { Authorization: auth } });
      if (r.status === 401 || r.status === 403) return { authError: r.status };
      const m2 = String(r.url || '').match(/\/pages\/(\d+)/);
      if (m2) return m2[1];
    } catch { /* 아래 null */ }
  }
  return null;
}

// 401/403 → 어느 쪽을 손봐야 하는지 알려주는 응답. 401=자격증명, 403=호출 권한.
// Atlassian 이 본문에 실어주는 message 를 반드시 함께 보여준다. 이걸 버리면
// "스코프 토큰이라 거부" 와 "스페이스 권한 없음" 을 구분할 수 없다.
function authFailure(status, detail) {
  const raw = String(detail || '');
  console.error('confluence: auth', status, raw.slice(0, 300));

  let msg = '';
  try {
    const j = JSON.parse(raw);
    msg = String(j?.message || j?.errors?.[0]?.title || '');
  } catch { msg = raw.replace(/<[^>]+>/g, ' '); }
  msg = msg.replace(/\s+/g, ' ').trim().slice(0, 200);

  // "not permitted to use Confluence" / "cannot access Confluence"
  //  → 인증 자체는 통과했고 호출 권한만 거부됨. 실제로 가장 흔한 원인은
  //    CONFLUENCE_EMAIL 이 토큰 발급 계정과 다른 것(계정 불일치)이다.
  const cannotUse = /not permitted to use confluence|cannot access confluence/i.test(raw);

  let hint;
  if (status === 401) {
    hint = 'Confluence 인증 실패(401) — 토큰이 만료·오타이거나 계정 이메일이 다릅니다. API 토큰을 새로 발급해 CONFLUENCE_API_TOKEN 을 갱신하세요.';
  } else if (cannotUse) {
    hint = 'Confluence 호출 거부(403) — 인증은 통과했지만 이 계정으로는 Confluence 를 호출할 수 없습니다. ① CONFLUENCE_EMAIL 이 토큰을 발급한 계정의 이메일과 다른 경우가 가장 흔합니다(둘을 같은 계정으로 맞추세요). ② 스코프를 지정해 발급한 토큰은 사이트 주소 직접 호출이 막히므로 스코프 없는 클래식 토큰으로 재발급하세요. ③ 계정의 Confluence 라이선스가 해제된 경우도 같은 응답입니다.';
  } else {
    hint = 'Confluence 권한 없음(403) — 자격증명은 유효하나 토큰 소유 계정에 이 페이지/스페이스 읽기 권한이 없습니다. 해당 계정을 스페이스에 초대하세요.';
  }
  return { ok: false, status: 502, error: 'CONFLUENCE_AUTH', upstream: status, upstreamMessage: msg, hint };
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

// 실패 결과 → HTTP 응답. import-confluence·dev/import·dev/import-daily 공용.
// upstream 상태코드와 Atlassian 원문 메시지까지 관리자 화면으로 넘긴다.
export function failureResponse(res) {
  const body = { error: res.error };
  if (res.hint) body.hint = res.hint;
  if (res.upstream) body.upstream = res.upstream;
  if (res.upstreamMessage) body.upstreamMessage = res.upstreamMessage;
  return Response.json(body, { status: res.status || 400 });
}

// 페이지 조회 공용: URL → { ok, pageId, title, html, confUrl } | { ok:false, error, status, hint }
export async function fetchPage(env, url) {
  if (!env.CONFLUENCE_EMAIL || !env.CONFLUENCE_API_TOKEN) {
    return { ok: false, status: 503, error: 'NOT_CONFIGURED', hint: 'CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN 시크릿 필요' };
  }
  const auth = basicAuth(env.CONFLUENCE_EMAIL, env.CONFLUENCE_API_TOKEN);
  const resolved = await resolvePageId(url, auth);
  if (resolved && resolved.authError) return authFailure(resolved.authError, 'short-link resolve');
  const pageId = resolved;
  if (!pageId) return { ok: false, status: 400, error: 'INVALID_URL', hint: '컨플 페이지 URL(/pages/<id>) 또는 /wiki/x/ 단축링크를 입력하세요' };

  let page;
  try {
    const r = await fetch(`${CONF_BASE}/rest/api/content/${pageId}?expand=body.storage,space`, { headers: { Authorization: auth, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) return authFailure(r.status, await r.text().catch(() => ''));
    if (r.status === 404) return { ok: false, status: 404, error: 'PAGE_NOT_FOUND', hint: '페이지를 찾을 수 없습니다 — URL의 페이지 ID를 확인하거나, 토큰 계정에 열람 권한이 있는지 확인하세요' };
    if (!r.ok) return { ok: false, status: 502, error: 'CONFLUENCE_ERROR', hint: `Confluence 응답 오류(${r.status})` };
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
