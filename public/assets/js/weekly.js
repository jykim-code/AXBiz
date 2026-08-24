/* 위클리 픽 — 단톡방 주 1회 공유용 발행물 페이지.
   이름 근거: 대시보드 항목에 「한컴 인사이트」가 있어 「주간 인사이트」와 겹쳐 읽혔다(2026-08-21 사용자 지시).
   「픽」이 이 페이지의 정체(사람이 골라 이유를 붙인 것)를 그대로 말한다.

   조판은 F안 「매거진 인덱스」다(2026-08-21 사용자 선택, 기준 파일 weekly-preview-f.html).
   카드(그림자·라운드 박스)를 쓰지 않고 굵은 선·얇은 선·활자 위계로만 구분한다. 대시보드가
   카드 문법을 쓰는 것과 **의도적으로** 다르다 — 이 화면은 기업 축의 대시보드가 아니라 발행물이다.
   그래서 본문도 entry.js 의 entryDetailHTML(베이지·라임 박스)을 쓰지 않고 3열 목록으로 직접 그린다.

   순서: 헤더 → 금주 한 줄 요약 → 수치 4칸 → 기업 목차 → 한컴 관점 → 금주 한눈에 →
         픽 전체폭 섹션(짝수 다크 반전) → 전체 보기 → 푸터 → 지난 회차 */

const WRAP = 'max-w-[1000px] mx-auto px-5 sm:px-8';
const md = (d) => (d && d.length >= 10 ? +d.slice(5, 7) + '/' + +d.slice(8, 10) : '');
// 헤더 메타용 — '2026-08-17' → '2026.08.17' / '08.17'. 자리수를 고정해 두 날짜가 나란히 서게 한다.
const ymdDot = (d) => (d && d.length >= 10 ? d.slice(0, 4) + '.' + d.slice(5, 7) + '.' + d.slice(8, 10) : '');
const mdDot = (d) => (d && d.length >= 10 ? d.slice(5, 7) + '.' + d.slice(8, 10) : '');
const shortLabel = (label) => String(label || '').replace(/^\d{4}년\s*/, ''); // '2026년 8월 3주' → '8월 3주'
const weekTitle = (label) => { const s = shortLabel(label); return s ? s + '차' : ''; }; // → '8월 3주차'
// 회차·순번 2자리 표기. pad2 는 util.js 에 이미 있어 여기서 다시 선언하면 같은 페이지에서
// const 재선언 SyntaxError 가 나 페이지 전체가 죽는다 — 이름을 달리 둔다.
const no2 = (n) => String(n).padStart(2, '0');
const NEW_CO_MAX = 6; // 신규 편입 기업을 이만큼만 보이고 나머지는 토글로 펼친다

// 본문 세 카테고리. 대시보드와 같은 순서·이름을 쓴다(정보 성격의 위계: 사실 → 해석 → 판단).
const BODY = [
  { k: 'keyPoints', label: '주요 내용' },
  { k: 'implications', label: '시사점' },
  { k: 'hancomInsight', label: '한컴 인사이트' },
];

/* ===== 헤더 =====
   후보 C(2026-08-24 사용자 선택). 제목 아래 한 줄 메타로, 라임 라벨을 값 앞에 붙여
   무슨 날짜인지 바로 읽히게 한다. 상단을 가볍게 두고 본문(금주 한 줄 요약)을 빨리 보여준다.
   지난 시도: 맨 텍스트로 두면 제목에 딸린 부스러기로 보였고(→ 아이콘 칩, 되돌림),
   제목과 같은 행에 두는 것도 폐기했다. 칩·라운드 박스는 F안 조판이 쓰지 않는다.
   제목은 커버와 같은 「8월 3주차」 표기를 쓴다 — 연도는 아래 메타 줄에 그대로 있다. */
function headerHTML(d, s, pickCount) {
  const metaLabel = (t) => '<span class="text-[10px] font-bold uppercase tracking-widest text-lime-600 flex-none">' + t + '</span>';
  const metaValue = (t) => '<span class="font-display font-semibold">' + escapeHtml(t) + '</span>';
  const total = (s && s.total) || 0;
  // stats.picks 가 아니라 실제 렌더되는 픽 수를 받는다(statsHTML 주석 참고) —
  // 어긋난 값을 쓰면 픽을 전부 실은 주에도 「전체보기」가 뜬다.
  const picks = pickCount || 0;
  return '<div class="' + WRAP + ' pt-12">' +
    '<div class="text-[11px] font-bold uppercase tracking-[.2em] text-lime-600 mb-1.5">Weekly Picks' +
    (d.issueNo ? ' No.' + no2(d.issueNo) : '') + '</div>' +
    '<h1 class="text-[40px] sm:text-[52px] font-bold tracking-tighter leading-none mb-4">' +
    escapeHtml(weekTitle(d.label)) + '</h1>' +
    '<div class="rule pt-3 mb-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px]">' +
    metaLabel('집계') + metaValue(ymdDot(d.start) + ' – ' + mdDot(d.end)) +
    (d.publishedAt
      ? '<span class="w-px h-3 bg-ink/15 mx-1 flex-none"></span>' +
        metaLabel('발행') + metaValue(ymdDot(String(d.publishedAt).slice(0, 10)))
      : '') +
    /* 금주 동향 전체보기 — 발행 바로 오른쪽에 붙인다(2026-08-24 사용자 지시).
       ml-auto 로 행 끝까지 밀어 두었더니 바로 아래 표지 썸네일과 겹쳐 보였다.
       집계·발행과 같은 글씨 크기(행의 12.5px)를 그대로 쓰고 구분선만 같은 것으로 붙인다.
       발행물은 고른 것만 싣고 전체 목록은 그것을 담당하는 화면(대시보드)이 맡는다. */
    (total > picks
      ? '<span class="w-px h-3 bg-ink/15 mx-1 flex-none"></span>' +
        '<a href="/?date=' + encodeURIComponent(d.start || '') + '" class="group inline-flex items-center gap-1 flex-none">' +
        '<span class="font-semibold group-hover:text-lime-600">금주 동향 전체보기</span>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-lime-600 flex-none"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg></a>'
      : '') +
    // 마지막 </div> 로 WRAP 을 닫는다. 닫지 않으면 뒤따르는 모든 블록이 이 max-width 안에 들어가
    // 픽 섹션의 전체폭 다크 반전이 1000px 로 잘리고 좌우 패딩이 이중으로 걸린다.
    '</div></div>';
}

