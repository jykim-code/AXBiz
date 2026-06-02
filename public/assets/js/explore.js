/* 탐색 — /api/reports/all 재사용, 전체 필드 검색 + 태그 필터(?tag=) */
let entries = [], allTags = [], activeTag = null;

function getParam(k) { return new URLSearchParams(location.search).get(k); }

async function init() {
  let reports = [];
  try { reports = await API.all(); } catch { reports = []; }
  entries = reports.flatMap((r) => (r.companies || []).map((c) => ({ date: r.date, ...c }))).sort((a, b) => b.date.localeCompare(a.date));
  allTags = buildOntology(reports).tags.sort();
  activeTag = getParam('tag');
  document.getElementById('q').addEventListener('input', render);
  render();
}

function render() {
  renderTags();
  const q = document.getElementById('q').value.trim().toLowerCase();
  let rows = entries;
  if (activeTag) rows = rows.filter((r) => (r.tags || []).includes(activeTag));
  if (q) rows = rows.filter((r) =>
    (r.name + ' ' + (r.keyPoints || []).join(' ') + ' ' + (r.implications || []).join(' ') + ' ' + (r.hancomInsight || []).join(' ') + ' ' + (r.tags || []).join(' ')).toLowerCase().includes(q));
  document.getElementById('expCount').textContent = rows.length + '건' + (activeTag ? ' · #' + activeTag : '');
  document.getElementById('expResults').innerHTML = rows.map(cardHTML).join('') || '<div class="opacity-40 text-sm p-4">결과 없음</div>';
}

function renderTags() {
  document.getElementById('tagcloud').innerHTML = allTags.map((t) =>
    '<button class="tagchip text-xs rounded-full px-3 py-1.5 border ' + (t === activeTag ? 'bg-lime border-lime text-ink font-semibold' : 'bg-beige border-ink/5 opacity-70 hover:border-lime') + '" data-t="' + escapeHtml(t) + '">#' + escapeHtml(t) + '</button>').join('');
  document.querySelectorAll('.tagchip').forEach((el) => el.onclick = () => {
    activeTag = activeTag === el.dataset.t ? null : el.dataset.t;
    const u = new URL(location.href);
    if (activeTag) u.searchParams.set('tag', activeTag); else u.searchParams.delete('tag');
    history.replaceState(null, '', u);
    render();
  });
}

function cardHTML(r) {
  return '<div class="bg-white rounded-[18px] border border-ink/5 shadow-lg shadow-ink/5 p-4">' +
    '<div class="flex items-center gap-2 mb-1"><a href="/company?name=' + encodeURIComponent(r.name) + '" class="font-display font-bold tracking-tight hover:text-lime-600">' + escapeHtml(r.name) + '</a>' +
    '<span class="text-[10px] bg-beige border border-ink/5 rounded-full px-2 py-0.5 opacity-60">' + escapeHtml(r.category) + '</span>' +
    '<span class="text-[10px] opacity-40 ml-auto">' + escapeHtml(r.date) + '</span></div>' +
    '<p class="text-sm opacity-70">' + escapeHtml((r.keyPoints || [])[0] || '') + '</p>' +
    '<div class="flex flex-wrap gap-1.5 mt-2">' + (r.tags || []).map((t) => '<span class="text-[11px] opacity-60 bg-beige border border-ink/5 rounded-full px-2 py-0.5">#' + escapeHtml(t) + '</span>').join('') + '</div></div>';
}

document.addEventListener('DOMContentLoaded', init);
