/* 위클리 픽 — 단톡방 주 1회 공유용 발행물 페이지.
   이름 근거: 대시보드 항목에 「한컴 인사이트」가 있어 「주간 인사이트」와 겹쳐 읽혔다(2026-08-21 사용자 지시).
   「픽」이 이 페이지의 정체(사람이 골라 이유를 붙인 것)를 그대로 말한다.
   대시보드(기업 축)와 달리 한 주를 발행물로 자른다: 선별 · 왜 주목하나 · 교차 종합 · 회차 아카이브.
   본문(주요내용·시사점·한컴 인사이트)은 entry.js 의 entryDetailHTML 을 그대로 재사용한다 —
   대시보드 카드 펼침과 같은 구성이어야 두 화면이 어긋나지 않는다.
   링크로 밖으로 내보내지 않고 카드 펼침으로 페이지 안에서 완결시킨다(실제로 링크는 잘 눌리지 않는다). */

const md = (d) => (d && d.length >= 10 ? +d.slice(5, 7) + '/' + +d.slice(8, 10) : '');
const shortLabel = (label) => String(label || '').replace(/^\d{4}년\s*/, ''); // '2026년 8월 3주' → '8월 3주'

/* ===== 수치 스트립 ===== */
function statBox(value, unit, caption, extraCls) {
  return '<div class="bg-white rounded-2xl border border-ink/5 px-4 py-3.5">' +
    '<div class="font-display font-bold text-2xl leading-none ' + (extraCls || '') + '">' + escapeHtml(value) +
    (unit ? '<span class="text-sm font-semibold opacity-50 ml-0.5">' + escapeHtml(unit) + '</span>' : '') + '</div>' +
    '<div class="text-[11px] font-semibold uppercase tracking-widest text-ink/45 mt-1.5">' + escapeHtml(caption) + '</div></div>';
}

// 전주 대비 증감은 쓰지 않는다(2026-08-21 사용자 지시). 데이터 수집일이 주마다 달라
// 증감이 시장 변화가 아니라 수집량 차이를 보여 주는 경우가 있고, 「이번 주에 새로 들어온 기업」이
// 주간 발행물에서 더 읽을 값이 있다. stats.delta 는 서버가 계속 계산하지만 화면에 쓰지 않는다.
function statsHTML(s) {
  const nc = (s.newCompanies || []).length;
  return '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">' +
    statBox(s.total || 0, '건', '금주 동향') +
    statBox(s.companies || 0, '곳', '등장 기업') +
    statBox(nc, '곳', '신규 기업', nc > 0 ? 'text-lime-600' : 'text-ink/40') +
    statBox(s.picks || 0, '건', '주목 픽') +
    '</div>';
}

/* ===== 최근 4주 추이 =====
   대시보드에 추이가 없어 이 페이지의 시각적 차별 지점이 된다. 막대 높이는 4주 최대값 기준 비율.
   건수가 0인 주도 칸을 남겨 「비어 있던 주」가 보이게 한다. */
function trendHTML(trend) {
  const t = (trend || []).filter((x) => x && x.start);
  if (t.length < 2) return '';
  const max = Math.max(...t.map((x) => x.total || 0), 1);
  const bars = t.map((x, i) => {
    const last = i === t.length - 1;
    const pct = Math.max(4, Math.round(((x.total || 0) / max) * 100));
    return '<div class="flex-1 flex flex-col items-center gap-1.5">' +
      '<div class="text-[10px] font-display font-bold ' + (last ? 'text-ink' : 'text-ink/40') + '">' + (x.total || 0) + '</div>' +
      '<div class="w-full h-14 flex items-end"><div class="w-full rounded-t-[4px] ' + (last ? 'bg-lime' : 'bg-ink/10') + '" style="height:' + pct + '%"></div></div>' +
      '<div class="text-[10px] ' + (last ? 'font-semibold text-ink/70' : 'text-ink/35') + '">' + escapeHtml(md(x.start)) + '</div>' +
      '</div>';
  }).join('');
  return '<div class="mt-5 pt-5 border-t border-ink/[.07]">' +
    '<div class="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-2.5">최근 4주 동향 건수</div>' +
    '<div class="flex items-end gap-2">' + bars + '</div></div>';
}