/* ===== 수치 =====
   기업 목차 바로 앞에 둔다(2026-08-21 사용자 지시). 박스·칩을 쓰지 않고 세로 얇은 선으로만
   나눈다 — 목차를 가로선으로 나누는 것과 같은 문법이다.
   전주 대비 증감은 쓰지 않는다: 데이터 수집일이 주마다 달라 증감이 시장 변화가 아니라 수집량
   차이를 보여 주는 경우가 있다(실측 -7건). stats.delta 는 서버가 계산하지만 화면에 쓰지 않는다. */
/* pickCount 는 stats.picks 가 아니라 **실제 렌더되는 payload.picks 의 개수**를 받는다.
   stats 는 발행 시점에 굳는데 payload 는 [저장]으로도 바뀌므로 stats.picks 를 그대로 쓰면
   화면에 실린 건수와 어긋난다(실측: 표시 2 / 실제 6). 렌더 대상에서 직접 세면 어긋날 수 없다. */
function statsHTML(s, pickCount) {
  return '<div class="rule pt-5 mb-10 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-ink/10">' +
    [['금주 동향', s.total || 0], ['등장 기업', s.companies || 0],
      ['신규 기업', (s.newCompanies || []).length], ['Weekly Picks', pickCount || 0]]
      .map(([k, v], i) => '<div class="' + (i === 0 ? 'sm:pr-6' : 'sm:px-6') + ' py-3 sm:py-0">' +
        '<div class="font-display font-bold text-[34px] sm:text-[40px] leading-none tracking-tighter">' + v + '</div>' +
        '<div class="text-[10px] font-semibold uppercase tracking-widest text-ink/40 mt-2">' + k + '</div></div>').join('') +
    '</div>';
}

/* ===== 기업 목차 — 무엇이 실렸는지 3초 안에 파악되게 ===== */
function indexHTML(picks) {
  return '<div class="rule pt-3">' + picks.map((p, i) =>
    '<a href="#wk' + i + '" class="group flex items-baseline gap-4 py-3.5 rule-thin first:border-t-0 hover:bg-lime/20 transition-colors">' +
    '<span class="font-display font-bold text-[13px] text-lime-600 w-6 flex-none">' + no2(i + 1) + '</span>' +
    '<span class="font-display font-bold text-[20px] sm:text-[24px] tracking-tight flex-none">' + escapeHtml(p.company) + '</span>' +
    '<span class="text-[13px] text-ink/55 hidden sm:block truncate flex-1">' + escapeHtml(p.title || '') + '</span>' +
    '<span class="text-[11px] text-ink/35 ml-auto flex-none">' + escapeHtml(p.date || '') + '</span></a>').join('') + '</div>';
}

/* ===== 한컴 관점 =====
   후보 K(2026-08-24 사용자 선택). 번호를 쓰지 않고 라임 좌측 바만 붙여 문장을 주인공으로 둔다.

   번호를 뺀 이유: 바로 아래 기업 목차도 01·02·03 을 쓰는데 두 번호의 성격이 다르다.
   목차의 번호는 픽 섹션의 큰 순번과 짝을 이루는 **기능**(눌러서 그 섹션으로 이동)이고,
   한컴 관점의 번호는 순서에 뜻이 없는 **장식**이었다. 그래서 목차가 번호를 지키고 이쪽이 뺀다.

   라임 좌측 바는 픽 섹션의 「주목(Pick) 이유」가 쓰는 장치와 같다 — 사람이 판단해 쓴 문장에는
   라임 바가 붙는다는 규칙이 페이지 전체에 생긴다.
   폐기한 조판: 라벨 왼쪽 / 문단 오른쪽 2열(결론이 그냥 쌓여 보임), 큰 번호 01·02·03(위 이유). */
function hancomHTML(items) {
  /* mb-10 이 필요하다: 총론을 목차 위로 올린 뒤 이 블록이 아래 여백 없이 끝나고 바로 목차의
     2px 굵은 선이 붙어, 마지막 결론의 라임 바가 그 선에 닿아 보였다(2026-08-24 사용자 지적).
     목차 쪽에 mt-10 을 주지 않는 이유는 한컴 관점이 없는 회차에서 수치 4칸의 mb-10 과 겹쳐
     간격이 두 배가 되기 때문이다. 형제 마진은 합쳐지므로 위쪽 간격은 40px 그대로다. */
  return '<div class="mt-10 mb-10 rule pt-4">' +
    '<div class="flex items-baseline justify-between gap-4 mb-5">' +
    '<div class="text-[11px] font-bold uppercase tracking-widest text-lime-600">한컴 관점</div>' +
    '<div class="text-[12px] text-ink/40">금주 픽에서 도출한 결론</div></div>' +
    '<div class="space-y-4 max-w-[66ch]">' +
    items.map((x) =>
      '<p class="text-[14.5px] sm:text-[15px] leading-[1.75] pl-4 border-l-2 border-lime">' +
      escapeHtml(x) + '</p>').join('') +
    '</div></div>';
}

