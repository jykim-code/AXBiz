/* 기업 — 카드 그리드(검색·카테고리 필터·정렬) + 상세(?name=)  /api/reports/all 재사용 */
let REPORTS = [], ONT = null;
let cq = '', activeCat = null, sortBy = 'latest'; // 'latest'(최신 분석일) | 'count'(등장 횟수)
const COMPANIES_PER_PAGE = 10;
let gridPage = 1;
const CATS = ['대기업', '중견기업', '스타트업·중소'];
// 국내 기업 우선 고정 순서(대기업→중견→스타트업·중소). 목록 외 기업은 선택한 정렬로 뒤에 배치.
const PRIORITY = ['삼성SDS', 'SK텔레콤', 'LG유플러스', '네이버', 'LG CNS', 'KT DS', '현대오토에버', '야놀자', '이스트소프트', '업스테이지'];
const priorityIdx = (n) => { const i = PRIORITY.indexOf(n); return i === -1 ? PRIORITY.length : i; };

function getParam(k) { return new URLSearchParams(location.search).get(k); }
function el(id) { return document.getElementById(id); }

/* ===== 공통 페이저 — 기업 목록(10개 단위) · 상세의 주요 동향(5건 단위) 공용 ===== */
// 페이지 번호 목록. 7페이지를 넘으면 현재 페이지 주변만 보이고 양끝은 생략(…)한다.
function pageNums(total, cur) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  let s = Math.max(2, cur - 1), e = Math.min(total - 1, cur + 1);
  if (cur <= 3) { s = 2; e = 4; }
  if (cur >= total - 2) { s = total - 3; e = total - 1; }
  const out = [1];
  if (s > 2) out.push('…');
  for (let i = s; i <= e; i++) out.push(i);
  if (e < total - 1) out.push('…');
  out.push(total);
  return out;
}

function pagerHTML(total, cur) {
  if (total <= 1) return '';
  const arrow = (prev, page, on) =>
    '<button type="button" ' + (on ? 'data-pg="' + page + '"' : 'disabled') +
    ' aria-label="' + (prev ? '이전' : '다음') + ' 페이지" class="pg-btn w-9 h-9 rounded-full border flex items-center justify-center transition-colors ' +
    (on ? 'bg-white border-ink/10 hover:border-lime' : 'border-ink/5 text-ink/25 cursor-default') + '">' + (prev ? '←' : '→') + '</button>';
  const num = (p) => p === '…'
    ? '<span class="w-9 h-9 flex items-center justify-center text-sm text-ink/40">…</span>'
    : '<button type="button" data-pg="' + p + '" aria-current="' + (p === cur) + '" class="pg-btn w-9 h-9 rounded-full border text-sm flex items-center justify-center transition-colors ' +
      (p === cur ? 'bg-lime border-lime font-semibold' : 'bg-white border-ink/10 hover:border-lime') + '">' + p + '</button>';
  return '<div class="flex items-center justify-center gap-1.5 mt-5">' +
    arrow(true, cur - 1, cur > 1) + pageNums(total, cur).map(num).join('') + arrow(false, cur + 1, cur < total) +
    '</div>';
}

// 페이저를 그리고 클릭을 연결한다. onPick(페이지번호) 안에서 다시 렌더한다.
function renderPager(box, total, cur, onPick) {
  if (!box) return;
  box.innerHTML = pagerHTML(total, cur);
  box.querySelectorAll('.pg-btn[data-pg]').forEach((b) => b.onclick = () => onPick(Number(b.dataset.pg)));
}

