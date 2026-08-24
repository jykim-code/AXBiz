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

/* ===== 헤더 ===== */
function headerHTML(d) {
  return '<div class="' + WRAP + ' pt-12">' +
    '<div class="flex items-end justify-between rule-thin pb-4 mb-8">' +
    '<div>' +
    '<div class="text-[11px] font-bold uppercase tracking-[.2em] text-lime-600 mb-1.5">Weekly Picks' +
    (d.issueNo ? ' No.' + no2(d.issueNo) : '') + '</div>' +
    '<h1 class="text-[40px] sm:text-[52px] font-bold tracking-tighter leading-none">' + escapeHtml(d.label) + '</h1></div>' +
    '<div class="text-right text-[12px] text-ink/45 leading-relaxed flex-none pl-4">' +
    escapeHtml(md(d.start) + ' ~ ' + md(d.end)) +
    (d.publishedAt ? '<br/>발행 ' + escapeHtml(String(d.publishedAt).slice(0, 10)) : '') +
    // 마지막 </div> 로 WRAP 을 닫는다. 닫지 않으면 뒤따르는 모든 블록이 이 max-width 안에 들어가
    // 픽 섹션의 전체폭 다크 반전이 1000px 로 잘리고 좌우 패딩이 이중으로 걸린다.
    '</div></div></div>';
}

/* ===== 수치 =====
   기업 목차 바로 앞에 둔다(2026-08-21 사용자 지시). 박스·칩을 쓰지 않고 세로 얇은 선으로만
   나눈다 — 목차를 가로선으로 나누는 것과 같은 문법이다.
   전주 대비 증감은 쓰지 않는다: 데이터 수집일이 주마다 달라 증감이 시장 변화가 아니라 수집량
   차이를 보여 주는 경우가 있다(실측 -7건). stats.delta 는 서버가 계산하지만 화면에 쓰지 않는다. */
