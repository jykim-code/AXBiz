/* 플로팅 질의응답(FAB) — 우하단 버튼으로 RAG 질의 패널 토글.
   의존: API.ask (api.js), escapeHtml/safeUrl (util.js). 의견/관리자 페이지는 제외. */
(function () {
  const path = location.pathname;
  if (path.startsWith('/feedback') || path.startsWith('/admin')) return; // 노출 제외
  if (typeof API === 'undefined' || !API.ask) return; // 의존성 없으면 미표시

  const ICON_SEARCH = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>';
  const ICON_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M6 18L18 6"></path></svg>';

  const html =
    '<div id="askfab-panel" class="hidden fixed bottom-24 right-5 z-40 w-[min(92vw,400px)] max-h-[70vh] bg-white rounded-[24px] border border-ink/10 shadow-2xl shadow-ink/20 flex flex-col overflow-hidden">' +
      '<div class="flex items-center gap-2 px-5 py-4 border-b border-ink/5">' +
        '<span class="text-[11px] font-bold uppercase tracking-widest text-lime-600">Ask</span>' +
        '<span class="font-display font-semibold text-sm">무엇이든 물어보세요</span>' +
        '<button data-af-close aria-label="닫기" class="ml-auto opacity-60 hover:opacity-100">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<div class="p-4 border-b border-ink/5">' +
        '<form id="af-form" class="flex items-center gap-2">' +
          '<textarea id="af-q" rows="1" maxlength="500" placeholder="예) OO기업 최신 AX 동향은?" class="flex-1 resize-none overflow-hidden border border-ink/10 rounded-full px-4 py-2.5 text-sm leading-snug focus:outline-none focus:border-lime"></textarea>' +
          '<button type="submit" id="af-btn" class="flex-none bg-ink text-lime font-semibold text-sm rounded-full px-4 py-2.5 hover:opacity-90 disabled:opacity-40 transition">검색</button>' +
        '</form>' +
      '</div>' +
      '<div id="af-answer" class="flex-1 overflow-y-auto p-4 text-sm">' +
        '<div class="text-ink/50">질문을 입력하면 수집된 자료를 근거로 출처와 함께 답해 드립니다.</div>' +
      '</div>' +
    '</div>' +
    '<button id="askfab-btn" aria-label="AI에게 질문" class="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-ink text-lime shadow-2xl shadow-ink/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">' + ICON_SEARCH + '</button>';

  function srcHTML(s) {
    const links = [];
    if (s.sourceUrl) links.push('<a href="' + safeUrl(s.sourceUrl) + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">원문</a>');
    if (s.confluenceUrl) links.push('<a href="' + safeUrl(s.confluenceUrl) + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">상세</a>');
    const kps = s.keyPoints || [];
    const ev = kps.length
      ? '<details class="mt-1.5 group"><summary class="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[11px] font-semibold text-lime-600">근거 ▾</summary>' +
        '<ul class="mt-1 space-y-1 text-[12px] text-ink/70 list-disc pl-4">' + kps.map((k) => '<li>' + escapeHtml(k) + '</li>').join('') + '</ul></details>'
      : '';
    return '<div class="bg-beige border border-ink/5 rounded-xl p-2.5">' +
      '<div class="flex items-center gap-1.5">' +
      '<span class="text-[10px] font-bold text-lime-600">[' + s.n + ']</span>' +
      '<a href="/company?name=' + encodeURIComponent(s.name) + '" class="font-display font-semibold text-xs tracking-tight hover:text-lime-600">' + escapeHtml(s.name) + '</a>' +
      '<span class="text-[10px] text-ink/45 ml-auto">' + escapeHtml(s.date || '') + '</span></div>' +
      (links.length ? '<div class="text-[11px] mt-1 flex gap-2">' + links.join('') + '</div>' : '') +
      ev + '</div>';
  }

  function answerHTML(data) {
    const body = escapeHtml(data.answer || '').replace(/\[(\d+)\]/g, '<sup class="text-[10px] font-bold text-lime-600 align-super">[$1]</sup>');
    let html = '<div class="leading-relaxed whitespace-pre-line text-ink/90">' + body + '</div>';
    const srcs = data.sources || [];
    if (srcs.length) {
      html += '<p class="text-[11px] font-semibold tracking-widest text-lime-600 uppercase mt-4 mb-2">출처</p>' +
        '<div class="space-y-2">' + srcs.map(srcHTML).join('') + '</div>';
    }
    return html;
  }

  function mount() {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    while (tmp.firstChild) document.body.appendChild(tmp.firstChild);

    const btn = document.getElementById('askfab-btn');
    const panel = document.getElementById('askfab-panel');
    const q = document.getElementById('af-q');
    const ans = document.getElementById('af-answer');
    const submitBtn = document.getElementById('af-btn');

    let open = false;
    function setOpen(v) {
      open = v;
      panel.classList.toggle('hidden', !open);
      btn.innerHTML = open ? ICON_CLOSE : ICON_SEARCH;
      if (open) setTimeout(() => q.focus(), 50);
    }
    btn.addEventListener('click', () => setOpen(!open));
    panel.querySelector('[data-af-close]').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });

    async function ask() {
      const question = q.value.trim();
      if (!question) return;
      submitBtn.disabled = true;
      ans.innerHTML = '<div class="flex items-center gap-2 text-ink/60"><span class="inline-block w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin"></span>자료를 검색하고 답변을 작성하는 중…</div>';
      try {
        const data = await API.ask(question);
        ans.innerHTML = answerHTML(data);
      } catch (err) {
        ans.innerHTML = '<div class="text-sm bg-beige border border-ink/5 rounded-xl p-3">답변을 가져오지 못했어요. 잠시 후 다시 시도하거나 <a href="/explore" class="text-lime-600 hover:underline">검색</a> 페이지에서 다시 시도해 주세요.</div>';
      } finally {
        submitBtn.disabled = false;
      }
    }
    document.getElementById('af-form').addEventListener('submit', (e) => { e.preventDefault(); ask(); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); }
    });
  }

  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
