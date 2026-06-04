/* 탐색 — 자연어 질문(RAG) + 태그·키워드 브라우즈(폴백)
 *  - 상단: /api/ask 로 자연어 질문 → 답변 + 출처 카드. 실패하면 키워드 검색으로 폴백.
 *  - 하단: /api/reports/all 재사용, 전체 필드 검색 + 태그 필터(?tag=). (기존 동작 유지)
 */
let entries = [], allTags = [], activeTag = null;

function getParam(k) { return new URLSearchParams(location.search).get(k); }
function el(id) { return document.getElementById(id); }

async function init() {
  let reports = [];
  try { reports = await API.all(); } catch { reports = []; }
  entries = reports.flatMap((r) => (r.companies || []).map((c) => ({ date: r.date, ...c }))).sort((a, b) => b.date.localeCompare(a.date));
  allTags = buildOntology(reports).tags.sort();
  activeTag = getParam('tag');

  el('q').addEventListener('input', render);
  el('askForm').addEventListener('submit', onAsk);
  el('question').addEventListener('input', (e) => { el('qLen').textContent = e.target.value.length; });
  // Enter 로 바로 질문(Shift+Enter 는 줄바꿈). 한글 IME 조합 확정 Enter 는 무시(e.isComposing).
  el('question').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); onAsk(); }
  });

  // ?q= 로 들어오면 자동 질문
  const preset = getParam('q');
  if (preset) { el('question').value = preset; el('qLen').textContent = preset.length; onAsk(); }

  render();

  // ?tag= 로 들어오면(그래프·기업상세 등) 태그 결과가 질문 박스 아래 묻히지 않도록 브라우즈 섹션으로 스크롤
  if (activeTag) {
    el('browse').scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
  }
}

/* ---------- 자연어 질문(RAG) ---------- */
async function onAsk(e) {
  if (e && e.preventDefault) e.preventDefault();
  const q = el('question').value.trim();
  if (!q) return;

  const card = el('answerCard');
  const btn = el('askBtn');
  card.classList.remove('hidden');
  card.innerHTML = '<div class="flex items-center gap-2 text-sm opacity-60"><span class="inline-block w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin"></span>자료를 검색하고 답변을 작성하는 중…</div>';
  btn.disabled = true;

  try {
    const { answer, sources } = await API.ask(q);
    card.innerHTML = answerHTML(answer, sources || []);
  } catch (err) {
    // 폴백: 키워드 검색으로 전환하고 안내
    card.innerHTML =
      '<div class="text-sm bg-beige border border-ink/5 rounded-xl p-3">' +
      '답변 생성에 실패해 <b>키워드 검색</b>으로 대신 찾았어요. 아래 결과를 확인해 주세요.' +
      '</div>';
    el('q').value = q;
    render();
    el('q').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    btn.disabled = false;
  }
}

// 답변 텍스트의 [n] 인용을 출처 칩으로, 출처 목록을 카드로 렌더.
function answerHTML(answer, sources) {
  const body = escapeHtml(answer).replace(/\[(\d+)\]/g,
    '<sup class="text-[10px] font-bold text-lime-600 align-super">[$1]</sup>');
  let html = '<div class="text-[15px] leading-relaxed whitespace-pre-line">' + body + '</div>';
  if (sources.length) {
    html += '<p class="text-[11px] font-semibold tracking-[0.18em] text-lime-600 uppercase mt-5 mb-2">출처</p>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">' + sources.map(sourceHTML).join('') + '</div>';
  }
  return html;
}

function sourceHTML(s) {
  const links = [];
  if (s.sourceUrl) links.push('<a href="' + safeUrl(s.sourceUrl) + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">원문</a>');
  if (s.confluenceUrl) links.push('<a href="' + safeUrl(s.confluenceUrl) + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">상세</a>');
  return '<div class="bg-beige border border-ink/5 rounded-[14px] p-3">' +
    '<div class="flex items-center gap-2 mb-1">' +
    '<span class="text-[10px] font-bold text-lime-600">[' + s.n + ']</span>' +
    '<a href="/company?name=' + encodeURIComponent(s.name) + '" class="font-display font-semibold text-sm tracking-tight hover:text-lime-600">' + escapeHtml(s.name) + '</a>' +
    '<span class="text-[10px] opacity-40 ml-auto">' + escapeHtml(s.date) + '</span></div>' +
    '<div class="flex items-center gap-2 text-xs opacity-60">' +
    '<span>' + escapeHtml(s.category || '') + '</span>' +
    (links.length ? '<span class="ml-auto flex gap-2">' + links.join('') + '</span>' : '') +
    '</div></div>';
}

/* ---------- 태그·키워드 브라우즈(기존 동작 유지) ---------- */
function render() {
  renderTags();
  const q = el('q').value.trim().toLowerCase();
  // 검색어도 태그도 없으면 결과를 표시하지 않는다(탐색 페이지: 검색 결과만 노출).
  if (!q && !activeTag) {
    el('expCount').textContent = '';
    el('expResults').innerHTML = '';
    return;
  }
  let rows = entries;
  if (activeTag) rows = rows.filter((r) => (r.tags || []).includes(activeTag));
  if (q) rows = rows.filter((r) =>
    (r.name + ' ' + (r.keyPoints || []).join(' ') + ' ' + (r.implications || []).join(' ') + ' ' + (r.hancomInsight || []).join(' ') + ' ' + (r.tags || []).join(' ')).toLowerCase().includes(q));
  el('expCount').textContent = rows.length + '건' + (activeTag ? ' · #' + activeTag : '');
  el('expResults').innerHTML = rows.map(cardHTML).join('') || '<div class="opacity-40 text-sm p-4">결과 없음</div>';
}

function renderTags() {
  el('tagcloud').innerHTML = allTags.map((t) =>
    '<button class="tagchip text-xs rounded-full px-3 py-1.5 border ' + (t === activeTag ? 'bg-lime border-lime text-ink font-semibold' : 'bg-beige border-ink/5 opacity-70 hover:border-lime') + '" data-t="' + escapeHtml(t) + '">#' + escapeHtml(t) + '</button>').join('');
  document.querySelectorAll('.tagchip').forEach((elm) => elm.onclick = () => {
    activeTag = activeTag === elm.dataset.t ? null : elm.dataset.t;
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