const glanceRow = (label, content) =>
  '<div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-5 py-3 rule-thin first:border-t-0">' +
  '<div class="text-[10px] font-bold uppercase tracking-widest text-ink/35 sm:w-24 sm:flex-none sm:pt-1">' + escapeHtml(label) + '</div>' +
  '<div class="flex-1 min-w-0">' + content + '</div></div>';

// 4주 추이 — 막대 대신 숫자와 연결선. 선으로 구분하는 이 화면의 문법과 맞춘다.
function trendHTML(trend) {
  const t = (trend || []).filter((x) => x && x.start);
  if (t.length < 2) return '';
  return '<div class="flex items-center gap-2">' + t.map((x, i) => {
    const last = i === t.length - 1;
    return (i ? '<span class="w-5 border-t border-ink/20 flex-none"></span>' : '') +
      '<span class="font-display font-bold text-[15px] ' + (last ? 'text-ink' : 'text-ink/40') + '">' + (x.total || 0) +
      '<span class="block text-[9px] font-sans font-normal ' + (last ? 'text-ink/50' : 'text-ink/25') + ' mt-0.5">' +
      escapeHtml(md(x.start)) + '</span></span>';
  }).join('') + '</div>';
}

/* ===== 픽 — 전체폭 섹션. 짝수 섹션을 다크로 반전해 리듬을 만든다 ===== */
const EXT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 inline-block ml-0.5 -mt-0.5"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>';

/* 이미지는 관리자가 올린 것만 실린다(2026-08-24 사용자 지시) — 기사 사진을 자동으로
   가져오지 않는다. 없으면 이 밴드를 그리지 않는다. 그것이 지금 조판의 기본 상태이고,
   큰 순번 숫자가 이미 시각 요소 역할을 한다.

   사진은 12:5 판에 맞춰 싣는다(2026-08-24 사용자 지시로 원상복구).
   원본 비율·크기 그대로 두었더니 사진마다 크기와 세로 길이가 제각각이라 픽이 이어지는 조판이
   흐트러졌다. 판을 고정하면 순번·기업명·본문 3열이 매 픽에서 같은 자리에 온다.
   잘리는 기준은 서버에서 top·center·bottom 으로 좁혀 두었지만 화면에서도 흰 목록으로 받는다.
   판보다 작은 사진은 레터박스(옅은 베이지/흰색)로 메운다.
   이미지 출처는 화면에 표기하지 않는다(2026-08-24 사용자 지시). 관리자 입력에는 여전히
   필수라 기록은 회차 데이터에 남는다. */
const PICK_IMG_POS = { top: 'top', center: 'center', bottom: 'bottom' };

function pickImageHTML(p, dark) {
  const im = p.image;
  if (!im || !im.key) return '';
  return '<div class="mb-5">' +
    '<div class="w-full overflow-hidden ' + (dark ? 'bg-white/5' : 'bg-beige') + '" style="aspect-ratio:12/5">' +
    '<img src="/api/pick-image?k=' + encodeURIComponent(im.key) + '" alt="" loading="lazy" decoding="async" ' +
    'class="w-full h-full object-cover" style="object-position:' + (PICK_IMG_POS[im.pos] || 'center') + '" /></div>' +
    '</div>';
}