/* ===== 주목 동향 카드 =====
   **기본 펼침**이다(2026-08-21 사용자 지시). 단톡방에서 들어온 사람은 평소 대시보드를 보지 않으므로
   이 페이지만 읽고 끝낼 수 있어야 한다 — 주요내용·시사점·한컴 인사이트를 클릭 없이 보여 준다.
   접으면 훑기용 요약(제목 + 왜 주목하나 + 주요내용 2불릿)만 남는다. 접힘 미리보기는 펼친 상태에서
   숨겨 같은 불릿이 두 번 보이지 않게 한다(CSS .wk-open .wk-preview). */
const PREVIEW_POINTS = 2;
const NEW_CO_MAX = 6; // 금주 한눈에의 신규 편입 기업 칩 상한

function pickHTML(p, i) {
  const cat = p.category ? '<span class="text-[10px] font-bold text-lime-600 bg-lime/15 rounded-full px-2 py-0.5 flex-none">' + escapeHtml(p.category) + '</span>' : '';
  const preview = (p.keyPoints || []).slice(0, PREVIEW_POINTS);
  const detail = typeof entryDetailHTML === 'function' ? entryDetailHTML(p) : '';

  let h = '<article class="wk-item' + (detail ? ' wk-open' : '') + ' bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 overflow-hidden">';
  h += '<div class="wk-toggle p-5 sm:p-6 cursor-pointer" role="button" tabindex="0" aria-expanded="' + (detail ? 'true' : 'false') + '">';
  h += '<div class="flex items-center gap-2 mb-2">' +
    '<span class="font-display font-bold text-lime-600 text-sm flex-none">' + (i + 1) + '</span>' +
    '<a href="/company?name=' + encodeURIComponent(p.company) + '" class="font-display font-bold text-lg tracking-tight hover:text-lime-600 min-w-0 truncate">' + escapeHtml(p.company) + '</a>' +
    cat + '<span class="text-[11px] text-ink/45 font-medium ml-auto flex-none">' + escapeHtml(p.date || '') + '</span></div>';
  if (p.title) h += '<p class="text-[15px] font-bold leading-snug mb-3">' + escapeHtml(p.title) + '</p>';
  // 「왜 주목하나」 — 이 페이지의 알맹이. 사람이 판단해 쓴 한 줄이며 대시보드에 없는 유일한 정보다.
  if (p.why)
    h += '<div class="rounded-2xl bg-lime/15 border border-lime p-3.5 mb-3">' +
      '<div class="text-[10px] font-bold uppercase tracking-widest text-lime-600 mb-1">왜 주목하나</div>' +
      '<p class="text-[13.5px] leading-[1.75] text-ink/90">' + escapeHtml(p.why) + '</p></div>';
  if (preview.length)
    h += '<ul class="wk-preview space-y-1.5 mb-3">' + preview.map((x) =>
      '<li class="text-[13px] leading-[1.7] text-ink/70 pl-3 relative before:content-[\'\'] before:absolute before:left-0 before:top-[9px] before:w-1 before:h-1 before:rounded-full before:bg-ink/30">' +
      escapeHtml(x) + '</li>').join('') + '</ul>';
  if ((p.tags || []).length)
    h += '<div class="flex flex-wrap gap-1.5 mb-3">' + p.tags.map((t) =>
      '<span class="text-[11px] opacity-75 bg-beige border border-ink/5 rounded-full px-2.5 py-0.5">#' + escapeHtml(t) + '</span>').join('') + '</div>';
  if (detail)
    h += '<div class="flex items-center gap-1 text-[11px] font-bold text-lime-600">' +
      '<span class="wk-more">접기</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="wk-chev w-3.5 h-3.5 transition-transform"><path d="m6 9 6 6 6-6"/></svg></div>';
  h += '</div>';
  if (detail) h += '<div class="wk-body"><div class="px-5 sm:px-6 pb-6">' + detail + '</div></div>';
  return h + '</article>';
}

