/* AX Biz Radar News — 위클리 픽을 한 장씩 넘겨 보는 발행물 (2026-08-24 사용자 지시).
   상세 페이지(/weekly?w=)를 대체하지 않는 **별개 페이지**다. 같은 회차 데이터를 쓰고
   조판만 다르다 — 상세는 베이지 매거진 조판으로 세로로 읽고, 이 화면은 다크 슬라이드로 넘긴다.
   참고는 사용자가 준 인스타 캐러셀이며, 핵심은 모양이 아니라 **넘기는 동작**이다.

   기준 파일: weekly-preview-news.html (로컬 조판 검토용, 사이트로는 서빙되지 않음).

   전체를 즉시실행 함수로 감싼다 — util.js·api.js 와 같은 페이지에 로드되므로 전역에
   같은 이름이 생기면 const 재선언 SyntaxError 로 페이지 전체가 죽는다(weekly.js 의 pad2 사례). */
(function () {
  'use strict';

  /* 캐러셀 CSS 를 여기서 넣는다. 이 조판은 /news 와 상세 페이지의 겹쳐 띄우기 두 곳에서 쓰이므로
     스타일을 페이지마다 적어 두면 갈라진다. 클래스에 nw- 를 붙이는 것은 상세 페이지의
     .rule 같은 이름과 섞이지 않게 하려는 것이다.
     높이·폭은 쓰는 쪽이 --nw-h / --nw-col 로 정한다(전면 페이지와 겹쳐 띄우기의 여백이 다르다). */
  function ensureStyles() {
    if (document.getElementById('nw-style')) return;
    const el = document.createElement('style');
    el.id = 'nw-style';
    el.textContent = [
      '.nw-frame{width:min(100vw,var(--nw-col,620px));height:var(--nw-h,min(calc(100dvh - 152px),880px));margin:0 auto}',
      '.nw-bar{width:min(100vw,var(--nw-col,620px));margin:0 auto;padding-left:20px;padding-right:20px}',
      /* 넘기는 동작의 실체 — 가로 scroll-snap. 터치 스와이프와 트랙패드 가로 제스처가 별도 구현
         없이 동작하고, 키보드는 같은 스크롤을 호출한다. 드래그 물리를 직접 만들면 본문 세로
         스크롤과 텍스트 선택이 깨진다. */
      '.nw-track{display:flex;height:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;' +
        'overscroll-behavior-x:contain;scrollbar-width:none;-ms-overflow-style:none}',
      '.nw-track::-webkit-scrollbar{display:none}',
      '.nw-slide{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;display:flex;flex-direction:column;overflow:hidden}',
      /* 본문이 한 장에 안 들어가면 그 판만 세로로 흐른다. 세로 제스처는 이 안에서 먹고
         가로 제스처는 트랙으로 올라가므로 두 방향이 싸우지 않는다. */
      '.nw-scroll{overflow-y:auto;overscroll-behavior-y:contain;scrollbar-width:none;-ms-overflow-style:none}',
      '.nw-scroll::-webkit-scrollbar{display:none}',
      '.nw-hair{border-top:1px solid rgba(255,255,255,.10)}',
      // 아래로 더 있다는 신호. 끝에 닿으면 JS 가 nw-end 를 붙여 없앤다.
      '.nw-fade::after{content:"";position:absolute;left:0;right:0;bottom:0;height:44px;pointer-events:none;' +
        'background:linear-gradient(to top,#161616,rgba(22,22,22,0));transition:opacity .2s}',
      '.nw-fade.nw-end::after{opacity:0}',
    ].join('');
    document.head.appendChild(el);
  }

  const no2 = (n) => String(n).padStart(2, '0');
  const weekTitle = (label) => { const s = String(label || '').replace(/^\d{4}년\s*/, ''); return s ? s + '차' : ''; };
  const mdSlash = (d) => (d && d.length >= 10 ? +d.slice(5, 7) + '/' + +d.slice(8, 10) : '');
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
       슬라이드 경계를 만든다. 비주얼 판까지 어두우면 장이 넘어간 것이 안 보인다.
     line·dot·hub 는 아래 관계망 도형 색이다. SVG 속성이라 Tailwind 클래스가 아닌 실색으로 둔다. */
  const SKINS = [
    { bg: 'bg-lime',  line: 'rgba(17,17,17,.20)',   dot: 'rgba(17,17,17,.38)',  hub: '#111' },
    { bg: 'bg-white', line: 'rgba(123,165,0,.40)',  dot: 'rgba(123,165,0,.62)', hub: '#111' },
    { bg: 'bg-beige', line: 'rgba(17,17,17,.16)',   dot: 'rgba(123,165,0,.75)', hub: '#111' },
  ];

  /* 같은 픽은 늘 같은 모양이 나와야 한다(회차를 다시 열었을 때 그림이 바뀌면 다른 글로 읽힌다).
     그래서 난수를 쓰지 않고 픽 식별값에서 씨앗을 뽑아 고정한다. */
  function seedOf(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngOf(seed) {
    let a = seed || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 사진이 없을 때 비주얼 판에 깔리는 도형. **활자를 넣지 않는다** —
     기업명·제목·순번은 모두 바로 아래 텍스트 판에 있어 두 번 읽히면 안 된다(2026-08-24 사용자 지시).
     모티프는 대시보드의 지식 그래프 노드-링크 관계망이다(CLAUDE.md 확정 요소).
     각 노드를 「가장 가까운 앞선 노드」에 이어 끊긴 점이 없게 하고, 여분 연결 몇 개로 망처럼 보이게 한다. */
  function graphArt(seedStr, sk) {
    const rnd = rngOf(seedOf(seedStr));
    const W = 620, H = 300;
    const n = 11 + Math.floor(rnd() * 4);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([30 + rnd() * (W - 60), 28 + rnd() * (H - 56)]);

    const r1 = (v) => Math.round(v * 10) / 10;
    let lines = '';
    for (let i = 1; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < i; j++) {
        const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = j; }
      }
      lines += '<line x1="' + r1(pts[i][0]) + '" y1="' + r1(pts[i][1]) + '" x2="' + r1(pts[best][0]) + '" y2="' + r1(pts[best][1]) + '" />';
    }
    for (let k = 0; k < 3; k++) {
      const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n);
      if (a !== b) lines += '<line x1="' + r1(pts[a][0]) + '" y1="' + r1(pts[a][1]) + '" x2="' + r1(pts[b][0]) + '" y2="' + r1(pts[b][1]) + '" />';
    }

    const hub = Math.floor(rnd() * n);
    let dots = '';
    for (let i = 0; i < n; i++) {
      if (i === hub) continue;
      dots += '<circle cx="' + r1(pts[i][0]) + '" cy="' + r1(pts[i][1]) + '" r="' + r1(2.5 + rnd() * 3.5) + '" fill="' + sk.dot + '" />';
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" ' +
      'class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" focusable="false">' +
      '<g stroke="' + sk.line + '" stroke-width="1.25">' + lines + '</g>' + dots +
      // 허브 — 대시보드 그래프의 중앙 AX 노드와 같은 역할. 시선이 한 곳에 걸리게 한다.
      '<circle cx="' + r1(pts[hub][0]) + '" cy="' + r1(pts[hub][1]) + '" r="9" fill="' + sk.hub + '" />' +
      '<circle cx="' + r1(pts[hub][0]) + '" cy="' + r1(pts[hub][1]) + '" r="19" fill="none" stroke="' + sk.line + '" stroke-width="1.25" />' +
      '</svg>';
  }

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
    return '<div class="h-full bg-panel relative nw-fade flex flex-col">' +
      '<div class="nw-scroll flex-1 px-6 sm:px-7 pt-7 pb-12">' +
      '<div class="text-[10px] font-bold uppercase tracking-[.2em] text-lime mb-3">이번 주 흐름</div>' +
      (d.payload.overview
        ? '<p class="font-display font-medium text-[18px] sm:text-[20px] leading-[1.55] text-white/90">' + escapeHtml(d.payload.overview) + '</p>'
        : '<p class="text-[14px] text-white/40">금주 한 줄 요약이 비어 있습니다</p>') +

      /* 세로 얇은 선으로만 나눈다(상세 페이지의 수치 4칸과 같은 문법).
         gap-px 로 선을 만들면 셀 안 활자가 선에 붙어 읽기 나쁘다 — divide-x 로 선을 두고
         좌우 여백을 준다. 첫 칸은 왼쪽에 선이 없으므로 위 문단과 왼쪽을 맞춘다. */
      '<div class="mt-7 grid grid-cols-4 divide-x divide-white/10">' +
      [['동향', s.total || 0], ['기업', s.companies || 0], ['신규', (s.newCompanies || []).length], ['주목', s.picks || 0]]
        .map(function (kv, i) {
          return '<div class="' + (i === 0 ? 'pr-4' : 'px-4') + '">' +
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
  /* 판 머리 — 기업명·분류·날짜·로고. 사진 판과 도형 판이 같은 것을 쓴다(2026-08-24 사용자 지시).
     큰 제목은 얹지 않는다 — 바로 아래 헤드라인과 같은 문장이라 두 번 읽힌다.
     다크 배경에서는 로고를 반전한다(회차 커버와 같은 처리). */
  function panelHead(p, dark) {
    return '<div class="flex items-start justify-between gap-3">' +
      '<div class="min-w-0">' +
      '<div class="font-display font-bold text-[21px] sm:text-[24px] tracking-tight leading-none truncate">' + escapeHtml(p.company) + '</div>' +
      '<div class="text-[10px] font-bold uppercase tracking-widest ' + (dark ? 'text-white/75' : 'text-ink/55') + ' mt-1.5">' +
      escapeHtml([p.category, p.date].filter(Boolean).join(' · ')) + '</div></div>' +
      '<img src="/assets/HANCOM.png" alt="HANCOM" class="h-3.5 w-auto flex-none ' +
      (dark ? 'opacity-85 brightness-0 invert' : 'opacity-60') + '" /></div>';
  }

  /* 사진 판. 이미지 출처는 화면에 표기하지 않는다(2026-08-24 사용자 지시) — 관리자 입력에는
     여전히 필수라 기록은 회차 데이터에 남는다. 그늘은 머리 활자가 읽힐 만큼만 위에 넣고,
     아래는 다크 텍스트 판과 이어지도록 살짝만 어둡게 한다. */
  function photoPanel(p) {
    return '<div class="flex-none relative overflow-hidden bg-ink text-white" style="height:clamp(210px, 34%, 300px)">' +
      '<img src="/api/pick-image?k=' + encodeURIComponent(p.image.key) + '" alt="" loading="lazy" decoding="async" ' +
      'class="absolute inset-0 w-full h-full object-cover" style="object-position:' + (POS[p.image.pos] || 'center') + '" />' +
      '<div class="absolute inset-0" aria-hidden="true" style="background:linear-gradient(to bottom, rgba(0,0,0,.58), rgba(0,0,0,.06) 45%, rgba(0,0,0,.22))"></div>' +
      '<div class="relative h-full flex flex-col p-6">' + panelHead(p, true) + '</div></div>';
  }

  /* 사진이 없는 판 — 배색 + 관계망 도형 위에 같은 머리를 올린다.
     씨앗은 픽 식별값이라 같은 픽은 늘 같은 모양이고, 배색은 순번으로 순환해 장이 넘어간 것이 보인다. */
  function artPanel(p, i) {
    const s = SKINS[i % SKINS.length];
    const seed = p.key || (p.company + '|' + p.date + '|' + (p.title || ''));
    return '<div class="flex-none relative overflow-hidden ' + s.bg + ' text-ink" style="height:clamp(210px, 34%, 300px)">' +
      graphArt(seed, s) +
      '<div class="relative h-full flex flex-col p-6">' + panelHead(p, false) + '</div></div>';
  }

  /* 다크 텍스트 판 — 남는 높이를 다 쓰고 넘치면 이 판만 세로로 흐른다.
     하위 3항목을 접지 않는 것은 「단톡방에서 들어온 사람이 이 페이지만 읽고 끝낼 수 있어야
     한다」는 기존 결정을 지키기 위한 것이다(2026-08-21). 사진이 있든 없든 이 판은 같다. */
  function textPanel(p, i, issueNo) {
    const n = no2(i + 1);
    const src = safeUrl(p.sourceUrl), conf = safeUrl(p.confluenceUrl);
    const linkCls = 'font-semibold text-white/70 hover:text-lime underline underline-offset-2 decoration-white/20';

    // 상단 출처 표기는 두지 않는다(2026-08-24 사용자 지시) — 아래에 출처 기사 링크가 있어 겹친다.
    let h = '<div class="flex-1 min-h-0 bg-panel relative nw-fade">' +
      '<div class="nw-scroll h-full px-6 pt-5 pb-12">' +

      '<div class="flex items-center gap-2.5 min-w-0 mb-4">' +
      '<span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-display font-bold text-[14px] text-white/70 flex-none">' + n + '</span>' +
      '<span class="min-w-0 flex items-center gap-2 text-[11.5px]">' +
      '<span class="font-bold text-lime uppercase tracking-wider">AX News</span>' +
      '<span class="w-px h-3 bg-white/20"></span>' +
      '<span class="font-semibold text-white/80 truncate">' + escapeHtml(p.company) + '</span></span>' +
      '</div>';

    if (p.title)
      h += '<h2 class="font-display font-bold text-[26px] sm:text-[31px] leading-[1.15] tracking-tighter mb-4">' + escapeHtml(p.title) + '</h2>';

    // 「주목(Pick) 이유」 — 사람이 판단해 쓴 한 줄이라 이 판에서 가장 크게 읽혀야 한다.
    // 라벨을 붙이지 않으면 사실 요약으로 읽히므로 라임 한 줄로 표시한다.
    if (p.why)
      h += '<div class="mb-5">' +
        '<div class="text-[10px] font-bold uppercase tracking-widest text-lime mb-2">주목 이유</div>' +
        '<p class="text-[14.5px] leading-[1.72] text-white/85">' + escapeHtml(p.why) + '</p></div>';

    /* 하위 3항목 — 위계는 「주목 이유」보다 낮게 두되 읽을 수 있어야 한다(2026-08-24 사용자 지시).
       흰색 60%·12.5px 는 다크 배경에서 너무 흐려 읽히지 않았다. 라벨과 불릿을 함께 올린다. */
    const cols = BODY.filter(function (b) { return (p[b.k] || []).length; });
    if (cols.length)
      h += '<div class="nw-hair pt-4 space-y-4">' + cols.map(function (b) {
        return '<div><div class="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">' + b.label + '</div>' +
          '<ul class="space-y-2 text-[13.5px] leading-[1.75] text-white/85">' +
          p[b.k].map(function (x) {
            return '<li class="pl-3.5 relative"><span class="absolute left-0 top-[.6em] w-1 h-1 rounded-full bg-lime"></span>' +
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
      // 비주얼 판에서 활자를 뺐으므로 회차 표기를 여기로 옮긴다. 한 장만 캡처해도
      // 어느 회차인지 남게 하는 것이고, 표지 말고는 회차가 나오는 곳이 없어 중복이 아니다.
      '<span class="font-display font-bold text-[11px] tracking-[.18em] text-white/40 flex-none">AX BIZ RADAR' +
      (issueNo ? ' · No.' + no2(issueNo) : '') + '</span>' +
      '</div>';

    return h + '</div></div>';
  }

  function pickSlide(p, i, issueNo) {
    const visual = (p.image && p.image.key) ? photoPanel(p) : artPanel(p, i);
    return visual + textPanel(p, i, issueNo);
  }

  /* ===== 마지막 장: 한컴 관점 =====
     캐러셀의 마지막 장 자리다. 라임 반전이라 더 넘길 것이 없다는 신호가 된다.
     여기서 상세 페이지·목록으로 나가는 길을 준다. */
  function closing(d, s) {
    const items = (d.payload.hancomConclusion || []);
    const week = encodeURIComponent(d.week || '');
    return '<div class="h-full bg-lime text-ink flex flex-col">' +
      '<div class="nw-scroll flex-1 px-6 sm:px-7 pt-7 pb-7">' +
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
    ensureStyles();
    const s = d.stats || {};
    const picks = (d.payload && d.payload.picks) || [];
    const pages = [cover(d, s), intro(d, s, picks)]
      .concat(picks.map(function (p, i) { return pickSlide(p, i, d.issueNo); }))
      .concat([closing(d, s)]);

    root.innerHTML =
      (d.isPreview
        ? '<div class="nw-bar mb-3"><div class="bg-white text-ink text-[12px] font-bold px-3 py-2">발행 전 미리보기입니다. 이 화면은 아직 공개되지 않았습니다</div></div>'
        : '') +
      // 진행 세그먼트 — 스토리처럼 「몇 장 중 몇 번째」를 활자 없이 먼저 보여준다. 눌러서 이동도 된다.
      '<div id="nwSegs" class="nw-bar flex gap-1 mb-3"></div>' +
      '<div class="nw-frame"><div id="nwTrack" class="nw-track" tabindex="0" aria-roledescription="carousel"></div></div>' +
      // 하단 조작 줄 — 키보드·스와이프를 모르는 사람에게도 넘길 수단을 준다.
      '<div class="nw-bar mt-3 flex items-center gap-3">' +
      '<button type="button" id="nwPrev" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 flex items-center justify-center text-[15px]" aria-label="이전">&#8592;</button>' +
      '<button type="button" id="nwNext" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 flex items-center justify-center text-[15px]" aria-label="다음">&#8594;</button>' +
      '<div id="nwCounter" class="font-display font-bold text-[12px] tracking-widest text-white/50"></div>' +
      '<div class="ml-auto text-[10.5px] text-white/25 tracking-wide hidden sm:block">스와이프 · &#8592; &#8594; · space</div>' +
      '</div>';

    // root 안에서만 찾는다 — 상세 페이지의 겹쳐 띄우기에서도 쓰이므로 id 전역 조회를 하지 않는다.
    const track = root.querySelector('#nwTrack');
    const segs = root.querySelector('#nwSegs');
    const counter = root.querySelector('#nwCounter');
    const prev = root.querySelector('#nwPrev');
    const next = root.querySelector('#nwNext');

    /* 이 캐러셀이 사라질 때 붙인 것들을 같이 떼야 한다. 겹쳐 띄운 것을 닫은 뒤에도
       keydown 이 남아 있으면 상세 페이지에서 방향키가 가로채인다. */
    const ac = new AbortController();
    const sig = { signal: ac.signal };

    track.innerHTML = pages.map(function (h, i) {
      return '<section class="nw-slide" aria-label="' + (i + 1) + ' / ' + pages.length + '">' + h + '</section>';
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
    }, Object.assign({ passive: true }, sig));

    prev.addEventListener('click', function () { go(idx - 1); }, sig);
    next.addEventListener('click', function () { go(idx + 1); }, sig);
    segs.addEventListener('click', function (e) {
      const b = e.target.closest('[data-seg]');
      if (b) go(Number(b.dataset.seg));
    }, sig);
    track.addEventListener('click', function (e) {          // 목차 줄 → 해당 장
      const b = e.target.closest('[data-go]');
      if (b) go(Number(b.dataset.go));
    }, sig);

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
    }, sig);

    // 창 크기가 바뀌면 칸 폭도 바뀐다. 현재 장을 다시 정렬하지 않으면 두 장이 반쯤 걸쳐 보인다.
    window.addEventListener('resize', function () { go(idx, false); }, sig);

    // 「아래로 더 있음」 그림자는 끝에 닿으면 지운다.
    const boxes = track.querySelectorAll('.nw-fade');
    for (let i = 0; i < boxes.length; i++) {
      (function (box) {
        const sc = box.querySelector('.nw-scroll');
        if (!sc) return;
        const check = function () {
          box.classList.toggle('nw-end', !(sc.scrollHeight - sc.clientHeight - sc.scrollTop > 8));
        };
        sc.addEventListener('scroll', check, Object.assign({ passive: true }, sig));
        window.addEventListener('resize', check, sig);
        setTimeout(check, 50);    // 웹폰트가 붙으면서 높이가 바뀐 뒤 다시 잰다
        setTimeout(check, 600);
      })(boxes[i]);
    }

    paint();
    return { destroy: function () { ac.abort(); } };
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

  const notice = (html) => '<div class="nw-bar text-center text-sm text-white/60 py-16">' + html + '</div>';

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

  /* ===== 상세 페이지에 붙이는 표지 썸네일 =====
     상세 페이지(/weekly?w=)에서 이것을 눌러 캐러셀을 겹쳐 띄운다(2026-08-24 사용자 지시).
     첫 장(표지)을 줄인 것이며, 실제 표지를 transform 으로 축소하지 않고 같은 어휘의 압축 조판을
     따로 쓴다 — 620px 조판을 그대로 줄이면 이 폭에서 활자가 뭉개지고 여백만 남는다.
     이 마크업이 여기 있는 이유: 뉴스레터의 모습은 이 파일 한 곳에서만 정한다. */
  function coverThumbHTML(d, s) {
    const tags = (s.topTags || []).slice(0, 3).map((t) => '#' + escapeHtml(t.tag)).join(' ');
    return '<button type="button" data-nw-open class="group block w-[150px] sm:w-[190px] flex-none text-left ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink" ' +
      'aria-label="뉴스레터 슬라이드로 크게 보기">' +
      '<div class="relative aspect-[4/5] overflow-hidden bg-lime text-ink shadow-lg shadow-ink/10 ' +
      'transition-transform group-hover:-translate-y-0.5">' +
      (d.issueNo ? '<span aria-hidden="true" class="pointer-events-none absolute -right-2 -bottom-5 font-display font-bold leading-none tracking-tighter text-[72px] text-ink/[.08]">' + no2(d.issueNo) + '</span>' : '') +
      '<div class="relative h-full flex flex-col p-3 sm:p-3.5">' +

      '<div class="flex items-center gap-1">' +
      '<img src="/assets/HANCOM.png" alt="" class="h-2 w-auto" />' +
      '<span class="w-px h-1.5 bg-ink/25"></span>' +
      '<span class="font-display font-bold text-[5.5px] sm:text-[6.5px] uppercase tracking-[.16em]">AX Biz Radar News</span>' +
      (d.issueNo ? '<span class="ml-auto font-display font-bold text-[5.5px] sm:text-[6.5px] tracking-widest">No.' + no2(d.issueNo) + '</span>' : '') +
      '</div>' +

      '<div class="relative mt-auto">' +
      '<div class="font-display font-bold text-[17px] sm:text-[21px] leading-[.95] tracking-tighter">' + escapeHtml(weekTitle(d.label)) + '</div>' +
      '<div class="mt-1 text-[6px] sm:text-[7px] font-semibold text-ink/55">' + escapeHtml(mdSlash(d.start) + ' ~ ' + mdSlash(d.end)) +
      (d.publishedAt ? ' · 발행 ' + escapeHtml(String(d.publishedAt).slice(0, 10)) : '') + '</div>' +
      '<div class="mt-2 pt-1.5 border-t border-ink/20 flex flex-wrap gap-x-1.5 text-[6px] sm:text-[7px] font-semibold text-ink/65">' +
      '<span>동향 ' + (s.total || 0) + '</span><span>기업 ' + (s.companies || 0) + '</span>' +
      '<span class="text-ink">주목 ' + (s.picks || 0) + '</span></div>' +
      (tags ? '<div class="mt-1.5 text-[6px] sm:text-[6.5px] font-semibold text-ink/40 truncate">' + tags + '</div>' : '') +
      '</div></div></div>' +
      // 눌러서 커진다는 것을 알려 주는 줄. 썸네일만 두면 그림으로 읽히고 아무도 누르지 않는다.
      '<div class="mt-2 flex items-center gap-1 text-[11px] font-semibold text-lime-600 group-hover:text-ink">' +
      '<span>슬라이드로 크게 보기</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 flex-none">' +
      '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg></div>' +
      '</button>';
  }

  /* 상세 페이지가 쓰는 창구. 뉴스레터 조판을 그 페이지로 가져가는 유일한 경로다. */
  window.AXNews = { mount: mount, coverThumbHTML: coverThumbHTML, ensureStyles: ensureStyles };

  document.addEventListener('DOMContentLoaded', init);
})();
