/* AX Biz Radar News — 위클리 픽을 한 장씩 넘겨 보는 발행물 (2026-08-24 사용자 지시).
   상세 페이지(/weekly?w=)를 대체하지 않는 **별개 페이지**다. 같은 회차 데이터를 쓰고
   조판만 다르다 — 상세는 베이지 매거진 조판으로 세로로 읽고, 이 화면은 다크 슬라이드로 넘긴다.
   참고는 사용자가 준 인스타 캐러셀이며, 핵심은 모양이 아니라 **넘기는 동작**이다.

   기준 파일: weekly-preview-news.html (로컬 조판 검토용, 사이트로는 서빙되지 않음).

   전체를 즉시실행 함수로 감싼다 — util.js·api.js 와 같은 페이지에 로드되므로 전역에
   같은 이름이 생기면 const 재선언 SyntaxError 로 페이지 전체가 죽는다(weekly.js 의 pad2 사례). */
(function () {
  'use strict';

  const no2 = (n) => String(n).padStart(2, '0');
  const weekTitle = (label) => { const s = String(label || '').replace(/^\d{4}년\s*/, ''); return s ? s + '차' : ''; };
  const mdSlash = (d) => (d && d.length >= 10 ? +d.slice(5, 7) + '/' + +d.slice(8, 10) : '');
  // 출처 표기는 sourceUrl 의 호스트에서 끌어낸다 — 새 입력을 만들지 않기 위한 것이다.
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  // 서버에서 top·center·bottom 으로 좁혀 두었지만 화면에서도 흰 목록으로 받는다.
  const POS = { top: 'top', center: 'center', bottom: 'bottom' };

  // 본문 세 카테고리. 상세 페이지와 같은 순서·이름을 쓴다(사실 → 해석 → 판단).
  const BODY = [
    { k: 'keyPoints', label: '주요 내용' },
    { k: 'implications', label: '시사점' },
    { k: 'hancomInsight', label: '한컴 인사이트' },
  ];

  /* 비주얼 판 배색 3종을 순번으로 순환한다.
     ⚠ 셋 다 밝은 계열로 둔다 — 아래 텍스트 판이 다크이므로 「밝은 위 / 어두운 아래」 분할이
       슬라이드 경계를 만든다. 비주얼 판까지 어두우면 장이 넘어간 것이 안 보인다. */
  const SKINS = [
    { bg: 'bg-lime',  fg: 'text-ink', sub: 'text-ink/55', rule: 'border-ink/20', num: 'text-ink/[.10]' },
    { bg: 'bg-white', fg: 'text-ink', sub: 'text-ink/50', rule: 'border-ink/12', num: 'text-ink/[.07]' },
    { bg: 'bg-beige', fg: 'text-ink', sub: 'text-ink/50', rule: 'border-ink/12', num: 'text-lime-600/25' },
  ];

  /* ===== 1장: 표지 =====
     캐러셀은 첫 장에서 「무엇을 넘기게 되는가」를 말해야 한다. 라임 전면이라 넘기기 전에도
     회차 표지로 읽히고, /weekly 목록의 4:5 커버와 같은 어휘를 쓴다. */
  function cover(d, s) {
    const tags = (s.topTags || []).slice(0, 4).map((t) => '#' + escapeHtml(t.tag) + (t.isNew ? '(NEW)' : '')).join(' ');
    return '<div class="h-full bg-lime text-ink relative overflow-hidden flex flex-col p-7">' +
      (d.issueNo ? '<span aria-hidden="true" class="pointer-events-none absolute -right-6 -bottom-16 font-display font-bold leading-none tracking-tighter text-[220px] text-ink/[.07]">' + no2(d.issueNo) + '</span>' : '') +

      '<div class="relative flex items-center gap-2">' +
      '<img src="/assets/HANCOM.png" alt="HANCOM" class="h-4 w-auto" />' +
      '<span class="w-px h-3.5 bg-ink/25"></span>' +
      '<span class="font-display font-bold text-[11px] uppercase tracking-[.2em]">AX Biz Radar News</span>' +
      (d.issueNo ? '<span class="ml-auto font-display font-bold text-[11px] tracking-widest">No.' + no2(d.issueNo) + '</span>' : '') +
      '</div>' +

      '<div class="relative mt-auto">' +
      '<h1 class="font-display font-bold text-[52px] sm:text-[64px] leading-[.92] tracking-tighter">' + escapeHtml(weekTitle(d.label)) + '</h1>' +
      '<div class="mt-3 text-[12.5px] font-semibold text-ink/60">' + escapeHtml(mdSlash(d.start) + ' ~ ' + mdSlash(d.end)) +
      (d.publishedAt ? ' · 발행 ' + escapeHtml(String(d.publishedAt).slice(0, 10)) : '') + '</div>' +
      '<div class="mt-6 pt-4 border-t border-ink/20 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] font-semibold text-ink/70">' +
      '<span>동향 ' + (s.total || 0) + '건</span><span>기업 ' + (s.companies || 0) + '곳</span>' +
      '<span>신규 ' + ((s.newCompanies || []).length) + '곳</span>' +
      '<span class="text-ink">주목 ' + (s.picks || 0) + '건</span></div>' +
      (tags ? '<div class="mt-5 text-[11px] font-semibold text-ink/45">' + tags + '</div>' : '') +
      // 조작 안내는 첫 장에만 둔다. 두 번째 장부터는 이미 넘겨 본 사람이다.
      '<div class="mt-7 inline-flex items-center gap-2 text-[11px] font-bold text-ink/50">' +
      '<span class="px-2 py-1 rounded-full bg-ink/10">&#8592; &#8594;</span>' +
      '<span class="px-2 py-1 rounded-full bg-ink/10">space</span>' +
      '<span>또는 스와이프로 넘기기</span></div>' +
      '</div></div>';
  }

  /* ===== 2장: 이번 주 흐름 =====
     발행물은 「이번 호에 무엇이 들었는가」를 먼저 말한다. 목차 줄을 누르면 그 장으로 건너뛴다
     — 캐러셀에서는 스크롤 끝을 짐작할 수 없어 이 목차가 그 역할을 대신한다. */
  function intro(d, s, picks) {
    const tags = (s.topTags || []).slice(0, 4).map((t) => '#' + escapeHtml(t.tag) + (t.isNew ? '(NEW)' : '')).join(' ');
    return '<div class="h-full bg-panel relative fade-b flex flex-col">' +
      '<div class="scroller flex-1 px-6 sm:px-7 pt-7 pb-12">' +
      '<div class="text-[10px] font-bold uppercase tracking-[.2em] text-lime mb-3">이번 주 흐름</div>' +
      (d.payload.overview
        ? '<p class="font-display font-medium text-[18px] sm:text-[20px] leading-[1.55] text-white/90">' + escapeHtml(d.payload.overview) + '</p>'
        : '<p class="text-[14px] text-white/40">금주 한 줄 요약이 비어 있습니다</p>') +

      '<div class="mt-7 grid grid-cols-4 gap-px bg-white/10">' +
      [['동향', s.total || 0], ['기업', s.companies || 0], ['신규', (s.newCompanies || []).length], ['주목', s.picks || 0]]
        .map(function (kv) {
          return '<div class="bg-panel pt-3 pb-1.5">' +
            '<div class="font-display font-bold text-[24px] leading-none tracking-tighter">' + kv[1] + '</div>' +
            '<div class="text-[9px] font-bold uppercase tracking-widest text-white/35 mt-1.5">' + kv[0] + '</div></div>';
        }).join('') +
      '</div>' +
      (tags ? '<div class="mt-4 text-[11px] text-white/35">' + tags + '</div>' : '') +

      '<div class="mt-7 text-[10px] font-bold uppercase tracking-[.2em] text-white/30 mb-1">이번 호 주목 동향</div>' +
      '<div>' + picks.map(function (p, i) {
        return '<button type="button" data-go="' + (i + 2) + '" class="w-full text-left flex items-baseline gap-3 py-2.5 border-b border-white/[.07] hover:bg-white/[.04] transition-colors">' +
          '<span class="font-display font-bold text-[11px] text-lime w-5 flex-none">' + no2(i + 1) + '</span>' +
          '<span class="font-display font-bold text-[14.5px] tracking-tight flex-none">' + escapeHtml(p.company) + '</span>' +
          '<span class="text-[11.5px] text-white/40 truncate flex-1">' + escapeHtml(p.title || '') + '</span></button>';
      }).join('') +
      '</div></div></div>';
  }

  /* ===== 픽 한 장 =====
     위 비주얼 판(밝음 또는 사진) + 아래 다크 텍스트 판. 비주얼 판이 두 갈래다.
     · 관리자가 이미지를 올린 항목 → 사진이 판을 채우고 활자를 얹는다
     · 안 올린 항목 → 배색 판 + 제목 큰 활자. 이것이 기본 상태이며 사진은 선택이다 */
  function photoPanel(p, i, total, issueNo) {
    const n = no2(i + 1);
    return '<div class="flex-none relative overflow-hidden bg-ink text-white" style="height:clamp(210px, 34%, 300px)">' +
      '<img src="/api/pick-image?k=' + encodeURIComponent(p.image.key) + '" alt="" loading="lazy" decoding="async" ' +
      'class="absolute inset-0 w-full h-full object-cover" style="object-position:' + (POS[p.image.pos] || 'center') + '" />' +
      // 사진 위에 활자를 얹으려면 그늘이 필요하다. 밝은 사진에서도 읽히게 위아래로만 넣는다.
      '<div class="absolute inset-0" style="background:linear-gradient(to bottom, rgba(0,0,0,.55), rgba(0,0,0,.12) 45%, rgba(0,0,0,.72))"></div>' +
      '<div class="relative h-full flex flex-col p-6">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="min-w-0">' +
      '<div class="font-display font-bold text-[21px] sm:text-[24px] tracking-tight leading-none truncate">' + escapeHtml(p.company) + '</div>' +
      '<div class="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-1.5">' +
      escapeHtml([p.category, p.date].filter(Boolean).join(' · ')) + '</div></div>' +
      '<img src="/assets/HANCOM.png" alt="HANCOM" class="h-3.5 w-auto flex-none opacity-80" /></div>' +
      '<div class="mt-auto">' +
      '<div class="font-display font-bold text-[26px] leading-[1.15] tracking-tight max-w-[24ch]">' + escapeHtml(p.title || '') + '</div>' +
      '<div class="mt-3 pt-2.5 border-t border-white/25 flex items-baseline justify-between gap-3">' +
      '<span class="text-[10px] font-semibold uppercase tracking-[.18em] text-white/70">' +
      (issueNo ? 'Weekly Picks No.' + no2(issueNo) + ' — ' : '') + n + ' / ' + no2(total) + '</span>' +
      (p.image.credit ? '<span class="text-[9.5px] text-white/55 flex-none">이미지 ' + escapeHtml(p.image.credit) + '</span>' : '') +
      '</div></div></div></div>';
  }

  function colorPanel(p, i, total, issueNo) {
    const s = SKINS[i % SKINS.length];
    const n = no2(i + 1);
    return '<div class="flex-none relative overflow-hidden ' + s.bg + ' ' + s.fg + '" style="height:clamp(210px, 34%, 300px)">' +
      '<span aria-hidden="true" class="pointer-events-none absolute -right-4 -bottom-10 font-display font-bold leading-none tracking-tighter text-[150px] ' + s.num + '">' + n + '</span>' +
      '<div class="relative h-full flex flex-col p-6">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="min-w-0">' +
      '<div class="font-display font-bold text-[21px] sm:text-[24px] tracking-tight leading-none truncate">' + escapeHtml(p.company) + '</div>' +
      '<div class="text-[10px] font-bold uppercase tracking-widest ' + s.sub + ' mt-1.5">' +
      escapeHtml([p.category, p.date].filter(Boolean).join(' · ')) + '</div></div>' +
      '<img src="/assets/HANCOM.png" alt="HANCOM" class="h-3.5 w-auto flex-none opacity-60" /></div>' +
      // 사진이 없으면 제목을 큰 활자로 세운다 — 빈 판을 만들지 않는다.
      '<div class="mt-auto">' +
      '<div class="font-display font-bold text-[27px] leading-[1.15] tracking-tight max-w-[22ch]">' + escapeHtml(p.title || '') + '</div>' +
      '<div class="mt-4 pt-3 border-t ' + s.rule + ' text-[10px] font-semibold uppercase tracking-[.18em] ' + s.sub + '">' +
      (issueNo ? 'Weekly Picks No.' + no2(issueNo) + ' — ' : '') + n + ' / ' + no2(total) + '</div>' +
      '</div></div></div>';
  }

  /* 다크 텍스트 판 — 남는 높이를 다 쓰고 넘치면 이 판만 세로로 흐른다.
     하위 3항목을 접지 않는 것은 「단톡방에서 들어온 사람이 이 페이지만 읽고 끝낼 수 있어야
     한다」는 기존 결정을 지키기 위한 것이다(2026-08-21). 사진이 있든 없든 이 판은 같다. */
  function textPanel(p, i) {
    const n = no2(i + 1);
    const src = safeUrl(p.sourceUrl), conf = safeUrl(p.confluenceUrl);
    const source = hostOf(p.sourceUrl);
    const linkCls = 'font-semibold text-white/70 hover:text-lime underline underline-offset-2 decoration-white/20';

    let h = '<div class="flex-1 min-h-0 bg-panel relative fade-b">' +
      '<div class="scroller h-full px-6 pt-5 pb-12">' +

      '<div class="flex items-start justify-between gap-3 mb-4">' +
      '<div class="flex items-center gap-2.5 min-w-0">' +
      '<span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-display font-bold text-[14px] text-white/70 flex-none">' + n + '</span>' +
      '<span class="min-w-0 flex items-center gap-2 text-[11.5px]">' +
      '<span class="font-bold text-lime uppercase tracking-wider">AX News</span>' +
      '<span class="w-px h-3 bg-white/20"></span>' +
      '<span class="font-semibold text-white/80 truncate">' + escapeHtml(p.company) + '</span></span></div>' +
      (source ? '<span class="text-[10px] text-white/30 flex-none pt-1">출처 / ' + escapeHtml(source) + '</span>' : '') +
      '</div>';

    if (p.title)
      h += '<h2 class="font-display font-bold text-[26px] sm:text-[31px] leading-[1.15] tracking-tighter mb-4">' + escapeHtml(p.title) + '</h2>';

    // 「주목(Pick) 이유」 — 사람이 판단해 쓴 한 줄이라 이 판에서 가장 크게 읽혀야 한다.
    // 라벨을 붙이지 않으면 사실 요약으로 읽히므로 라임 한 줄로 표시한다.
    if (p.why)
      h += '<div class="mb-5">' +
        '<div class="text-[10px] font-bold uppercase tracking-widest text-lime mb-2">주목 이유</div>' +
        '<p class="text-[14.5px] leading-[1.72] text-white/85">' + escapeHtml(p.why) + '</p></div>';

    const cols = BODY.filter(function (b) { return (p[b.k] || []).length; });
    if (cols.length)
      h += '<div class="hair pt-4 space-y-4">' + cols.map(function (b) {
        return '<div><div class="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5">' + b.label + '</div>' +
          '<ul class="space-y-1.5 text-[12.5px] leading-[1.7] text-white/60">' +
          p[b.k].map(function (x) {
            return '<li class="pl-3 relative"><span class="absolute left-0 top-[.62em] w-1 h-1 rounded-full bg-white/25"></span>' +
              escapeHtml(x) + '</li>';
          }).join('') + '</ul></div>';
      }).join('') + '</div>';

    if ((p.tags || []).length)
      h += '<div class="mt-5 text-[11px] text-white/25">' + p.tags.map(function (t) { return '#' + escapeHtml(t); }).join(' ') + '</div>';

    h += '<div class="mt-4 flex items-end justify-between gap-3">' +
      '<div class="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">' +
      (src ? '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener noreferrer" class="' + linkCls + '">출처 기사 ↗</a>' : '') +
      (conf ? '<a href="' + escapeHtml(conf) + '" target="_blank" rel="noopener noreferrer" class="' + linkCls + '">상세 모니터링 ↗</a>' : '') +
      '</div>' +
      '<span class="font-display font-bold text-[11px] tracking-[.18em] text-white/40 flex-none">AX BIZ RADAR</span>' +
      '</div>';

    return h + '</div></div>';
  }

  function pickSlide(p, i, total, issueNo) {
    const visual = (p.image && p.image.key)
      ? photoPanel(p, i, total, issueNo)
      : colorPanel(p, i, total, issueNo);
    return visual + textPanel(p, i);
  }

  /* ===== 마지막 장: 한컴 관점 =====
     캐러셀의 마지막 장 자리다. 라임 반전이라 더 넘길 것이 없다는 신호가 된다.
     여기서 상세 페이지·목록으로 나가는 길을 준다. */
  function closing(d, s) {
    const items = (d.payload.hancomConclusion || []);
    const week = encodeURIComponent(d.week || '');
    return '<div class="h-full bg-lime text-ink flex flex-col">' +
      '<div class="scroller flex-1 px-6 sm:px-7 pt-7 pb-7">' +
      '<div class="text-[10px] font-bold uppercase tracking-[.2em] text-ink/50 mb-1">Conclusion</div>' +
      '<h2 class="font-display font-bold text-[30px] tracking-tighter leading-none mb-6">한컴 관점</h2>' +
      (items.length
        ? '<div class="space-y-4">' + items.map(function (x, i) {
          return '<div class="flex gap-3">' +
            '<span class="font-display font-bold text-[13px] text-ink/40 flex-none pt-1">' + no2(i + 1) + '</span>' +
            '<p class="text-[14px] leading-[1.7]">' + escapeHtml(x) + '</p></div>';
        }).join('') + '</div>'
        : '<p class="text-[14px] text-ink/50">한컴 관점이 비어 있습니다</p>') +
      '<div class="mt-7 pt-5 border-t border-ink/20 flex flex-col gap-2 text-[13px]">' +
      '<a href="/weekly?w=' + week + '" class="font-bold hover:underline">이 회차 상세로 보기 →</a>' +
      '<a href="/?date=' + encodeURIComponent(d.start || '') + '" class="font-bold hover:underline">금주 동향 ' + (s.total || 0) + '건 전체 →</a>' +
      '<a href="/weekly" class="font-semibold text-ink/55 hover:underline">전체 회차 →</a></div>' +
      '</div></div>';
  }

  /* ===== 조립 + 넘기기 ===== */
  function mount(root, d) {
    const s = d.stats || {};
    const picks = (d.payload && d.payload.picks) || [];
    const pages = [cover(d, s), intro(d, s, picks)]
      .concat(picks.map(function (p, i) { return pickSlide(p, i, picks.length, d.issueNo); }))
      .concat([closing(d, s)]);

    root.innerHTML =
      (d.isPreview
        ? '<div class="bar mb-3"><div class="bg-white text-ink text-[12px] font-bold px-3 py-2">발행 전 미리보기입니다. 이 화면은 아직 공개되지 않았습니다</div></div>'
        : '') +
      // 진행 세그먼트 — 스토리처럼 「몇 장 중 몇 번째」를 활자 없이 먼저 보여준다. 눌러서 이동도 된다.
      '<div id="nwSegs" class="bar flex gap-1 mb-3"></div>' +
      '<div class="frame"><div id="nwTrack" class="track" tabindex="0" aria-roledescription="carousel"></div></div>' +
      // 하단 조작 줄 — 키보드·스와이프를 모르는 사람에게도 넘길 수단을 준다.
      '<div class="bar mt-3 flex items-center gap-3">' +
      '<button type="button" id="nwPrev" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 flex items-center justify-center text-[15px]" aria-label="이전">&#8592;</button>' +
      '<button type="button" id="nwNext" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 flex items-center justify-center text-[15px]" aria-label="다음">&#8594;</button>' +
      '<div id="nwCounter" class="font-display font-bold text-[12px] tracking-widest text-white/50"></div>' +
      '<div class="ml-auto text-[10.5px] text-white/25 tracking-wide hidden sm:block">스와이프 · &#8592; &#8594; · space</div>' +
      '</div>';

    const track = document.getElementById('nwTrack');
    const segs = document.getElementById('nwSegs');
    const counter = document.getElementById('nwCounter');
    const prev = document.getElementById('nwPrev');
    const next = document.getElementById('nwNext');

    track.innerHTML = pages.map(function (h, i) {
      return '<section class="slide" aria-label="' + (i + 1) + ' / ' + pages.length + '">' + h + '</section>';
    }).join('');
    segs.innerHTML = pages.map(function (_, i) {
      return '<button type="button" data-seg="' + i + '" class="flex-1 h-[3px] rounded-full bg-white/15 hover:bg-white/30 transition-colors" aria-label="' + (i + 1) + '번째 장"></button>';
    }).join('');

    let idx = 0;
    function paint() {
      const list = segs.querySelectorAll('[data-seg]');
      for (let i = 0; i < list.length; i++) {
        list[i].className = 'flex-1 h-[3px] rounded-full transition-colors ' + (i === idx ? 'bg-lime' : 'bg-white/15 hover:bg-white/30');
      }
      counter.textContent = no2(idx + 1) + ' / ' + no2(pages.length);
      prev.disabled = idx === 0;
      next.disabled = idx === pages.length - 1;
    }
    // 넘기기 = 트랙을 한 칸 스크롤하는 것. 키보드·버튼·목차가 모두 이 한 곳을 지난다.
    function go(i, smooth) {
      idx = Math.max(0, Math.min(pages.length - 1, i));
      track.scrollTo({ left: idx * track.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
      paint();
    }

    // 스와이프·트랙패드로 넘긴 경우엔 스크롤 위치가 먼저 바뀌므로 거기서 순번을 되읽는다.
    let raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        const i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== idx) { idx = i; paint(); }
      });
    }, { passive: true });

    prev.addEventListener('click', function () { go(idx - 1); });
    next.addEventListener('click', function () { go(idx + 1); });
    segs.addEventListener('click', function (e) {
      const b = e.target.closest('[data-seg]');
      if (b) go(Number(b.dataset.seg));
    });
    track.addEventListener('click', function (e) {          // 목차 줄 → 해당 장
      const b = e.target.closest('[data-go]');
      if (b) go(Number(b.dataset.go));
    });

    /* 키보드. 세로(↑↓)는 넘기지 않고 본문 판 안에서 읽는 데 쓴다 — 가로와 세로의 역할을 섞지 않는다.
       preventDefault 를 하지 않으면 트랙이 브라우저 기본 스크롤로 한 번 더 움직여 두 장 넘어간다. */
    document.addEventListener('keydown', function (e) {
      if (e.target && e.target.matches && e.target.matches('input, textarea, select')) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); go(idx + 1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(idx - 1); }
      else if (e.code === 'Space' || k === ' ') { e.preventDefault(); go(idx + (e.shiftKey ? -1 : 1)); }
      else if (k === 'Home') { e.preventDefault(); go(0); }
      else if (k === 'End') { e.preventDefault(); go(pages.length - 1); }
    });

    // 창 크기가 바뀌면 칸 폭도 바뀐다. 현재 장을 다시 정렬하지 않으면 두 장이 반쯤 걸쳐 보인다.
    window.addEventListener('resize', function () { go(idx, false); });

    // 「아래로 더 있음」 그림자는 끝에 닿으면 지운다.
    const boxes = track.querySelectorAll('.fade-b');
    for (let i = 0; i < boxes.length; i++) {
      (function (box) {
        const sc = box.querySelector('.scroller');
        if (!sc) return;
        const check = function () {
          box.classList.toggle('at-end', !(sc.scrollHeight - sc.clientHeight - sc.scrollTop > 8));
        };
        sc.addEventListener('scroll', check, { passive: true });
        window.addEventListener('resize', check);
        setTimeout(check, 50);    // 웹폰트가 붙으면서 높이가 바뀐 뒤 다시 잰다
        setTimeout(check, 600);
      })(boxes[i]);
    }

    paint();
  }

  /* 초안 미리보기 응답을 발행본과 같은 모양으로 맞춘다(상세 페이지와 같은 처리). */
  function draftToEdition(d) {
    const picks = (d.payload && d.payload.picks) || [];
    return {
      available: true, isPreview: true,
      week: d.week, issueNo: d.issueNo, start: d.start, end: d.end, label: d.label, publishedAt: null,
      stats: Object.assign({}, d.stats, { picks: picks.length }),
      payload: {
        overview: (d.payload && d.payload.overview) || '',
        hancomConclusion: (d.payload && d.payload.hancomConclusion) || [],
        picks,
      },
    };
  }

  const notice = (html) => '<div class="bar text-center text-sm text-white/60 py-16">' + html + '</div>';

  async function init() {
    const root = document.getElementById('nwRoot');
    if (!root) return;
    const params = new URLSearchParams(location.search);
    const w = params.get('w') || '';
    const n = params.get('n') || '';
    const isPreview = params.get('draft') === '1' && !!w;

    let d;
    try {
      // w·n 이 없으면 최신 회차를 연다. 목록은 /weekly 가 담당하므로 여기서 목록을 그리지 않는다.
      d = isPreview ? draftToEdition(await API.weeklyPreview(w)) : await API.weekly(w, n);
    } catch (e) {
      root.innerHTML = notice(isPreview && e && e.status === 403
        ? '미리보기 권한이 없습니다. <a href="/admin/" class="text-lime font-semibold hover:underline">관리자 콘솔</a>의 [미리보기 ↗] 로 열어 주세요.'
        : '불러오지 못했습니다. <a href="/weekly" class="text-lime font-semibold hover:underline">전체 회차로</a>');
      return;
    }
    if (!d || !d.available) {
      root.innerHTML = notice('아직 발행된 회차가 없습니다. <a href="/weekly" class="text-lime font-semibold hover:underline">전체 회차로</a>');
      return;
    }

    mount(root, d);
    document.title = 'AX Biz Radar News' + (d.issueNo ? ' No.' + no2(d.issueNo) : '') +
      (d.label ? ' · ' + String(d.label).replace(/^\d{4}년\s*/, '') : '');
    // 상단 「상세로 →」 를 이 회차의 상세로 연결한다.
    const toDetail = document.getElementById('nwToDetail');
    if (toDetail && d.week) toDetail.href = '/weekly?w=' + encodeURIComponent(d.week) + (d.isPreview ? '&draft=1' : '');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
