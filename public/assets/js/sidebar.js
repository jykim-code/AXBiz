/* 공유 사이드바 — 기본 닫힘 드로어. 각 페이지의 [data-sb-open] 버튼으로 토글.
   관리자(/admin)는 포함하지 않는다(노출 규칙). */
(function () {
  const NAV = [
    { href: '/', label: '대시보드' },
    { href: '/weekly', label: '위클리 픽' },
    // 뉴스레터(/news)는 사이드바에 노출하지 않는다(2026-08-24 사용자 지시).
    // 페이지 자체는 남아 있고 URL 로는 접근된다 — 진입점만 뺀 것이다.
    { href: '/explore', label: '검색' },
    { href: '/company', label: '기업' },
    { href: '/feedback', label: '의견 보내기' },
  ];
  let path = location.pathname;
  if (path === '/index.html') path = '/';
  function active(href) {
    const p = href.split('?')[0];
    return p === '/' ? path === '/' : path === p;
  }
  // 첫 매칭만 활성(중복 하이라이트 방지)
  let activated = false;
  const items = NAV.map((n) => {
    const on = !activated && active(n.href);
    if (on) activated = true;
    const cls = on ? 'bg-white/60 text-ink font-semibold ring-1 ring-ink/10' : 'text-ink/80 hover:bg-white/40';
    return '<a href="' + n.href + '" class="block px-4 py-2.5 rounded-xl text-sm transition-colors ' + cls + '">' + n.label + '</a>';
  }).join('');

  const closeIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>';
  const html =
    '<aside id="app-sb" class="fixed z-40 top-0 left-0 h-full w-64 bg-lime/20 backdrop-blur-2xl border-r border-lime/40 shadow-2xl shadow-lime-600/10 flex flex-col -translate-x-full transition-transform duration-300">' +
      '<div class="h-20 flex items-center justify-between px-5 border-b border-ink/10">' +
        '<div data-sb-close role="button" tabindex="0" aria-label="사이드바 닫기" class="flex items-center gap-2 cursor-pointer"><img src="/assets/HANCOM.png" alt="HANCOM" class="h-6 w-auto"/><span class="font-display font-semibold text-sm">AX Biz Radar</span></div>' +
        '<button data-sb-close aria-label="사이드바 닫기" class="opacity-50 hover:opacity-100">' + closeIcon + '</button>' +
      '</div>' +
      '<nav class="flex-1 overflow-y-auto p-3 space-y-1">' + items + '</nav>' +
      '<div class="p-4 border-t border-ink/10 text-[11px] opacity-70">시장 동향 포착에서 인사이트까지</div>' +
    '</aside>' +
    '<div data-sb-overlay class="fixed inset-0 bg-ink/15 backdrop-blur-[2px] z-30 hidden"></div>';

  function mount() {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    while (tmp.firstChild) document.body.appendChild(tmp.firstChild);
    const sb = document.getElementById('app-sb');
    const ov = document.querySelector('[data-sb-overlay]');
    const open = () => { sb.classList.remove('-translate-x-full'); ov.classList.remove('hidden'); };
    const close = () => { sb.classList.add('-translate-x-full'); ov.classList.add('hidden'); };
    document.querySelectorAll('[data-sb-open]').forEach((b) => b.addEventListener('click', open));
    sb.querySelectorAll('[data-sb-close]').forEach((b) => {
      b.addEventListener('click', close);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); close(); } });
    });
    ov.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