/* ===== 그 외 동향 (접힘 안에서 각각 펼침) =====
   본문은 **펼칠 때 만든다**. 데이터가 늘어 한 주 30건대가 되면서 본문을 미리 그리면 초기 HTML 이
   188KB 까지 갔다(주목 동향 3건 + 그 외 30건). 접혀 있어도 HTML 은 전부 내려가므로,
   원본만 들고 있다가 첫 펼침에 그린다. 화면에 보이는 것은 같고 초기 무게만 줄어든다. */
let OTHERS = [];

// 펼칠 내용이 있는지 — entryDetailHTML 을 만들지 않고 판정한다(그 함수와 같은 기준).
const hasDetail = (e) => !!(
  (e.keyPoints || []).length || (e.implications || []).length || (e.hancomInsight || []).length ||
  e.sourceUrl || e.confluenceUrl
);

function otherHTML(o, i) {
  const detail = hasDetail(o);
  let h = '<div class="wk-item bg-white rounded-2xl border border-ink/5 overflow-hidden" data-oi="' + i + '">';
  h += '<div class="wk-toggle px-4 py-3 cursor-pointer" role="button" tabindex="0" aria-expanded="false">' +
    '<div class="flex items-baseline gap-2">' +
    '<a href="/company?name=' + encodeURIComponent(o.company) + '" class="font-display font-semibold text-[15px] tracking-tight hover:text-lime-600 flex-none">' + escapeHtml(o.company) + '</a>' +
    '<span class="text-[11px] text-ink/40 flex-none">' + escapeHtml(o.date || '') + '</span>' +
    (detail ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="wk-chev w-3.5 h-3.5 text-lime-600 ml-auto flex-none transition-transform"><path d="m6 9 6 6 6-6"/></svg>' : '') +
    '</div>' +
    (o.title ? '<p class="text-[13px] leading-snug text-ink/70 mt-1">' + escapeHtml(o.title) + '</p>' : '') +
    '</div>';
  return h + '</div>'; // .wk-body 는 첫 펼침에 만든다
}

/* ===== 섹션 머리 ===== */
const secHead = (eyebrow, title, aside) =>
  '<div class="flex items-end justify-between border-b border-ink/10 pb-2.5 mb-4 mt-10">' +
  '<div class="flex items-baseline gap-2.5">' +
  '<span class="text-[10px] font-bold uppercase tracking-widest text-lime-600">' + escapeHtml(eyebrow) + '</span>' +
  '<h2 class="font-display font-bold text-xl tracking-tight">' + escapeHtml(title) + '</h2></div>' +
  (aside ? '<span class="text-xs text-ink/45">' + escapeHtml(aside) + '</span>' : '') + '</div>';

/* ===== 지난 회차 ===== */
function prevHTML(prev) {
  if (!prev || !prev.length) return '';
  return '<div class="mt-10 pt-6 border-t border-ink/10">' +
    '<div class="text-[10px] font-bold uppercase tracking-widest text-lime-600 mb-3">지난 회차</div>' +
    '<div class="space-y-1.5">' + prev.map((p) =>
      '<a href="/weekly?w=' + encodeURIComponent(p.week) + '" class="flex items-baseline gap-2.5 group">' +
      '<span class="font-display font-bold text-sm text-lime-600 flex-none w-10">' + (p.issueNo ? p.issueNo + '호' : '—') + '</span>' +
      '<span class="font-display font-semibold text-sm flex-none group-hover:text-lime-600">' + escapeHtml(shortLabel(p.label)) + '</span>' +
      '<span class="text-xs text-ink/50 truncate">' + escapeHtml(p.overview || '') + '</span>' +
      '<span class="text-[11px] text-ink/35 ml-auto flex-none">' + (p.total || 0) + '건</span></a>').join('') +
    '</div></div>';
}

/* ===== 공유 텍스트 =====
   단톡방에서 실제로 읽히는 것은 붙여넣은 텍스트다(링크 클릭률은 낮다).
   「왜 주목하나」가 그대로 → 줄로 들어가 관리자가 쓴 한 줄이 페이지와 텍스트 양쪽을 채운다. */
function shareText(d) {
  const s = d.stats || {}, p = d.payload || {};
  const picks = p.picks || [];
  const head = '[AX Biz Radar] 위클리 픽' + (d.issueNo ? ' ' + d.issueNo + '호' : '') + ' · ' + shortLabel(d.label);
  const nc = (s.newCompanies || []).length;
  const nums = '동향 ' + (s.total || 0) + '건 중 주목 ' + picks.length + '건' +
    (nc ? ' · 신규 기업 ' + nc + '곳' : '');
  const body = picks.map((x, i) =>
    (i + 1) + ') ' + x.company + '  ' + (x.title || '') + (x.why ? '\n   → ' + x.why : '')).join('\n');
  const kw = (s.topTags || []).slice(0, 4).map((t) => '#' + t.tag + (t.isNew ? '(NEW)' : '')).join(' ');
  const url = location.origin + '/weekly?w=' + encodeURIComponent(d.week);
  return [head, nums, '', body, '', kw ? '키워드 ' + kw : '', url].filter((x) => x !== null).join('\n').replace(/\n{3,}/g, '\n\n');
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
  const picks = p.picks || [], others = p.others || [];
  OTHERS = others; // 펼칠 때 본문을 만들 원본
  let h = '';

  // 헤더
  h += '<div class="mb-5">' +
    '<div class="flex items-baseline gap-2 mb-2.5">' +
    '<span class="text-[11px] font-bold uppercase tracking-widest text-lime-600">Weekly Picks</span>' +
    (d.issueNo ? '<span class="text-[11px] font-bold text-ink/50">· ' + d.issueNo + '호</span>' : '') + '</div>' +
    '<h1 class="text-3xl sm:text-4xl font-display font-bold tracking-tight leading-tight">' + escapeHtml(d.label) + '</h1>' +
    '<p class="text-sm text-ink/55 mt-2">' + escapeHtml(md(d.start) + ' ~ ' + md(d.end)) +
    (d.publishedAt ? ' · 발행 ' + escapeHtml(String(d.publishedAt).slice(0, 10)) : '') + '</p></div>';

  // 지난 회차와 이어지는 한 줄 — 회차가 이어지는 발행물이라는 신호. 대시보드는 회차 개념이 없어 못 하는 것.
  if (p.bridge) {
    const ref = p.bridgeRef && p.bridgeRef.issueNo ? p.bridgeRef.issueNo + '호 대비' : '지난 회차 대비';
    h += '<div class="mb-6 pl-4 border-l-2 border-lime text-[13.5px] leading-[1.7] text-ink/70">' +
      '<span class="font-semibold text-lime-600">' + escapeHtml(ref) + '</span> ' + escapeHtml(p.bridge) + '</div>';
  }

  // 금주 정리 + 금주 결론을 최상단에 둔다(2026-08-21 사용자 지시).
  // 단톡방에서 들어온 사람은 평소 대시보드를 보지 않으므로, 스크롤하지 않고도 한 주의 요지와
  // 한컴 관점 결론까지 읽히게 한다. 수치와 개별 동향은 그 뒤에 온다.
  if (p.overview)
    h += '<div class="bg-ink text-white rounded-[24px] p-6 sm:p-7 mb-4">' +
      '<div class="text-[10px] font-bold uppercase tracking-widest text-lime mb-2.5">금주 정리</div>' +
      '<p class="text-lg sm:text-xl font-display font-semibold tracking-tight leading-snug">' + escapeHtml(p.overview) + '</p></div>';

  if ((p.hancomConclusion || []).length)
    h += '<div class="rounded-[24px] bg-lime/15 border border-lime p-5 sm:p-6 mb-8">' +
      '<div class="text-[10px] font-bold uppercase tracking-widest text-lime-600 mb-3">금주 결론 · 한컴 관점</div>' +
      '<ul class="space-y-2.5">' +
      p.hancomConclusion.map((x) =>
        '<li class="text-[14px] leading-[1.8] text-ink/90 pl-4 relative before:content-[\'\'] before:absolute before:left-0 before:top-[11px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-lime-600">' +
        escapeHtml(x) + '</li>').join('') + '</ul></div>';

  // 금주 한눈에 — 수치 · 키워드 · 신규 편입 기업 · 4주 추이를 한 카드에 모아 주목 픽 위에 둔다.
  // 「수치 말고도 대시보드에 없는 포인트를 상단에」(2026-08-21 사용자 지시)에 대한 답이며,
  // 넷을 따로 흩어 놓으면 상단이 벽처럼 보여 한 덩어리로 묶었다.
  h += '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-5 sm:p-6 mb-8">' +
    '<div class="text-[10px] font-bold uppercase tracking-widest text-lime-600 mb-3.5">금주 한눈에</div>' +
    statsHTML(s);
  if ((s.topTags || []).length)
    h += '<div class="mt-5 pt-5 border-t border-ink/[.07]">' +
      '<div class="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-2.5">금주 키워드</div>' +
      '<div class="flex flex-wrap gap-2">' + s.topTags.map((t) =>
        '<span class="text-[13px] bg-beige border border-ink/[.07] rounded-full pl-3.5 pr-2 py-1.5 inline-flex items-center gap-1.5">' +
        '#' + escapeHtml(t.tag) +
        '<span class="text-[11px] font-bold text-ink/40">' + (t.count || 0) + '</span>' +
        (t.isNew ? '<span class="text-[9px] font-bold bg-lime text-ink rounded-full px-1.5 py-0.5">NEW</span>' : '') +
        '</span>').join('') + '</div></div>';
  // 신규 기업이 두 자릿수인 주가 있어(실측 11곳) 칩이 세 줄까지 번진다. 6곳까지만 보이고 나머지는 수로 접는다.
  if ((s.newCompanies || []).length) {
    const shown = s.newCompanies.slice(0, NEW_CO_MAX);
    const rest = s.newCompanies.length - shown.length;
    h += '<div class="mt-5 pt-5 border-t border-ink/[.07]">' +
      '<div class="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-2">금주 신규 편입 기업 ' +
      '<span class="text-ink/30">' + s.newCompanies.length + '곳</span></div>' +
      '<div class="flex flex-wrap gap-2">' + shown.map((n) =>
        '<a href="/company?name=' + encodeURIComponent(n) + '" class="text-[13px] font-display font-semibold bg-lime/20 border border-lime rounded-full px-3 py-1 hover:bg-lime transition-colors">' +
        escapeHtml(n) + '</a>').join('') +
      (rest > 0 ? '<span class="text-[13px] text-ink/45 px-2 py-1">외 ' + rest + '곳</span>' : '') +
      '</div></div>';
  }
  h += trendHTML(s.trend) + '</div>';

  // 주목 픽 — 본문(주요내용·시사점·한컴 인사이트)까지 기본 펼침
  if (picks.length) {
    h += secHead('Picks', '주목 픽', s.total ? '전체 ' + s.total + '건 중 ' + picks.length + '건' : '');
    h += '<div class="space-y-4">' + picks.map(pickHTML).join('') + '</div>';
  }

  // 그 외 동향
  if (others.length) {
    h += '<details class="mt-10 group">' +
      '<summary class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center gap-2 border-b border-ink/10 pb-2.5">' +
      '<span class="text-[10px] font-bold uppercase tracking-widest text-lime-600">Others</span>' +
      '<span class="font-display font-bold text-xl tracking-tight">금주 그 외 동향</span>' +
      '<span class="text-xs text-ink/45">' + others.length + '건</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="w-4 h-4 ml-auto text-lime-600 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6"/></svg>' +
      '</summary>' +
      '<div class="space-y-2 mt-4">' + others.map(otherHTML).join('') + '</div></details>';
  }

  // 푸터 — 공유 텍스트 복사 + 다음 동선(대시보드보다 기업·검색을 앞세운다)
  h += '<div class="mt-12 pt-7 border-t border-ink/10">' +
    '<button id="wkCopy" class="w-full sm:w-auto bg-ink text-lime font-semibold text-sm rounded-full px-7 py-3.5 hover:opacity-90 transition">공유 텍스트 복사</button>' +
    '<span id="wkCopyMsg" class="text-sm text-lime-600 font-semibold ml-3"></span>' +
    '<div class="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-sm">' +
    '<a href="/company" class="font-semibold hover:text-lime-600">기업 찾아보기 →</a>' +
    '<a href="/explore" class="font-semibold hover:text-lime-600">자료 검색 →</a>' +
    '<a href="/?date=' + encodeURIComponent(d.start || '') + '" class="text-xs text-ink/45 hover:text-ink">대시보드에서 이 주 보기</a>' +
    '</div></div>';

  h += prevHTML(d.prev);
  return h;
}

/* ===== 빈 상태 ===== */
function renderEmpty(d) {
  const msg = d.reason === 'NOT_PUBLISHED'
    ? (d.label ? escapeHtml(d.label) + '은 아직 발행되지 않았습니다' : '아직 발행되지 않은 주차입니다')
    : '아직 발행된 위클리 픽이 없습니다';
  return '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-8 sm:p-10 text-center">' +
    '<div class="text-[11px] font-bold uppercase tracking-widest text-lime-600 mb-3">Weekly Picks</div>' +
    '<p class="font-display font-bold text-xl tracking-tight mb-2">' + msg + '</p>' +
    '<p class="text-sm text-ink/55">발행되면 이 주소에서 바로 볼 수 있습니다</p>' +
    '<div class="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-6 text-sm">' +
    '<a href="/" class="font-semibold hover:text-lime-600">대시보드 →</a>' +
    '<a href="/explore" class="font-semibold hover:text-lime-600">자료 검색 →</a></div></div>' +
    prevHTML(d.prev);
}

/* ===== 펼침 토글 (이벤트 위임 + 키보드) ===== */
function onToggle(e) {
  const head = e.target.closest('.wk-toggle');
  if (!head) return;
  if (e.target.closest('a')) return;                        // 카드 내 링크는 그대로 동작
  if (e.target.closest('summary, [data-no-toggle]')) return; // 「N개 더 보기」는 자체 토글
  if (e.type === 'keydown') {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
  }
  const item = head.closest('.wk-item');
  if (!item) return;

  // 그 외 동향은 본문이 아직 없다 — 첫 펼침에 만든다.
  let body = item.querySelector('.wk-body');
  if (!body) {
    const oi = item.getAttribute('data-oi');
    if (oi == null) return;
    const o = OTHERS[+oi];
    if (!o || !hasDetail(o) || typeof entryDetailHTML !== 'function') return;
    body = document.createElement('div');
    body.className = 'wk-body';
    body.innerHTML = '<div class="px-4 pb-4">' + entryDetailHTML(o) + '</div>';
    item.appendChild(body);
    // 붙인 직후 같은 프레임에 클래스를 주면 max-height 전환이 생략된다. 다음 프레임으로 넘긴다.
    requestAnimationFrame(() => {
      item.classList.add('wk-open');
      head.setAttribute('aria-expanded', 'true');
    });
    return;
  }

  const open = item.classList.toggle('wk-open');
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  const more = item.querySelector('.wk-more');
  if (more) more.textContent = open ? '접기' : '자세히';
}

/* ===== 발행 전 미리보기 =====
   관리자가 발행 버튼을 누르기 전에 실제 화면을 확인하는 경로(?draft=1, 저장된 PIN 필요).
   초안에는 「그 외 동향」 스냅샷이 아직 없으므로(발행 시점에 고정된다) 후보에서 계산해 채운다.
   ⚠ 기존 데이터 검수용 `?preview=1` 은 쓰지 않는다. 그 값은 dev-toolbar 배너를 띄우고
     「전체 배포 ▶」 버튼까지 노출하는데, 그 버튼은 보고서 draft 를 배포하는 것이라
     주간 발행과 무관하고 이 화면에서 누르면 의도치 않은 배포가 된다. */
function draftToEdition(d) {
  const picks = (d.payload && d.payload.picks) || [];
  const picked = new Set(picks.map((p) => p.key));
  const stats = Object.assign({}, d.stats, { picks: picks.length });
  return {
    available: true, isPreview: true,
    week: d.week, issueNo: d.issueNo, start: d.start, end: d.end, label: d.label, publishedAt: null,
    stats,
    payload: {
      bridge: (d.payload && d.payload.bridge) || '',
      // 초안에는 이은 회차가 아직 굳지 않았다(발행 시 확정) — 미리보기에서는 서버가 준 직전 회차를 쓴다
      bridgeRef: d.prevEdition ? { week: d.prevEdition.week, issueNo: d.prevEdition.issueNo } : null,
      overview: (d.payload && d.payload.overview) || '',
      hancomConclusion: (d.payload && d.payload.hancomConclusion) || [],
      picks,
      others: (d.candidates || []).filter((c) => !picked.has(c.key)),
    },
    prev: [],
  };
}

const previewBanner = () =>
  '<div class="bg-ink text-lime rounded-2xl px-5 py-3 mb-6 text-sm font-semibold">발행 전 미리보기입니다. 이 화면은 아직 공개되지 않았습니다</div>';

/* ===== 초기화 ===== */
async function initWeekly() {
  const root = document.getElementById('wkRoot');
  // 관리자 화면도 이 파일을 불러 shareText 를 공용으로 쓴다(공유 텍스트 형식을 한 곳에 둔다).
  // 그 경우 렌더 대상이 없으므로 여기서 끝낸다.
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const w = params.get('w') || '';
  const isPreview = params.get('draft') === '1' && !!w;
  let data;
  try {
    data = isPreview ? draftToEdition(await API.weeklyPreview(w)) : await API.weekly(w);
  } catch (e) {
    // 미리보기는 PIN 이 있어야 한다. 관리자 콘솔의 [미리보기 ↗] 로 열면 PIN 이 이미 저장돼 있다.
    root.innerHTML = isPreview && e && e.status === 403
      ? '<div class="text-sm text-center py-16">미리보기 권한이 없습니다. <a href="/admin/" class="text-lime-600 font-semibold hover:underline">관리자 콘솔</a>의 [미리보기 ↗] 버튼으로 열어 주세요.</div>'
      : '<div class="text-sm text-center py-16">불러오지 못했습니다. <a href="/" class="text-lime-600 font-semibold hover:underline">대시보드로</a></div>';
    return;
  }
  if (!data || !data.available) {
    root.innerHTML = renderEmpty(data || {});
    return;
  }
  root.innerHTML = (data.isPreview ? previewBanner() : '') + renderEdition(data);
  // 브라우저 탭·링크 미리보기에 회차가 드러나게(정적 OG 는 Phase 2 에서 회차별로 주입)
  document.title = '위클리 픽' + (data.issueNo ? ' ' + data.issueNo + '호' : '') + ' · ' + shortLabel(data.label) + ' — AX Biz Radar';

  root.addEventListener('click', onToggle);
  root.addEventListener('keydown', onToggle);

  const btn = document.getElementById('wkCopy');
  if (btn) {
    btn.addEventListener('click', async () => {
      const msg = document.getElementById('wkCopyMsg');
      const ok = await copyToClipboard(shareText(data));
      if (msg) {
        msg.textContent = ok ? '복사되었습니다' : '복사에 실패했습니다';
        msg.className = 'text-sm font-semibold ml-3 ' + (ok ? 'text-lime-600' : 'text-red-500');
        setTimeout(() => { msg.textContent = ''; }, 2500);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initWeekly);