function pickHTML(p, i) {
  const dark = i % 2 === 1;
  const linkCls = 'underline underline-offset-2 ' + (dark ? 'decoration-white/30 hover:text-lime' : 'decoration-ink/25 hover:text-lime-600');
  const src = safeUrl(p.sourceUrl), conf = safeUrl(p.confluenceUrl);

  let h = '<section id="wk' + i + '" class="mt-12 py-10 ' + (dark ? 'bg-ink text-white' : '') + '">' +
    '<div class="' + WRAP + ' grid sm:grid-cols-[120px,1fr] gap-x-8">' +
    '<div class="font-display font-bold text-[72px] leading-none ' + (dark ? 'text-lime/30' : 'num-out') + '">' + no2(i + 1) + '</div>' +
    '<div>';

  h += pickImageHTML(p, dark);

  h += '<div class="flex items-baseline gap-3 mb-2">' +
    '<a href="/company?name=' + encodeURIComponent(p.company) + '" class="text-[28px] sm:text-[34px] font-display font-bold tracking-tight leading-none hover:text-lime-600">' +
    escapeHtml(p.company) + '</a>' +
    '<span class="text-[11px] ' + (dark ? 'text-white/45' : 'text-ink/40') + ' flex-none">' +
    escapeHtml([p.category, p.date].filter(Boolean).join(' · ')) + '</span></div>';

  if (p.title) h += '<p class="text-[17px] font-semibold leading-snug mb-4 max-w-[50ch]">' + escapeHtml(p.title) + '</p>';

  // 「주목(Pick) 이유」 — 이 페이지의 알맹이. 사람이 판단해 쓴 한 줄이며 대시보드에 없는 유일한 정보다.
  // 박스를 쓰지 않고 라임 좌측 바로 표시한다(카드 문법을 쓰지 않는다는 원칙).
  if (p.why)
    h += '<div class="mb-6 pl-4 border-l-2 border-lime max-w-[56ch]">' +
      '<div class="text-[10px] font-bold tracking-widest ' + (dark ? 'text-lime' : 'text-lime-600') + ' mb-1">주목(Pick) 이유</div>' +
      '<p class="text-[14px] leading-[1.75]">' + escapeHtml(p.why) + '</p></div>';

  // 본문 3열 — 항상 펼쳐 둔다. 단톡방에서 들어온 사람은 평소 대시보드를 보지 않으므로
  // 이 페이지만 읽고 끝낼 수 있어야 한다(2026-08-21 사용자 지시).
  const cols = BODY.filter((b) => (p[b.k] || []).length);
  if (cols.length)
    h += '<div class="grid sm:grid-cols-3 gap-x-6 gap-y-4">' + cols.map((b) =>
      '<div><div class="text-[10px] font-bold uppercase tracking-widest ' + (dark ? 'text-lime' : 'text-ink/35') + ' mb-1.5">' + b.label + '</div>' +
      '<ul class="space-y-1.5 text-[12.5px] leading-[1.7] ' + (dark ? 'text-white/75' : 'text-ink/80') + '">' +
      p[b.k].map((x) => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul></div>').join('') + '</div>';

  if ((p.tags || []).length)
    h += '<div class="text-[11px] ' + (dark ? 'text-white/30' : 'text-ink/35') + ' mt-4">' +
      p.tags.map((t) => '#' + escapeHtml(t)).join(' ') + '</div>';

  if (src || conf)
    h += '<div class="flex flex-wrap gap-x-5 gap-y-1 text-[12px] mt-3">' +
      (src ? '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener noreferrer" class="' + linkCls + '">출처 기사' + EXT_ICON + '</a>' : '') +
      (conf ? '<a href="' + escapeHtml(conf) + '" target="_blank" rel="noopener noreferrer" class="' + linkCls + '">상세 모니터링' + EXT_ICON + '</a>' : '') +
      '</div>';

  return h + '</div></div></section>';
}

/* ===== 지난 회차 ===== */
function prevHTML(prev) {
  if (!prev || !prev.length) return '';
  return '<div class="' + WRAP + ' mt-10 rule pt-4">' +
    '<div class="text-[10px] font-bold uppercase tracking-widest text-lime-600 mb-3">지난 회차</div>' +
    '<div class="space-y-1.5">' + prev.map((p) =>
      '<a href="/weekly?w=' + encodeURIComponent(p.week) + '" class="flex items-baseline gap-2.5 group">' +
      '<span class="font-display font-bold text-sm text-lime-600 flex-none w-10">' + (p.issueNo ? p.issueNo + '호' : '—') + '</span>' +
      '<span class="font-display font-semibold text-sm flex-none group-hover:text-lime-600">' + escapeHtml(shortLabel(p.label)) + '</span>' +
      '<span class="text-xs text-ink/50 truncate">' + escapeHtml(p.overview || '') + '</span>' +
      '<span class="text-[11px] text-ink/35 ml-auto flex-none">' + (p.total || 0) + '건</span></a>').join('') +
    '</div></div>';
}

/* ===== 회차 커버 (4:5 썸네일) =====
   회차가 인스타 피드처럼 쌓여 보이게 한다(2026-08-24 사용자 지시, 참고 instagram.com/ai_freaks.kr).
   사진을 쓰지 않고 활자·색만으로 만든다: 이미지 저장소(R2)가 없고, 매주 사진을 구하는 손이 늘고,
   대외 배포물에 타사 이미지를 얹는 판단을 매주 해야 한다. 카피도 고정 양식이라 매주 쓸 것이 없다.
   회차마다 달라 보이게 하는 것은 배색 3종 순환이며, 회차 번호로 결정하므로 같은 회차는 늘 같은 색이다.
   ⚠ 카톡 링크 미리보기(og:image)로는 쓸 수 없다 — OG 는 실제 PNG URL 이어야 하고 이것은 DOM 이다.
     그쪽은 래스터화(satori+resvg)가 필요해 Phase 2 로 둔다. */
// 색 역할: ink=상단 라벨 / accent=주차(가장 먼저 읽혀야 하는 것) / sub=브랜드 줄 / dim=수치·키워드.
// 라임 배경에서는 라임보다 튀는 악센트가 없으므로 accent 를 ink 로 두고 크기로만 위계를 만든다.
// 배경이 베이지(#f7f5f0)인 페이지 위에 놓이므로 베이지 커버는 쓰지 않는다(경계가 사라진다).
const SKINS = [
  { bg: 'bg-ink', ink: 'text-white', accent: 'text-lime', sub: 'text-white/70', dim: 'text-white/45',
    bar: 'bg-lime', rule: 'border-white/20', num: 'text-white/[.07]', invertLogo: true },
  { bg: 'bg-lime', ink: 'text-ink', accent: 'text-ink', sub: 'text-ink/60', dim: 'text-ink/50',
    bar: 'bg-ink', rule: 'border-ink/20', num: 'text-ink/[.09]', invertLogo: false },
  { bg: 'bg-white', ink: 'text-ink', accent: 'text-lime-600', sub: 'text-ink/75', dim: 'text-ink/45',
    bar: 'bg-lime', rule: 'border-ink/12', num: 'text-ink/[.06]', invertLogo: false },
];
const skinOf = (e) => SKINS[(Number.isInteger(e.issueNo) ? e.issueNo : 0) % SKINS.length];

function coverHTML(e) {
  const s = skinOf(e);
  // 어순은 공유 텍스트(「동향 20건 중 주목 3건」)와 맞춘다
  const meta = ['동향 ' + (e.total || 0) + '건', '주목 ' + (e.picks || 0) + '건'].join(' · ');
  return '<a href="/weekly?w=' + encodeURIComponent(e.week) + '" ' +
    'class="group relative block aspect-[4/5] overflow-hidden ' + s.bg + ' ' + s.ink +
    ' transition-transform duration-200 hover:-translate-y-1">' +

    // 큰 회차 번호 — 커버의 유일한 그래픽 요소. 활자로만 구분한다는 F안 문법을 커버에서도 잇는다.
    (e.issueNo
      ? '<span aria-hidden="true" class="pointer-events-none absolute -right-3 -bottom-10 font-display font-bold leading-none ' +
        'text-[120px] sm:text-[150px] md:text-[170px] tracking-tighter ' + s.num + '">' + no2(e.issueNo) + '</span>'
      : '') +

    '<div class="relative h-full flex flex-col p-4 sm:p-5">' +

    // 상단 — 라벨 / 로고
    '<div class="flex items-start justify-between gap-2">' +
    '<div class="flex items-center gap-1.5 min-w-0">' +
    '<span class="w-[3px] h-3 ' + s.bar + ' flex-none"></span>' +
    '<span class="font-display font-bold text-[9px] sm:text-[10px] uppercase tracking-[.16em] truncate">Weekly Picks' +
    (e.issueNo ? ' No.' + no2(e.issueNo) : '') + '</span></div>' +
    '<img src="/assets/HANCOM.png" alt="HANCOM" class="h-3 sm:h-3.5 w-auto flex-none opacity-70' +
    (s.invertLogo ? ' brightness-0 invert' : '') + '" />' +
    '</div>' +

    // 하단 — 헤드라인 + 수치. 회차를 가르는 정보는 주차 하나뿐이라 그것만 크게 띄우고
    // 브랜드 줄은 한 단계 작게 둔다. 좁은 화면(320px 2열)에서 브랜드 줄이 접혀도 읽히게 하려는 것이며,
    // 셋을 같은 크기로 쌓으면 그 폭에서 「AX Biz Radar」가 어중간하게 잘린다.
    '<div class="mt-auto">' +
    '<h3 class="font-display font-bold tracking-tighter leading-[1.08]">' +
    '<span class="block text-[21px] sm:text-[26px] md:text-[30px] ' + s.accent + '">' +
    escapeHtml(weekTitle(e.label)) + '</span>' +
    '<span class="block mt-0.5 text-[13px] sm:text-[16px] md:text-[18px] ' + s.sub + '">AX Biz Radar News</span>' +
    '</h3>' +
    '<div class="mt-3 pt-2.5 border-t ' + s.rule + ' text-[10px] sm:text-[11px] ' + s.dim + ' leading-relaxed">' +
    escapeHtml(meta) +
    ((e.topTags || []).length
      ? '<div class="truncate mt-0.5">' + e.topTags.map((t) => '#' + escapeHtml(t)).join(' ') + '</div>'
      : '') +
    '</div></div></div></a>';
}

/* ===== 「발행 예정」 커버 =====
   회차가 아직 한둘이라 그리드가 비어 보이는 것을 다음 회차 자리로 메운다(2026-08-24 사용자 지시).
   어느 주가 예정인지는 서버가 정한다(`upcoming`) — 오늘이 속한 주이며, 그 주가 이미 발행됐으면
   내려오지 않는다. 주차 라벨을 화면에서 다시 계산하지 않는 이유는 서버 weekLabel 과 어긋나면
   같은 주가 두 이름으로 보이기 때문이다.

   조판으로 「아직 아닌 것」을 말한다: 배색 3종(ink·라임·흰)을 쓰지 않고 점선 테두리 + 베이지
   바탕만 둔다. 색을 주면 발행된 회차와 나란히 놓였을 때 눌러도 되는 것으로 읽힌다.
   `<a>` 가 아니라 `<div>` 인 이유도 같다 — 갈 곳이 없다.
   베이지 커버를 쓰지 않는다는 원칙(경계가 사라진다)의 예외이며, 여기서는 점선이 그 경계를 대신한다.
   회차 번호는 발행 시점에 붙으므로 쓰지 않는다. 이 자리를 지키는 정보는 주차 하나다. */
function upcomingCoverHTML(u) {
  if (!u || !u.label) return '';
  const range = u.start && u.end ? md(u.start) + ' ~ ' + md(u.end) : '';
  return '<div class="relative aspect-[4/5] overflow-hidden bg-beige border-2 border-dashed border-ink/20 text-ink">' +
    '<div class="relative h-full flex flex-col p-4 sm:p-5">' +

    // 상단 — 발행된 커버의 「Weekly Picks No.xx」 자리에 상태를 넣는다. 여기서 가장 먼저
    // 읽혀야 하는 것은 회차 이름이 아니라 아직 나오지 않았다는 사실이다.
    '<div class="flex items-start justify-between gap-2">' +
    '<div class="flex items-center gap-1.5 min-w-0">' +
    '<span class="w-[3px] h-3 bg-ink/25 flex-none"></span>' +
    '<span class="font-display font-bold text-[9px] sm:text-[10px] uppercase tracking-[.16em] truncate text-ink/45">Coming soon</span>' +
    '</div>' +
    '<img src="/assets/HANCOM.png" alt="HANCOM" class="h-3 sm:h-3.5 w-auto flex-none opacity-30" />' +
    '</div>' +

    // 하단 — 발행된 커버와 같은 위계(주차 크게 / 브랜드 줄 한 단계 작게)를 쓰되 톤을 낮춘다
    '<div class="mt-auto">' +
    '<h3 class="font-display font-bold tracking-tighter leading-[1.08]">' +
    '<span class="block text-[21px] sm:text-[26px] md:text-[30px] text-ink/70">' +
    escapeHtml(weekTitle(u.label)) + '</span>' +
    '<span class="block mt-0.5 text-[13px] sm:text-[16px] md:text-[18px] text-ink/35">AX Biz Radar News</span>' +
    '</h3>' +
    '<div class="mt-3 pt-2.5 border-t border-dashed border-ink/20 text-[10px] sm:text-[11px] text-ink/40 leading-relaxed">' +
    escapeHtml([range, '발행 예정'].filter(Boolean).join(' · ')) +
    '</div></div></div></div>';
}

/* ===== 목록 `/weekly` — 발행 회차 썸네일 =====
   단톡방에 뿌리는 링크는 늘 `?w=` 가 붙으므로(웹훅 메시지) 이 화면은 공유 도착지가 아니라
   사이드바·대시보드에서 들어오는 「둘러보기」 입구다. 그래서 최신 회차 본문을 바로 펴지 않고
   회차가 쌓인 것을 보여 준 뒤 최신 회차로 들여보낸다. */
function renderList(editions, upcoming) {
  const latest = editions[0];
  let h = '<div class="' + WRAP + ' pt-12">' +
    '<div class="text-[11px] font-bold uppercase tracking-[.2em] text-lime-600 mb-2">Weekly Picks</div>' +
    '<h1 class="text-[40px] sm:text-[52px] font-bold tracking-tighter leading-none mb-3">위클리 픽</h1>' +
    // 서비스 설명 한 줄(2026-08-24 사용자 확정). weekly.html 의 meta·og description 과 같은 문구를 쓴다.
    '<p class="text-[14px] text-ink/55 leading-relaxed max-w-[46ch]">' +
    '한 주의 AX 동향 중 주요 이슈를 Pick해 공유하는 Weekly Picks</p>';

  if (latest) {
    /* 최신 회차 직행. 요약(금주 한 줄 요약)은 싣지 않는다(2026-08-24 사용자 지시) —
       바로 아래 커버 그리드가 이미 어느 회차인지 말하고, 요약은 상세에서 가장 큰 활자로 나온다. */
    h += '<div class="mt-8 rule pt-4">' +
      '<a href="/weekly?w=' + encodeURIComponent(latest.week) + '" class="font-display font-bold text-[15px] hover:text-lime-600">' +
      '최신 ' + (latest.issueNo ? no2(latest.issueNo) + '호 · ' : '') + escapeHtml(weekTitle(latest.label)) + ' 읽기 →</a>' +
      '</div>';
  }
  h += '</div>';

  if (!editions.length) {
    return h + '<div class="' + WRAP + ' mt-10"><div class="rule pt-6">' +
      '<p class="font-display font-bold text-[24px] tracking-tight mb-2">아직 발행된 회차가 없습니다</p>' +
      '<p class="text-sm text-ink/55">첫 회차가 발행되면 이 목록에 쌓입니다</p>' +
      '<div class="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-[14px]">' +
      '<a href="/" class="font-semibold hover:text-lime-600">대시보드 →</a>' +
      '<a href="/explore" class="font-semibold hover:text-lime-600">자료 검색 →</a></div>' +
      '</div></div><div class="h-14"></div>';
  }

  h += '<div class="' + WRAP + ' mt-10">' +
    // 예정 자리는 맨 앞이다 — 목록이 최신 순이고, 예정 회차가 그 중 가장 최신이다
    '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">' +
    upcomingCoverHTML(upcoming) + editions.map(coverHTML).join('') + '</div>' +
    '<div class="mt-10 rule-thin pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">' +
    '<a href="/company" class="font-semibold hover:text-lime-600">기업 찾아보기 →</a>' +
    '<a href="/explore" class="font-semibold hover:text-lime-600">자료 검색 →</a>' +
    '<a href="/" class="text-ink/45 hover:text-lime-600">대시보드 →</a></div>' +
    '</div>';
  return h + '<div class="h-14"></div>';
}

/* ===== 공유 텍스트 =====
   단톡방에서 실제로 읽히는 것은 붙여넣은 텍스트다(링크 클릭률은 낮다).
   「주목(Pick) 이유」가 그대로 → 줄로 들어가 관리자가 쓴 한 줄이 페이지와 텍스트 양쪽을 채운다.
   버튼은 관리자 화면에만 있고(2026-08-21 사용자 지시) 이 함수는 그쪽에서 호출한다. */

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* 클립보드 API 미허용 환경(구형 브라우저·비보안 컨텍스트) 폴백 */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/* ===== 발행본 렌더 ===== */
function renderEdition(d) {
  const s = d.stats || {}, p = d.payload || {};
  const picks = p.picks || [];
  let h = headerHTML(d, s, picks.length);

  h += '<div class="' + WRAP + '">';

  /* 금주 한 줄 요약(이 페이지에서 가장 큰 본문 활자) 옆에 뉴스레터 표지 썸네일을 둔다
     (2026-08-24 사용자 지시). 누르면 페이지를 옮기지 않고 이 화면 위에 캐러셀을 겹쳐 띄운다 —
     상세를 읽던 자리를 잃지 않게 하려는 것이다. 조판은 news.js 에서 가져온다.
     좁은 화면에서는 순서를 뒤집어 썸네일이 요약 위에 오게 한다(위쪽에 두라는 지시를 지킨다). */
  const thumb = (window.AXNews && picks.length) ? window.AXNews.coverThumbHTML(d, s) : '';
  if (p.overview || thumb)
    h += '<div class="flex flex-col-reverse sm:flex-row sm:items-start gap-7 sm:gap-10 mb-10">' +
      (p.overview
        ? '<p class="text-[19px] sm:text-[22px] font-display font-medium leading-[1.55] max-w-[40ch] flex-1">' + escapeHtml(p.overview) + '</p>'
        : '<div class="flex-1"></div>') +
      /* sm:ml-auto 로 오른쪽 끝에 붙인다. 요약 문단은 읽기 폭(max-w-[40ch])에서 멈추므로
         그 뒤에 그냥 붙이면 오른쪽에 빈 공간이 남아 썸네일이 가운데로 치우쳐 보인다. */
      (thumb ? '<div class="flex-none sm:ml-auto">' + thumb + '</div>' : '') +
      '</div>';

  h += statsHTML(s, picks.length);

  /* 총론 → 상세 순서로 둔다(2026-08-24 사용자 지시). 한컴 관점은 그 주를 묶은 판단이고
     기업 목차는 아래 픽 섹션으로 가는 이동 장치이므로, 목차가 한컴 관점보다 앞에 오면
     결론을 읽기 전에 상세로 빠져나가게 된다. */
  if ((p.hancomConclusion || []).length) h += hancomHTML(p.hancomConclusion);
  if (picks.length) h += indexHTML(picks);

  /* 금주 한눈에 — 키워드 · 신규 편입 기업 · 4주 추이.
     수치 4칸은 목차 앞에 두라는 지시였으므로(그 앞에 다른 것을 끼우지 않는다) 이 셋은
     한컴 관점 다음, 픽 섹션 앞에 둔다. 상단이 무거워지지 않으면서 픽보다는 위에 온다. */
  const rows = [];
  if ((s.topTags || []).length)
    rows.push(glanceRow('키워드',
      '<p class="text-[13.5px] leading-[1.9]">' + s.topTags.map((t) =>
        '<span class="whitespace-nowrap">#' + escapeHtml(t.tag) +
        '<span class="text-ink/35 ml-0.5 text-[11px]">' + (t.count || 0) + '</span>' +
        (t.isNew ? '<span class="text-lime-600 text-[9px] font-bold uppercase tracking-widest ml-1">new</span>' : '') +
        '</span>').join('<span class="text-ink/20 mx-2">·</span>') + '</p>'));
  if ((s.newCompanies || []).length) {
    const link = (n) => '<a href="/company?name=' + encodeURIComponent(n) +
      '" class="font-display font-semibold hover:text-lime-600">' + escapeHtml(n) + '</a>';
    const shown = s.newCompanies.slice(0, NEW_CO_MAX);
    const rest = s.newCompanies.slice(NEW_CO_MAX);
    rows.push(glanceRow('신규 기업 ' + s.newCompanies.length,
      '<p class="text-[13.5px] leading-[1.9]">' + shown.map(link).join('<span class="text-ink/25">, </span>') +
      (rest.length
        // display:contents 라 펼쳐도 같은 줄 흐름에 이어 붙는다
        ? '<span id="wkNcMore" class="hidden contents"><span class="text-ink/25">, </span>' +
          rest.map(link).join('<span class="text-ink/25">, </span>') + '</span>' +
          '<button type="button" id="wkNcToggle" class="text-[12px] font-semibold text-lime-600 hover:text-ink underline underline-offset-2 ml-2">+' + rest.length + '곳</button>'
        : '') + '</p>'));
  }
  const tr = trendHTML(s.trend);
  if (tr) rows.push(glanceRow('4주 추이', tr));
  if (rows.length) h += '<div class="mt-10 rule pt-2">' + rows.join('') + '</div>';

  h += '</div>'; // WRAP 닫기 — 아래 픽 섹션은 전체폭

  h += picks.map(pickHTML).join('');

  // 푸터 — 다음 동선. 대시보드보다 기업·검색을 앞세운다(대시보드는 실제로 잘 읽히지 않는다).
  h += '<div class="' + WRAP + ' mt-12">';
  // 슬라이드로 가는 길은 상단 표지 썸네일이 맡는다(2026-08-24 사용자 지시) — 여기 링크는 두지 않는다.
  h += '<div class="rule-thin pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">' +
    '<a href="/weekly" class="font-semibold hover:text-lime-600">전체 회차 →</a>' +
    '<a href="/company" class="font-semibold hover:text-lime-600">기업 찾아보기 →</a>' +
    '<a href="/explore" class="font-semibold hover:text-lime-600">자료 검색 →</a></div>';
  h += '</div>';

  h += prevHTML(d.prev);
  return h + '<div class="h-14"></div>';
}

/* ===== 빈 상태 ===== */
function renderEmpty(d) {
  const msg = d.reason === 'NOT_PUBLISHED'
    ? (d.label ? escapeHtml(d.label) + '은 아직 발행되지 않았습니다' : '아직 발행되지 않은 주차입니다')
    : '아직 발행된 위클리 픽이 없습니다';
  return '<div class="' + WRAP + ' pt-16">' +
    '<div class="text-[11px] font-bold uppercase tracking-[.2em] text-lime-600 mb-3">Weekly Picks</div>' +
    '<div class="rule pt-6">' +
    '<p class="font-display font-bold text-[26px] tracking-tight mb-2">' + msg + '</p>' +
    '<p class="text-sm text-ink/55">발행되면 이 주소에서 바로 볼 수 있습니다</p>' +
    '<div class="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-[14px]">' +
    '<a href="/weekly" class="font-semibold hover:text-lime-600">전체 회차 →</a>' +
    '<a href="/" class="font-semibold hover:text-lime-600">대시보드 →</a>' +
    '<a href="/explore" class="font-semibold hover:text-lime-600">자료 검색 →</a></div></div></div>' +
    prevHTML(d.prev) + '<div class="h-14"></div>';
}

/* ===== 발행 전 미리보기 =====
   관리자가 발행 버튼을 누르기 전에 실제 화면을 확인하는 경로(?draft=1, 저장된 PIN 필요).
   ⚠ 기존 데이터 검수용 `?preview=1` 은 쓰지 않는다. 그 값은 dev-toolbar 배너를 띄우고
     「전체 배포 ▶」 버튼까지 노출하는데, 그 버튼은 보고서 draft 를 배포하는 것이라
     주간 발행과 무관하고 이 화면에서 누르면 의도치 않은 배포가 된다. */
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
    prev: [],
  };
}

