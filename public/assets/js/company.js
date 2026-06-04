/* 기업 — 목록(?name 없음) + 상세(?name=)  /api/reports/all 재사용 */
let REPORTS = [], ONT = null;

function getParam(k) { return new URLSearchParams(location.search).get(k); }

async function init() {
  try { REPORTS = await API.all(); } catch { REPORTS = []; }
  ONT = buildOntology(REPORTS);
  renderList();
  const name = getParam('name');
  if (name && ONT.companies.some((c) => c.name === name)) renderDetail(name);
  else renderEmpty();
}

function renderList() {
  const sorted = ONT.companies.slice().sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  document.getElementById('compList').innerHTML = sorted.map((c) =>
    '<a href="/company?name=' + encodeURIComponent(c.name) + '" class="text-sm rounded-full px-4 py-2 border bg-white border-ink/10 hover:border-lime">' +
    escapeHtml(c.name) + ' <span class="opacity-75">' + c.count + '</span></a>').join('');
}

function renderEmpty() {
  document.getElementById('compDetail').innerHTML =
    '<div class="text-sm opacity-75 mt-4">위에서 기업을 선택하면 날짜별 동향을 모아 봅니다.' + (ONT.companies.length ? '' : ' (아직 데이터가 없습니다.)') + '</div>';
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
    '<div class="flex gap-6 mt-2 text-sm opacity-80"><span><b class="font-display text-lg text-ink">' + ap.length + '</b> 회 등장</span><span>최근 <b class="text-ink">' + escapeHtml(ap[0] ? ap[0].date : '-') + '</b></span><span><b class="font-display text-lg text-ink">' + tags.length + '</b> 태그</span></div>' +
    '<div class="flex flex-wrap gap-1.5 mt-3">' + tags.map((t) => '<a href="/explore?tag=' + encodeURIComponent(t) + '" class="text-xs bg-beige border border-ink/5 rounded-full px-2.5 py-1 hover:border-lime">#' + escapeHtml(t) + '</a>').join('') + '</div>' +
    '<div class="mt-6 space-y-5 border-l-2 border-lime/40 pl-5">' + timeline + '</div>' +
    (related.length ? '<div class="mt-6 pt-4 border-t border-ink/10"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-2">연관 기업 (태그 공유)</div><div class="flex flex-wrap gap-2">' + related.map((n) => '<a href="/company?name=' + encodeURIComponent(n) + '" class="text-sm rounded-full px-3 py-1.5 border bg-white border-ink/10 hover:border-lime">' + escapeHtml(n) + '</a>').join('') + '</div></div>' : '') +
    '</div>';
}

document.addEventListener('DOMContentLoaded', init);