function statsHTML(s) {
  return '<div class="rule pt-5 mb-10 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-ink/10">' +
    [['금주 동향', s.total || 0], ['등장 기업', s.companies || 0],
      ['신규 기업', (s.newCompanies || []).length], ['Weekly Picks', s.picks || 0]]
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

/* ===== 라벨 / 내용 2열 행 — 한컴 관점·금주 한눈에가 공유하는 문법 ===== */
const labelRow = (label, sub, content) =>
  '<div class="grid sm:grid-cols-[1fr,1fr] gap-x-10 gap-y-3 rule pt-5">' +
  '<div><div class="text-[11px] font-bold uppercase tracking-widest text-lime-600 mb-2">' + escapeHtml(label) + '</div>' +
  (sub ? '<p class="text-[13px] text-ink/45 leading-relaxed">' + escapeHtml(sub) + '</p>' : '') + '</div>' +
  '<div>' + content + '</div></div>';

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

function pickHTML(p, i) {
  const dark = i % 2 === 1;
  const linkCls = 'underline underline-offset-2 ' + (dark ? 'decoration-white/30 hover:text-lime' : 'decoration-ink/25 hover:text-lime-600');
  const src = safeUrl(p.sourceUrl), conf = safeUrl(p.confluenceUrl);

  let h = '<section id="wk' + i + '" class="mt-12 py-10 ' + (dark ? 'bg-ink text-white' : '') + '">' +
    '<div class="' + WRAP + ' grid sm:grid-cols-[120px,1fr] gap-x-8">' +
    '<div class="font-display font-bold text-[72px] leading-none ' + (dark ? 'text-lime/30' : 'num-out') + '">' + no2(i + 1) + '</div>' +
    '<div>';

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

/* ===== 목록 `/weekly` — 발행 회차 썸네일 =====
   단톡방에 뿌리는 링크는 늘 `?w=` 가 붙으므로(shareText) 이 화면은 공유 도착지가 아니라
   사이드바·대시보드에서 들어오는 「둘러보기」 입구다. 그래서 최신 회차 본문을 바로 펴지 않고
   회차가 쌓인 것을 보여 준 뒤 최신 회차로 들여보낸다. */
function renderList(editions) {
  const latest = editions[0];
  let h = '<div class="' + WRAP + ' pt-12">' +
    '<div class="text-[11px] font-bold uppercase tracking-[.2em] text-lime-600 mb-2">Weekly Picks</div>' +
    '<h1 class="text-[40px] sm:text-[52px] font-bold tracking-tighter leading-none mb-3">위클리 픽</h1>' +
    '<p class="text-[14px] text-ink/55 leading-relaxed max-w-[46ch]">' +
    '한 주의 AX 시장 동향에서 주목할 것만 골라 이유를 붙인 발행물</p>';

  if (latest) {
    h += '<div class="mt-8 rule pt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">' +
      '<a href="/weekly?w=' + encodeURIComponent(latest.week) + '" class="font-display font-bold text-[15px] hover:text-lime-600">' +
      '최신 ' + (latest.issueNo ? no2(latest.issueNo) + '호 · ' : '') + escapeHtml(weekTitle(latest.label)) + ' 읽기 →</a>' +
      (latest.overview ? '<span class="text-[13px] text-ink/50 truncate max-w-full">' + escapeHtml(latest.overview) + '</span>' : '') +
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
    '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">' +
    editions.map(coverHTML).join('') + '</div>' +
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
function shareText(d) {
  const s = d.stats || {}, p = d.payload || {};
  const picks = p.picks || [];
  const head = '[AX Biz Radar] 위클리 픽' + (d.issueNo ? ' ' + d.issueNo + '호' : '') + ' · ' + shortLabel(d.label);
  const nc = (s.newCompanies || []).length;
  const nums = '동향 ' + (s.total || 0) + '건 중 주목 ' + picks.length + '건' + (nc ? ' · 신규 기업 ' + nc + '곳' : '');
  const body = picks.map((x, i) =>
    (i + 1) + ') ' + x.company + '  ' + (x.title || '') + (x.why ? '\n   → ' + x.why : '')).join('\n');
  const kw = (s.topTags || []).slice(0, 4).map((t) => '#' + t.tag + (t.isNew ? '(NEW)' : '')).join(' ');
  const url = location.origin + '/weekly?w=' + encodeURIComponent(d.week);
  return [head, nums, '', body, '', kw ? '키워드 ' + kw : '', url].join('\n').replace(/\n{3,}/g, '\n\n');
}

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
  let h = headerHTML(d);

  // 금주 한 줄 요약 — 이 페이지에서 가장 큰 본문 활자
  h += '<div class="' + WRAP + '">';
  if (p.overview)
    h += '<p class="text-[19px] sm:text-[22px] font-display font-medium leading-[1.55] max-w-[40ch] mb-10">' + escapeHtml(p.overview) + '</p>';

  h += statsHTML(s);
  if (picks.length) h += indexHTML(picks);

  // 한컴 관점
  if ((p.hancomConclusion || []).length)
    h += '<div class="mt-10">' + labelRow('한컴 관점', '금주 픽에서 도출한 결론',
      '<div class="space-y-3">' + p.hancomConclusion.map((x) =>
        '<p class="text-[14px] leading-[1.7]">' + escapeHtml(x) + '</p>').join('') + '</div>') + '</div>';

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

  // 고르지 않은 나머지는 이 페이지에 싣지 않고 대시보드로 넘긴다(2026-08-21 사용자 지시).
  // 발행물은 고른 것만 보여 주고, 전체 목록은 원래 그것을 담당하는 화면이 맡는다.
  h += '<div class="' + WRAP + ' mt-12">';
  if ((s.total || 0) > picks.length)
    h += '<a href="/?date=' + encodeURIComponent(d.start || '') + '" class="rule pt-4 flex items-center gap-2 group">' +
      '<span class="text-[14px] font-semibold group-hover:text-lime-600">금주 동향 ' + (s.total || 0) + '건 전체를 대시보드에서 보기</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-lime-600 flex-none"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg></a>';

  // 푸터 — 다음 동선. 대시보드보다 기업·검색을 앞세운다(대시보드는 실제로 잘 읽히지 않는다).
  h += '<div class="mt-6 rule-thin pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">' +
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

/* ===== 초기화 ===== */
async function initWeekly() {
  const root = document.getElementById('wkRoot');
  // 관리자 화면도 이 파일을 불러 shareText 를 공용으로 쓴다(공유 텍스트 형식을 한 곳에 둔다).
  // 그 경우 렌더 대상이 없으므로 여기서 끝낸다.
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
    root.innerHTML = renderList((list && list.editions) || []);
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
