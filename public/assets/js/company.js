/* 기업 — 카드 그리드(검색·카테고리 필터·정렬) + 상세(?name=)  /api/reports/all 재사용 */
let REPORTS = [], ONT = null;
let cq = '', activeCat = null, sortBy = 'latest'; // 'latest'(최신 분석일) | 'count'(등장 횟수)
const CATS = ['대기업', '중견기업', '스타트업·중소'];

function getParam(k) { return new URLSearchParams(location.search).get(k); }
function el(id) { return document.getElementById(id); }

async function init() {
  try { REPORTS = await API.all(); } catch { REPORTS = []; }
  ONT = buildOntology(REPORTS);

  const name = getParam('name');
  if (name && ONT.companies.some((c) => c.name === name)) {
    el('compBrowse').classList.add('hidden'); // 상세 진입 시 그리드 숨김
    renderDetail(name);
    return;
  }

  el('cq').addEventListener('input', (e) => { cq = e.target.value.trim().toLowerCase(); renderGrid(); });
  el('sortToggle').addEventListener('click', () => { sortBy = sortBy === 'latest' ? 'count' : 'latest'; renderGrid(); });
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
    renderCatFilter();
    renderGrid();
  });
}

function renderGrid() {
  let rows = ONT.companies.slice();
  if (activeCat) rows = rows.filter((c) => c.category === activeCat);
  if (cq) rows = rows.filter((c) => (c.name + ' ' + [...c.tags].join(' ') + ' ' + (c.latest || '')).toLowerCase().includes(cq));
  rows.sort((a, b) => sortBy === 'latest'
    ? (b.latestDate || '').localeCompare(a.latestDate || '') || b.count - a.count
    : b.count - a.count || (b.latestDate || '').localeCompare(a.latestDate || ''));
  el('compCount').textContent = rows.length + '개 기업' + (activeCat ? ' · ' + activeCat : '');
  el('sortToggle').textContent = '정렬: ' + (sortBy === 'latest' ? '최신순' : '등장순');
  el('compGrid').innerHTML = rows.map(cardHTML).join('') || '<div class="text-sm text-ink/75 p-4">결과 없음</div>';
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

const sec = (t, a) => (a && a.length)
  ? '<div class="mt-2"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-1.5">' + t + '</div><ul class="space-y-1.5">' +
    a.map((x) => '<li class="text-sm opacity-80 pl-3 relative before:content-[\'\'] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-ink/30">' + escapeHtml(x) + '</li>').join('') + '</ul></div>'
  : '';

function renderDetail(name) {
  const ap = [];
  REPORTS.forEach((r) => (r.companies || []).filter((c) => c.name === name).forEach((c) => ap.push({ date: r.date, ...c })));
  ap.sort((a, b) => b.date.localeCompare(a.date));
  const tags = [...new Set(ap.flatMap((a) => a.tags || []))];
  const cat = ap[0] ? ap[0].category : '';
  const related = ONT.companies.filter((c) => c.name !== name && [...c.tags].some((t) => tags.includes(t))).slice(0, 6).map((c) => c.name);

  const timeline = ap.map((a) => {
    const src = safeUrl(a.sourceUrl), conf = safeUrl(a.confluenceUrl);
    let links = '';
    if (src) links += '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener noreferrer" class="text-xs border border-ink/10 rounded-full px-3 py-1.5 hover:bg-ink hover:text-white">출처 기사</a>';
    if (conf) links += '<a href="' + escapeHtml(conf) + '" target="_blank" rel="noopener noreferrer" class="text-xs border border-ink/10 rounded-full px-3 py-1.5 hover:bg-ink hover:text-white">상세 모니터링</a>';
    return '<div class="relative">' +
      '<div class="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-lime border-2 border-white"></div>' +
      '<div class="text-xs font-bold text-lime-600">' + escapeHtml(a.date) + '</div>' +
      sec('주요 내용', a.keyPoints) + sec('시사점', a.implications) +
      ((a.hancomInsight && a.hancomInsight.length) ? '<div class="bg-lime/10 border border-lime/40 rounded-xl p-3 mt-2"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-1.5">한컴 인사이트</div><ul class="space-y-1.5">' + a.hancomInsight.map((x) => '<li class="text-sm pl-3 relative before:content-[\'\'] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-lime-600">' + escapeHtml(x) + '</li>').join('') + '</ul></div>' : '') +
      (links ? '<div class="flex flex-wrap gap-2 mt-2">' + links + '</div>' : '') +
      '</div>';
  }).join('');

  document.getElementById('compDetail').innerHTML =
    '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-6">' +
    '<div class="flex items-center gap-3 flex-wrap"><h2 class="font-display font-bold text-3xl tracking-tight">' + escapeHtml(name) + '</h2><span class="text-xs bg-beige border border-ink/5 rounded-full px-3 py-1 opacity-80">' + escapeHtml(cat) + '</span></div>' +
    '<div class="flex items-baseline gap-6 mt-2 text-sm opacity-80"><span><b class="font-display text-lg text-ink">' + ap.length + '</b> 회 등장</span><span>최근 <b class="text-ink">' + escapeHtml(ap[0] ? ap[0].date : '-') + '</b></span><span><b class="font-display text-lg text-ink">' + tags.length + '</b> 태그</span></div>' +
    '<div class="flex flex-wrap gap-1.5 mt-3">' + tags.map((t) => '<a href="/explore?tag=' + encodeURIComponent(t) + '" class="text-xs bg-beige border border-ink/5 rounded-full px-2.5 py-1 hover:border-lime">#' + escapeHtml(t) + '</a>').join('') + '</div>' +
    '<div class="mt-6 space-y-5 border-l-2 border-lime/40 pl-5">' + timeline + '</div>' +
    (related.length ? '<div class="mt-6 pt-4 border-t border-ink/10"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-2">연관 기업 (태그 공유)</div><div class="flex flex-wrap gap-2">' + related.map((n) => '<a href="/company?name=' + encodeURIComponent(n) + '" class="text-sm rounded-full px-3 py-1.5 border bg-white border-ink/10 hover:border-lime">' + escapeHtml(n) + '</a>').join('') + '</div></div>' : '') +
    '</div>';
}

document.addEventListener('DOMContentLoaded', init);