// 페이지 이동 후 목록 머리로 되돌린다(sticky 헤더에 가리지 않게 scroll-mt-* 필요).
function scrollToTop(id) {
  const top = el(id);
  if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function init() {
  // 별칭은 검색에만 쓰이므로 실패해도 진행한다 — 그 경우 company-alias.js 의 시드 사전으로 검색한다.
  const [reports, aliases] = await Promise.all([
    API.all().catch(() => []),
    API.companyAliases().catch(() => null),
  ]);
  REPORTS = reports;
  applyCompanyAliases(aliases);
  ONT = buildOntology(REPORTS);

  const name = getParam('name');
  if (name && ONT.companies.some((c) => c.name === name)) {
    el('compBrowse').classList.add('hidden'); // 상세 진입 시 그리드 숨김
    renderDetail(name);
    return;
  }

  // 검색어·정렬·카테고리가 바뀌면 결과 집합이 달라지므로 1페이지로 되돌린다.
  el('cq').addEventListener('input', (e) => { cq = e.target.value.trim().toLowerCase(); gridPage = 1; renderGrid(); });
  el('sortToggle').addEventListener('click', () => { sortBy = sortBy === 'latest' ? 'count' : 'latest'; gridPage = 1; renderGrid(); });
  renderCatFilter();
  renderGrid();
}

function renderCatFilter() {
  const chip = (label, val) =>
    '<button class="catchip text-xs rounded-full px-3 py-1.5 border ' +
    (activeCat === val ? 'bg-lime border-lime text-ink font-semibold' : 'bg-beige border-ink/5 text-ink/80 hover:border-lime') +
    '" data-c="' + (val === null ? '' : escapeHtml(val)) + '">' + label + '</button>';
  el('catFilter').innerHTML = chip('전체', null) + CATS.map((c) => chip(c, c)).join('');
  el('catFilter').querySelectorAll('.catchip').forEach((b) => b.onclick = () => {
    activeCat = b.dataset.c || null;
    gridPage = 1;
    renderCatFilter();
    renderGrid();
  });
}

// scroll=true 면 페이지 이동으로 보고 목록 머리로 되돌린다(검색·필터 변경 시에는 이동 없음).
function renderGrid(scroll) {
  let rows = ONT.companies.slice();
  if (activeCat) rows = rows.filter((c) => c.category === activeCat);
  // 이름 우선 매칭 — 검색어가 기업명 또는 별칭(company-alias.js)에 걸리면 그 기업만 남긴다.
  // 별칭은 사용자가 정식 사명 대신 쓰는 표기다('엔비디아'→NVIDIA, 'PCN'→피씨엔).
  // (요약문에 그 이름이 언급된 다른 기업까지 섞여 나오던 문제 — '미스트랄'에 네이버가 나오던 것)
  // 이름·별칭에 걸리는 기업이 없을 때만 태그·내용 검색으로 넘어간다.
  if (cq) {
    const byName = rows.filter((c) => matchesCompanyName(c.name, cq));
    rows = byName.length ? byName : rows.filter((c) => ([...c.tags].join(' ') + ' ' + (c.latest || '')).toLowerCase().includes(cq));
  }
  rows.sort((a, b) =>
    priorityIdx(a.name) - priorityIdx(b.name) // 국내 지정 순서 우선
    || (sortBy === 'latest'
      ? (b.latestDate || '').localeCompare(a.latestDate || '') || b.count - a.count
      : b.count - a.count || (b.latestDate || '').localeCompare(a.latestDate || '')));
  const total = Math.ceil(rows.length / COMPANIES_PER_PAGE);
  gridPage = Math.min(Math.max(1, gridPage), Math.max(1, total));
  const start = (gridPage - 1) * COMPANIES_PER_PAGE;
  const page = rows.slice(start, start + COMPANIES_PER_PAGE);
  el('compCount').textContent = (total > 1 ? (start + 1) + '–' + (start + page.length) + ' / ' : '') +
    rows.length + '개 기업' + (activeCat ? ' · ' + activeCat : '');
  el('sortToggle').textContent = '정렬: ' + (sortBy === 'latest' ? '최신순' : '등장순');
  // 다크 featured 카드는 전체 1번째 기업에만 — 2페이지 이후 첫 카드는 일반 흰 카드.
  el('compGrid').innerHTML = page.map((c, k) => cardHTML(c, start + k)).join('') || '<div class="text-sm text-ink/75 p-4">결과 없음</div>';
  renderPager(el('compPager'), total, gridPage, (p) => { gridPage = p; renderGrid(true); });
  if (scroll) scrollToTop('compGrid');
}

// Template index.html 의 에디토리얼 카드 스타일. 첫 카드는 다크 featured(light+dark 페어링).
const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';

function cardHTML(c, i) {
  const dark = i === 0; // 최신순 첫 기업을 다크 카드로 강조
  const tags = [...c.tags].slice(0, 3);
  const cardCls = dark
    ? 'bg-ink text-white hover:shadow-xl hover:shadow-ink/20'
    : 'bg-white border border-ink/5 hover:shadow-xl hover:shadow-ink/5';
  const eyebrow = dark ? 'text-lime' : 'text-lime-600';
  const sub = dark ? 'text-white/60' : 'text-ink/55';
  const body = dark ? 'text-white/70' : 'text-ink/70';
  const chip = dark ? 'text-white/70 bg-white/10 border-white/10' : 'text-ink/70 bg-beige border-ink/5';
  const arrowWrap = dark ? 'bg-white/10 group-hover:bg-lime group-hover:text-ink' : 'bg-beige group-hover:bg-lime';
  return '<a href="/company?name=' + encodeURIComponent(c.name) + '" class="group block p-7 sm:p-9 rounded-[28px] transition-all duration-300 ' + cardCls + '">' +
    '<div class="flex items-center gap-2 mb-4">' +
    '<span class="text-sm font-bold uppercase tracking-widest ' + eyebrow + '">' + escapeHtml(c.category || '') + '</span>' +
    '<span class="text-xs ' + sub + ' ml-auto">' + escapeHtml(c.latestDate || '') + (c.count ? ' · ' + c.count + '회' : '') + '</span></div>' +
    '<h3 class="text-2xl sm:text-3xl font-display font-bold tracking-tight mb-3">' + escapeHtml(c.name) + '</h3>' +
    '<p class="' + body + ' leading-relaxed mb-6 line-clamp-3">' + escapeHtml(c.latest || '') + '</p>' +
    '<div class="flex items-center gap-2 flex-wrap">' +
    tags.map((t) => '<span class="text-[11px] rounded-full px-2.5 py-0.5 border ' + chip + '">#' + escapeHtml(t) + '</span>').join('') +
    '<span class="ml-auto w-10 h-10 rounded-full flex items-center justify-center transition-colors ' + arrowWrap + '">' + ARROW + '</span>' +
    '</div></a>';
}

/* ===== 주요 동향 — 건별 카드(접기/펼치기) ===== */
const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

// 접힌 상태에서는 날짜 + 미리보기 한 줄만 보이고, 헤더를 누르면 본문이 열린다.
// button 안에는 phrasing content 만 넣어야 하므로 div 대신 span + block/flex 클래스를 쓴다.
// i = 전체 목록 기준 순번(최신 배지 판단), open = 처음부터 펼친 상태로 그릴지 여부.
function trendCardHTML(a, i, open) {
  const body = entryDetailHTML(a); // 카테고리 블록 구성은 대시보드 카드와 공용(entry.js)
  const preview = (a.keyPoints && a.keyPoints[0]) || (a.implications && a.implications[0]) || '';
  const cardCls = 'trend-card bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 transition-shadow hover:shadow-ink/10';
  const dateRow =
    '<span class="flex items-center gap-2">' +
      '<span class="text-xs font-bold text-lime-600">' + escapeHtml(a.date) + '</span>' +
      (i === 0 ? '<span class="text-[10px] font-bold bg-lime rounded-full px-2 py-0.5">최신</span>' : '') +
    '</span>';
  const previewRow = preview ? '<span class="trend-preview block text-sm font-semibold text-ink mt-1 leading-snug line-clamp-2">' + escapeHtml(preview) + '</span>' : '';
  // 펼칠 본문이 없는 건(입력 누락)은 클릭해도 열 것이 없으므로 토글하지 않는 정적 카드로 둔다.
  if (!body) {
    return '<article class="' + cardCls + ' is-static">' +
      '<div class="trend-head">' + dateRow + previewRow + '</div></article>';
  }
  return '<article class="' + cardCls + (open ? ' is-open' : '') + '">' +
    '<button type="button" class="trend-head flex items-start gap-3" aria-expanded="' + open + '">' +
      '<span class="min-w-0 flex-1">' + dateRow + previewRow + '</span>' +
      '<span class="trend-chevron flex-none w-8 h-8 rounded-full bg-beige flex items-center justify-center transition-transform">' + CHEV + '</span>' +
    '</button>' +
    '<div class="trend-body">' + body + '</div></article>';
}

function syncTrendAll() {
  const btn = document.getElementById('trendAll');
  if (!btn) return;
  btn.textContent = document.querySelectorAll('.trend-card:not(.is-static):not(.is-open)').length ? '모두 펼치기' : '모두 접기';
}
function setTrendOpen(card, open) {
  card.classList.toggle('is-open', open);
  const head = card.querySelector('.trend-head');
  if (head) head.setAttribute('aria-expanded', String(open));
}
function bindTrendCards() {
  const cards = [...document.querySelectorAll('.trend-card:not(.is-static)')];
  cards.forEach((card) => {
    const head = card.querySelector('.trend-head');
    if (head) head.onclick = () => { setTrendOpen(card, !card.classList.contains('is-open')); syncTrendAll(); };
  });
  const all = document.getElementById('trendAll');
  if (all) all.onclick = () => {
    const expand = cards.some((c) => !c.classList.contains('is-open')); // 하나라도 접혀 있으면 전부 펼침
    cards.forEach((c) => setTrendOpen(c, expand));
    syncTrendAll();
  };
  syncTrendAll();
}

/* ===== 주요 동향 페이지네이션 — 5건 단위 ===== */
const TRENDS_PER_PAGE = 5;
let trendItems = [], trendPage = 1;

// 현재 페이지 카드 + 페이저를 다시 그린다. scroll=true 면 동향 섹션 머리로 되돌린다.
function renderTrendPage(scroll) {
  const list = el('trendList');
  if (!list) return;
  const total = Math.ceil(trendItems.length / TRENDS_PER_PAGE);
  trendPage = Math.min(Math.max(1, trendPage), Math.max(1, total));
  const start = (trendPage - 1) * TRENDS_PER_PAGE;
  const rows = trendItems.slice(start, start + TRENDS_PER_PAGE);
  // 페이지마다 첫 카드만 펼친 상태로 시작(최신 배지는 전체 1번째 건에만).
  list.innerHTML = rows.map((a, k) => trendCardHTML(a, start + k, k === 0)).join('');
  const range = el('trendRange');
  if (range) range.textContent = total > 1
    ? (start + 1) + '–' + (start + rows.length) + ' / ' + trendItems.length + '건'
    : trendItems.length + '건';
  renderPager(el('trendPager'), total, trendPage, (p) => { trendPage = p; renderTrendPage(true); });
  bindTrendCards();
  if (scroll) scrollToTop('trendTop');
}

function renderDetail(name) {
  const ap = [];
  REPORTS.forEach((r) => (r.companies || []).filter((c) => c.name === name).forEach((c) => ap.push({ date: r.date, ...c })));
  ap.sort((a, b) => b.date.localeCompare(a.date));
  const tags = [...new Set(ap.flatMap((a) => a.tags || []))];
  const cat = ap[0] ? ap[0].category : '';
  const related = ONT.companies.filter((c) => c.name !== name && [...c.tags].some((t) => tags.includes(t))).slice(0, 6).map((c) => c.name);

  trendItems = ap;
  trendPage = 1;
  // 연관 기업 — 우측 컬럼(회사정보·재무) 아래에 배치
  const relatedHTML = related.length
    ? '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-5">' +
      '<div class="flex items-center gap-2 mb-3"><div class="text-xs font-bold uppercase tracking-widest text-lime-600">연관 기업</div><span class="text-[10px] text-ink/45 ml-auto">태그 공유</span></div>' +
      '<div class="flex flex-wrap gap-2">' + related.map((n) => '<a href="/company?name=' + encodeURIComponent(n) + '" class="text-sm rounded-full px-3 py-1.5 border bg-white border-ink/10 hover:border-lime">' + escapeHtml(n) + '</a>').join('') + '</div></div>'
    : '';

  const tagsHTML = tags.map((t) => '<a href="/explore?tag=' + encodeURIComponent(t) + '" class="text-xs bg-white border border-ink/5 rounded-full px-2.5 py-1 hover:border-lime">#' + escapeHtml(t) + '</a>').join('');
  document.getElementById('compDetail').innerHTML =
    // 헤더 (전체 폭)
    '<div class="mb-6">' +
      '<div class="flex items-center gap-3 flex-wrap"><h2 class="font-display font-bold text-3xl tracking-tight">' + escapeHtml(name) + '</h2><span class="text-xs bg-white border border-ink/5 rounded-full px-3 py-1 text-ink/70">' + escapeHtml(cat) + '</span></div>' +
      '<div class="flex items-baseline gap-6 mt-2 text-sm text-ink/80"><span><b class="font-display text-lg text-ink">' + ap.length + '</b> 회 등장</span><span>최근 <b class="text-ink">' + escapeHtml(ap[0] ? ap[0].date : '-') + '</b></span><span><b class="font-display text-lg text-ink">' + tags.length + '</b> 태그</span></div>' +
      '<div class="flex flex-wrap gap-1.5 mt-3">' + tagsHTML + '</div>' +
    '</div>' +
    // AI 요약 밴드 (핵심 흐름 + 종합 한컴 인사이트, 비동기 로드)
    '<div id="compSummary" class="mb-6 hidden"></div>' +
    // 2단: 좌(주요 동향 카드 2/3) · 우(회사정보+재무 비동기 로드 → 연관 기업)
    '<div class="grid lg:grid-cols-3 gap-6 items-start">' +
      '<div id="detailMain" class="lg:col-span-2">' +
        '<div id="trendTop" class="flex items-end gap-3 mb-4 scroll-mt-24">' +
          '<div class="min-w-0">' +
            '<p class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-1">Trends</p>' +
            '<h3 class="font-display font-bold text-2xl sm:text-3xl tracking-tight">주요 동향</h3>' +
          '</div>' +
          '<span id="trendRange" class="flex-none text-sm text-ink/55 ml-auto">' + ap.length + '건</span>' +
          (ap.length > 1 ? '<button id="trendAll" type="button" class="flex-none text-xs border border-ink/10 rounded-full px-3 py-1.5 hover:bg-ink hover:text-white transition-colors">모두 펼치기</button>' : '') +
        '</div>' +
        '<div id="trendList" class="space-y-4"></div>' +
        '<div id="trendPager"></div>' +
      '</div>' +
      '<aside id="compSide" class="space-y-6">' +
        '<div id="compProfile" class="space-y-6"></div>' +
        relatedHTML +
      '</aside>' +
    '</div>';
  renderTrendPage(false);
  loadProfile(name);
  loadSummary(name);
}

/* ===== AI 요약 (핵심 흐름 + 종합 한컴 인사이트) ===== */
async function loadSummary(name) {
  const box = document.getElementById('compSummary');
  if (!box) return;
  // 저장본만 즉시 조회(LLM 호출 없음). 없으면 섹션 미표시 — 생성은 관리자 저장 시 백그라운드.
  let d = null;
  try { d = await API.companySummary(name); } catch { d = null; }
  if (!d || !d.available || !Array.isArray(d.flow) || !d.flow.length) { box.remove(); return; }
  box.classList.remove('hidden');
  // 기간 라벨은 고정폭 좌측 컬럼(원장형)에 우측정렬 — 라벨 길이가 달라도 본문 시작선이 어긋나지 않는다.
  // pt-[3px]는 11px 라벨과 14px 본문의 첫 줄 베이스라인을 맞추기 위한 값.
  const flow = d.flow.map((f) =>
    '<li class="grid grid-cols-[4.25rem_1fr] py-1.5">' +
    '<span class="text-[11px] font-bold text-lime-600 text-right break-keep leading-relaxed pt-[3px] pr-3 border-r border-ink/10">' + escapeHtml(f.period || '') + '</span>' +
    '<span class="text-sm text-ink/85 leading-relaxed pl-3.5">' + escapeHtml(f.text) + '</span></li>').join('');
  const ins = (d.insight || []).map((t) =>
    '<li class="text-sm text-white/85 leading-relaxed pl-3.5 relative before:content-[\'\'] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-lime">' + escapeHtml(t) + '</li>').join('');
  box.innerHTML =
    '<div class="grid lg:grid-cols-2 gap-6">' +
      '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-6">' +
        '<div class="flex items-center gap-2 mb-3"><div class="text-xs font-bold uppercase tracking-widest text-lime-600">핵심 흐름 요약</div><span class="text-[10px] text-ink/45 ml-auto">AI 요약 · ' + escapeHtml(d.dataDate || '') + ' 데이터 기준</span></div>' +
        '<ul class="-my-1.5">' + flow + '</ul></div>' +
      (ins ? '<div class="bg-ink text-white rounded-[24px] shadow-xl shadow-ink/20 p-6">' +
        '<div class="flex items-center gap-2 mb-3"><div class="text-xs font-bold uppercase tracking-widest text-lime">종합 한컴 인사이트</div><span class="text-[10px] text-white/40 ml-auto">AI 요약</span></div>' +
        '<ul class="space-y-2.5">' + ins + '</ul></div>' : '') +
    '</div>';
}

/* ===== 회사정보 + 재무(DART) — 우측 컬럼 ===== */
function fmtKRW(n) {
  if (n == null) return '-';
  const neg = n < 0, a = Math.abs(n);
  let s;
  if (a >= 1e12) s = (a / 1e12).toFixed(a / 1e12 >= 10 ? 0 : 1) + '조';
  else if (a >= 1e8) s = Math.round(a / 1e8).toLocaleString() + '억';
  else s = Math.round(a).toLocaleString();
  return (neg ? '-' : '') + s;
}
function yoyBadge(y) {
  if (y == null) return '';
  const up = y >= 0, cls = up ? 'text-lime-600' : 'text-rose-500', ar = up ? '▲' : '▼';
  return '<span class="text-xs font-semibold ' + cls + '">' + ar + ' ' + (Math.abs(y) * 100).toFixed(1) + '% <span class="text-ink/45 font-normal">전년比</span></span>';
}
function metricRow(label, series, yoy) {
  if (!series || !series.length) return '';
  const latest = series[series.length - 1];
  return '<div class="flex items-baseline gap-3 py-2.5 border-b border-ink/5 last:border-0">' +
    '<span class="text-sm text-ink/60 w-16 flex-none">' + label + '</span>' +
    '<span class="font-display font-bold text-xl tracking-tight">' + fmtKRW(latest.value) + '</span>' +
    '<span class="text-[11px] text-ink/45">' + latest.year + '년</span>' +
    '<span class="ml-auto">' + yoyBadge(yoy) + '</span></div>';
}
// 매출액·영업이익 분기별 묶음 막대 + 범례.
// 값 범위가 억~조 단위로 크고 음수도 있어 √(제곱근) 스케일 + 0 기준선(가운데 선) 사용.
// 막대 높이는 √보정(크기 순서 유지·시인성 확보), 정확한 값은 라벨로 표기.
// 색: 매출액만 라임으로 박고 나머지(영업이익 막대·라벨·기준선)는 currentColor 로 둔다.
// SVG 속성은 Tailwind 클래스도 dark.css 도 닿지 않아 #111 로 박아 두었더니 다크 모드에서
// 영업이익 막대가 어두운 카드에 묻혀 사라졌다. currentColor 면 카드가 물려주는 글자색을
// 따라가므로 라이트에서는 종전과 같은 검정, 다크에서는 밝은 회색이 된다.
function groupedBarChart(pts) {
  const flat = pts.flatMap((p) => [p.revenue, p.operatingProfit]).filter((v) => v != null);
  if (!flat.length) return '';
  const W = 400, H = 210, padT = 34, padB = 30, padX = 12, ph = H - padT - padB, pw = W - padX * 2;
  const mag = (v) => Math.sqrt(Math.abs(v)); // √ 스케일: 큰 값 압축, 작은 값 가시화
  const maxPosS = Math.max(0, ...flat.map((v) => (v > 0 ? mag(v) : 0)));
  const maxNegS = Math.max(0, ...flat.map((v) => (v < 0 ? mag(v) : 0)));
  const span = (maxPosS + maxNegS) || 1, scale = ph / span, zeroY = padT + maxPosS * scale;
  const n = pts.length, slot = pw / n, bw = Math.min(20, slot * 0.3), gap = 6;
  let g = '';
  // 범례
  g += '<rect x="' + padX + '" y="10" width="11" height="11" rx="2" fill="#c8f200"/><text x="' + (padX + 16) + '" y="19" font-size="11" fill="currentColor">매출액</text>';
  g += '<rect x="' + (padX + 72) + '" y="10" width="11" height="11" rx="2" fill="currentColor"/><text x="' + (padX + 88) + '" y="19" font-size="11" fill="currentColor">영업이익</text>';
  // 0 기준선(가운데 선)
  g += '<line x1="' + padX + '" y1="' + zeroY + '" x2="' + (W - padX) + '" y2="' + zeroY + '" stroke="currentColor" stroke-opacity=".18" stroke-width="1"/>';
  pts.forEach((p, i) => {
    const cx = padX + slot * i + slot / 2;
    const labels = [];
    [['revenue', '#c8f200', -(bw + gap / 2)], ['operatingProfit', 'currentColor', gap / 2]].forEach(([key, color, off]) => {
      const v = p[key];
      if (v == null) { labels.push(null); return; }
      const x = cx + off, h = Math.max(2, mag(v) * scale);
      const y = v >= 0 ? zeroY - h : zeroY;
      g += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="2" fill="' + color + '"/>';
      let ly = v >= 0 ? y - 5 : zeroY + h + 11;
      labels.push({ x: x + bw / 2, ly, v });
    });
    // 같은 방향(위/아래) 라벨이 겹치면 9px 간격으로 분리
    const [a, b] = labels;
    if (a && b && (a.v >= 0) === (b.v >= 0) && Math.abs(a.ly - b.ly) < 9) {
      if (a.v >= 0) { if (a.ly <= b.ly) a.ly = b.ly - 9; else b.ly = a.ly - 9; }
      else { if (a.ly >= b.ly) a.ly = b.ly + 9; else b.ly = a.ly + 9; }
    }
    labels.forEach((L) => {
      if (!L) return;
      const ly = Math.max(10, Math.min(H - 20, L.ly)); // 상단/분기라벨과 충돌 방지
      g += '<text x="' + L.x + '" y="' + ly + '" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor">' + fmtKRW(L.v) + '</text>';
    });
    g += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity=".55">' + escapeHtml(p.period) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" preserveAspectRatio="xMidYMid meet">' + g + '</svg>';
}
function companyCard(c) {
  const rows = [];
  if (c.ceo) rows.push(['대표자', escapeHtml(c.ceo)]);
  if (c.established) rows.push(['설립일', escapeHtml(c.established)]);
  if (c.corpClass || c.stockCode) rows.push(['상장', escapeHtml([c.corpClass, c.stockCode].filter(Boolean).join(' · '))]);
  if (c.industryCode) rows.push(['업종코드', escapeHtml(c.industryCode)]);
  if (c.address) rows.push(['주소', escapeHtml(c.address)]);
  if (c.homepage) { const u = safeUrl(c.homepage); if (u) rows.push(['홈페이지', '<a href="' + u + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">' + escapeHtml(c.homepage.replace(/^https?:\/\//, '')) + '</a>']); }
  if (!rows.length) return '';
  return '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-5">' +
    '<div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-3">회사 정보</div>' +
    '<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">' +
    rows.map(([k, v]) => '<dt class="text-ink/55">' + k + '</dt><dd class="text-ink/90 break-all">' + v + '</dd>').join('') +
    '</dl></div>';
}
function financeCard(f) {
  if (!f) return '';
  const a = f.annual, q = f.quarterly;
  if (!a && !(q && q.length)) return '';
  let html = '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-5">' +
    '<div class="flex items-center gap-2 mb-2"><div class="text-xs font-bold uppercase tracking-widest text-lime-600">재무</div><span class="text-[10px] text-ink/45 ml-auto">출처: DART' + (a && a.fs ? ' · ' + a.fs : '') + ' · 단위 원</span></div>';
  if (a) html += '<div>' + metricRow('매출액', a.revenue, a.revenueYoY) + metricRow('영업이익', a.operatingProfit, a.operatingProfitYoY) + '</div>';
  if (q && q.length) html += '<div class="border-t border-ink/5 pt-3 mt-3"><div class="text-[11px] font-semibold text-ink/55 mb-1">분기 추이 (최신 4분기)</div>' + groupedBarChart(q) + '</div>';
  return html + '</div>';
}
async function loadProfile(name) {
  const right = document.getElementById('compProfile');
  if (!right) return;
  let d = null;
  try { d = await API.companyProfile(name); } catch { d = null; }
  if (d && d.available) {
    const html = (d.company ? companyCard(d.company) : '') + (d.financials ? financeCard(d.financials) : '');
    if (html.trim()) { right.innerHTML = html; return; }
  }
  // 데이터 없음(해외·미매핑) → 회사정보·재무만 제거. 연관 기업이 있으면 우측 컬럼은 유지한다.
  right.remove();
  const side = document.getElementById('compSide');
  if (side && !side.children.length) {
    side.remove();
    const main = document.getElementById('detailMain');
    if (main) { main.classList.remove('lg:col-span-2'); main.classList.add('lg:col-span-3'); }
  }
}

document.addEventListener('DOMContentLoaded', init);