const previewBanner = () =>
  '<div class="bg-ink text-lime"><div class="' + WRAP + ' py-3 text-sm font-semibold">' +
  '발행 전 미리보기입니다. 이 화면은 아직 공개되지 않았습니다</div></div>';

/* ===== 뉴스레터 겹쳐 띄우기 =====
   표지 썸네일을 누르면 페이지를 옮기지 않고 이 화면 위에 캐러셀을 띄운다(2026-08-24 사용자 지시).
   뒤 배경을 반투명으로 두어 어디를 읽고 있었는지 보이게 한다.
   조판은 news.js 한 곳에서 오고 이 함수는 껍데기와 여닫기만 맡는다. */
function openNewsOverlay(d) {
  if (!window.AXNews || document.getElementById('nwOverlay')) return;

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';   // 뒤 페이지가 같이 스크롤되면 어지럽다

  const wrap = document.createElement('div');
  wrap.id = 'nwOverlay';
  wrap.className = 'fixed inset-0 z-50 flex flex-col items-center justify-center px-3 py-4';
  /* 상단 줄·진행 세그먼트·하단 조작 줄을 뺀 높이. 전면 페이지(/news)와 여백이 다르므로 여기서 정한다.
     실제 껍데기는 121px(여백 32 + 상단 줄 26 + 세그먼트 15 + 조작 줄 48)이라 150 만 뺀다.
     200 을 빼면 낮은 화면(가로로 돌린 휴대폰)에서 프레임이 필요 이상으로 눌린다. */
  wrap.style.setProperty('--nw-h', 'min(calc(100dvh - 150px), 840px)');
  wrap.innerHTML =
    '<div data-nw-scrim class="absolute inset-0 bg-ink/75 backdrop-blur-sm"></div>' +
    '<div class="relative w-full flex flex-col items-center">' +
    '<div class="nw-bar mb-2.5 flex items-center gap-3">' +
    '<span class="font-display font-bold text-[11px] uppercase tracking-[.2em] text-lime">AX Biz Radar News</span>' +
    '<a href="/news?w=' + encodeURIComponent(d.week || '') + (d.isPreview ? '&draft=1' : '') +
    '" class="text-[11px] font-semibold text-white/50 hover:text-white">전체 화면 ↗</a>' +
    '<button type="button" data-nw-close class="ml-auto text-[12px] font-semibold text-white/60 hover:text-lime" aria-label="닫기">닫기 ✕</button>' +
    '</div>' +
    '<div data-nw-body class="w-full"></div>' +
    '</div>';
  document.body.appendChild(wrap);

  const inst = window.AXNews.mount(wrap.querySelector('[data-nw-body]'), d);
  // Esc·닫기·배경 클릭. 캐러셀이 붙인 것들은 inst.destroy() 가 떼고, 이 셋은 여기서 뗀다.
  const ac = new AbortController();
  const close = () => {
    ac.abort();
    if (inst && inst.destroy) inst.destroy();
    wrap.remove();
    document.body.style.overflow = prevOverflow;
  };
  wrap.querySelector('[data-nw-scrim]').addEventListener('click', close, { signal: ac.signal });
  wrap.querySelector('[data-nw-close]').addEventListener('click', close, { signal: ac.signal });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal: ac.signal });
}

