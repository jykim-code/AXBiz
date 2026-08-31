/* nav.js — 공유 헤더 nav 링크 주입 + C안 footer 주입 + 다크 모드 토글
   [data-nav-links]  : 헤더 내 데스크탑 nav 링크 슬롯
   [data-nav-mobile] : 모바일 햄버거 버튼
   FOUC 방지: 각 페이지 <head>의 인라인 스크립트가 html.dark 를 즉시 적용한다. */
(function () {
  const NAV = [
    { href: '/', label: '대시보드' },
    { href: '/weekly', label: '위클리 픽' },
    { href: '/explore', label: '검색' },
    { href: '/company', label: '기업' },
  ];

  let path = location.pathname;
  if (path === '/index.html') path = '/';

  function isActive(href) {
    const p = href.split('?')[0];
    return p === '/' ? path === '/' : path === p || path.startsWith(p + '/');
  }

  /* ── nav 링크 생성 ───────────────────────────── */
  let activated = false;
  const linkItems = NAV.map(function (n) {
    const on = !activated && isActive(n.href);
    if (on) activated = true;
    const cls = on
      ? 'text-sm font-semibold border-b border-current pb-0.5'
      : 'text-sm font-medium opacity-55 hover:opacity-100 transition-opacity pb-0.5';
    return '<a href="' + n.href + '" class="' + cls + '">' + n.label + '</a>';
  });

  function injectNavLinks() {
    const slot = document.querySelector('[data-nav-links]');
    if (!slot) return;
    slot.innerHTML = linkItems.join('');
  }

  /* ── 다크 모드 ───────────────────────────────── */
  // FOUC 방지용 초기 적용은 각 페이지 head 인라인 스크립트가 담당한다.
  // 여기서는 토글 버튼 상태를 항상 최신으로 유지하는 역할만 한다.
  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function moonIcon() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  function sunIcon() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }

  function updateToggleBtn(btn) {
    btn.innerHTML = isDark() ? sunIcon() : moonIcon();
    btn.setAttribute('aria-label', isDark() ? '라이트 모드로 전환' : '다크 모드로 전환');
    btn.title = isDark() ? '라이트 모드' : '다크 모드';
  }

  /* nav 는 다크 모드에서 라임 → 잉크로 바뀌므로(dark.css) 로고 파일도 함께 바꿔야 한다.
     예전에는 dark.css 가 `filter: invert(1)` 로 반전했는데, 그러면 H 자 오렌지 강조까지
     시안으로 뒤집혀 브랜드 색이 사라졌다(2026-08-31 사용자 지시). */
  function syncLogos() {
    if (typeof syncHancomLogos === 'function') syncHancomLogos();
  }

  /* ── footer 주입 ─────────────────────────────── */
  function injectFooter() {
    if (document.body.dataset.noFooter !== undefined) return;

    // footer를 항상 최하단에 고정 (body flex-col + main flex-1)
    // index.html은 자체 h-screen 레이아웃이 있어 스크롤 구조가 다름 → 제외
    var path = location.pathname;
    if (path !== '/' && path !== '/index.html') {
      document.body.style.cssText += ';display:flex;flex-direction:column;min-height:100vh';
      var directMain = document.querySelector('body > main');
      if (directMain) directMain.style.flex = '1';
    }

    const footer = document.createElement('footer');
    footer.className = 'bg-white border-t border-ink/8';

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'dark-toggle';
    toggleBtn.className = 'p-1.5 rounded-lg hover:bg-ink/10 transition-colors text-ink/60 hover:text-ink';
    updateToggleBtn(toggleBtn);
    toggleBtn.addEventListener('click', function () {
      const next = !isDark();
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('ax-dark', next ? '1' : '0');
      updateToggleBtn(toggleBtn);
      syncLogos();
    });

    const inner = document.createElement('div');
    inner.className = 'max-w-[1600px] mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3';

    const left = document.createElement('div');
    left.className = 'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/50';
    left.innerHTML =
      '<span class="font-display font-semibold text-sm text-ink">AX Biz Radar</span>' +
      '<span class="hidden sm:block w-px h-3 bg-ink/15"></span>' +
      '<span>Powered by AX사업기획실</span>' +
      '<span class="hidden sm:block w-px h-3 bg-ink/15"></span>' +
      '<span>© 2026 HANCOM. All rights reserved.</span>';

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2';
    right.appendChild(toggleBtn);

    const feedbackLink = document.createElement('a');
    feedbackLink.href = '/feedback';
    feedbackLink.className = 'inline-flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-ink transition-colors';
    feedbackLink.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      '</svg>' +
      '의견 보내기';
    right.appendChild(feedbackLink);

    inner.appendChild(left);
    inner.appendChild(right);

    const bar = document.createElement('div');
    bar.style.cssText = 'height:4px;background:#c8f200';

    footer.appendChild(bar);
    footer.appendChild(inner);
    document.body.appendChild(footer);
  }

  /* ── 모바일 드롭다운 ─────────────────────────── */
  function injectMobileMenu() {
    const btn = document.querySelector('[data-nav-mobile]');
    if (!btn) return;

    activated = false;
    const mobileItems = NAV.map(function (n) {
      const on = !activated && isActive(n.href);
      if (on) activated = true;
      const cls = on
        ? 'block px-4 py-2.5 rounded-xl text-sm font-bold bg-ink/15'
        : 'block px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-ink/10 transition-colors';
      return '<a href="' + n.href + '" class="' + cls + '">' + n.label + '</a>';
    }).join('');

    const menu = document.createElement('div');
    menu.id = 'nav-mobile-menu';
    menu.className = 'fixed left-0 right-0 z-30 px-4 py-3 space-y-1 border-b border-ink\/10';
    menu.style.cssText = 'display:none;background:rgba(200,242,0,.96);backdrop-filter:blur(12px)';
    menu.innerHTML = mobileItems;
    document.body.appendChild(menu);

    const hdr = document.querySelector('header, nav');
    menu.style.top = (hdr ? hdr.offsetHeight : 64) + 'px';

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', function () {
      menu.style.display = 'none';
    });
  }

  function mount() {
    injectNavLinks();
    injectFooter();
    injectMobileMenu();
    syncLogos(); // footer 주입 뒤에 한 번 — 주입된 로고까지 함께 맞춘다
  }

  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