/* ===== 초기화 ===== */
async function initWeekly() {
  const root = document.getElementById('wkRoot');
  // 렌더 대상이 없는 페이지에서는 여기서 끝낸다.
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const w = params.get('w') || '';
  const n = params.get('n') || '';
  const isPreview = params.get('draft') === '1' && !!w;

  /* 주차·회차를 지정하지 않으면 썸네일 목록 (2026-08-24 사용자 지시).
     공유 링크에는 늘 ?w= 가 붙으므로 단톡방에서 들어오는 사람은 이 분기를 타지 않는다. */
  if (!w && !n) {
    let list;
    try {
      list = await API.weeklyList();
    } catch {
      root.innerHTML = '<div class="' + WRAP + ' text-sm text-center py-16">불러오지 못했습니다. ' +
        '<a href="/" class="text-lime-600 font-semibold hover:underline">대시보드로</a></div>';
      return;
    }
    root.innerHTML = renderList((list && list.editions) || [], list && list.upcoming);
    document.title = '위클리 픽 — AX Biz Radar';
    return;
  }

  let data;
  try {
    data = isPreview ? draftToEdition(await API.weeklyPreview(w)) : await API.weekly(w, n);
  } catch (e) {
    // 미리보기는 PIN 이 있어야 한다. 관리자 콘솔의 [미리보기 ↗] 로 열면 PIN 이 이미 저장돼 있다.
    root.innerHTML = '<div class="' + WRAP + ' text-sm text-center py-16">' + (isPreview && e && e.status === 403
      ? '미리보기 권한이 없습니다. <a href="/admin/" class="text-lime-600 font-semibold hover:underline">관리자 콘솔</a>의 [미리보기 ↗] 버튼으로 열어 주세요.'
      : '불러오지 못했습니다. <a href="/" class="text-lime-600 font-semibold hover:underline">대시보드로</a>') + '</div>';
    return;
  }
  if (!data || !data.available) {
    root.innerHTML = renderEmpty(data || {});
    return;
  }
  root.innerHTML = (data.isPreview ? previewBanner() : '') + renderEdition(data);
  // 브라우저 탭·링크 미리보기에 회차가 드러나게(정적 OG 는 Phase 2 에서 회차별로 주입)
  document.title = '위클리 픽' + (data.issueNo ? ' ' + data.issueNo + '호' : '') + ' · ' + shortLabel(data.label) + ' — AX Biz Radar';

  // 표지 썸네일 → 캐러셀 겹쳐 띄우기
  const thumbBtn = root.querySelector('[data-nw-open]');
  if (thumbBtn) thumbBtn.addEventListener('click', () => openNewsOverlay(data));

  // 신규 기업 초과분 펼치기
  const ncBtn = document.getElementById('wkNcToggle');
  if (ncBtn) {
    ncBtn.addEventListener('click', () => {
      const more = document.getElementById('wkNcMore');
      if (more) more.classList.remove('hidden');
      ncBtn.remove();
    });
  }
}

document.addEventListener('DOMContentLoaded', initWeekly);
