/* 주간 인사이트 — 단톡방 주 1회 공유용 발행물 페이지.
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

function statsHTML(s) {
  const d = s.delta || 0;
  const deltaTxt = d > 0 ? '+' + d : String(d);
  return '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-8">' +
    statBox(s.total || 0, '건', '이번 주 동향') +
    statBox(s.companies || 0, '곳', '등장 기업') +
    statBox(deltaTxt, '건', '전주 대비', d > 0 ? 'text-lime-600' : (d < 0 ? 'text-ink/40' : '')) +
    statBox(s.picks || 0, '건', '주목 동향') +
    '</div>';
}

/* ===== 주목 동향 카드 =====
   접힘 = 훑는 사람용(제목 + 왜 주목하나 + 주요내용 2불릿) / 펼침 = 대시보드 카드와 같은 전문.
   접힘 미리보기는 펼치면 숨겨 같은 불릿이 두 번 보이지 않게 한다. */
const PREVIEW_POINTS = 2;

function pickHTML(p, i) {
  const cat = p.category ? '<span class="text-[10px] font-bold text-lime-600 bg-lime/15 rounded-full px-2 py-0.5 flex-none">' + escapeHtml(p.category) + '</span>' : '';
  const preview = (p.keyPoints || []).slice(0, PREVIEW_POINTS);
  const detail = typeof entryDetailHTML === 'function' ? entryDetailHTML(p) : '';

  let h = '<article class="wk-item bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 overflow-hidden">';
  h += '<div class="wk-toggle p-5 sm:p-6 cursor-pointer" role="button" tabindex="0" aria-expanded="false">';
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
      '<span class="wk-more">자세히</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="wk-chev w-3.5 h-3.5 transition-transform"><path d="m6 9 6 6 6-6"/></svg></div>';
  h += '</div>';
  if (detail) h += '<div class="wk-body"><div class="px-5 sm:px-6 pb-6">' + detail + '</div></div>';
  return h + '</article>';
}

/* ===== 그 외 동향 (접힘 안에서 각각 펼침) ===== */
function otherHTML(o) {
  const detail = typeof entryDetailHTML === 'function' ? entryDetailHTML(o) : '';
  let h = '<div class="wk-item bg-white rounded-2xl border border-ink/5 overflow-hidden">';
  h += '<div class="wk-toggle px-4 py-3 cursor-pointer" role="button" tabindex="0" aria-expanded="false">' +
    '<div class="flex items-baseline gap-2">' +
    '<a href="/company?name=' + encodeURIComponent(o.company) + '" class="font-display font-semibold text-[15px] tracking-tight hover:text-lime-600 flex-none">' + escapeHtml(o.company) + '</a>' +
    '<span class="text-[11px] text-ink/40 flex-none">' + escapeHtml(o.date || '') + '</span>' +
    (detail ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="wk-chev w-3.5 h-3.5 text-lime-600 ml-auto flex-none transition-transform"><path d="m6 9 6 6 6-6"/></svg>' : '') +
    '</div>' +
    (o.title ? '<p class="text-[13px] leading-snug text-ink/70 mt-1">' + escapeHtml(o.title) + '</p>' : '') +
    '</div>';
  if (detail) h += '<div class="wk-body"><div class="px-4 pb-4">' + detail + '</div></div>';
  return h + '</div>';
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
  const head = '[AX Biz Radar] 주간 인사이트' + (d.issueNo ? ' ' + d.issueNo + '호' : '') + ' · ' + shortLabel(d.label);
  const nums = '동향 ' + (s.total || 0) + '건 중 주목 ' + picks.length + '건' +
    (s.delta ? ' · 전주 대비 ' + (s.delta > 0 ? '+' : '') + s.delta : '');
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
  let h = '';

  // 헤더
  h += '<div class="mb-7">' +
    '<div class="flex items-baseline gap-2 mb-2.5">' +
    '<span class="text-[11px] font-bold uppercase tracking-widest text-lime-600">Weekly Insight</span>' +
    (d.issueNo ? '<span class="text-[11px] font-bold text-ink/50">· ' + d.issueNo + '호</span>' : '') + '</div>' +
    '<h1 class="text-3xl sm:text-4xl font-display font-bold tracking-tight leading-tight">' + escapeHtml(d.label) + '</h1>' +
    '<p class="text-sm text-ink/55 mt-2">' + escapeHtml(md(d.start) + ' ~ ' + md(d.end)) +
    (d.publishedAt ? ' · 발행 ' + escapeHtml(String(d.publishedAt).slice(0, 10)) : '') + '</p></div>';

  h += statsHTML(s);

  // 이번 주 한 줄
  if (p.overview)
    h += '<div class="bg-ink text-white rounded-[24px] p-6 sm:p-7">' +
      '<div class="text-[10px] font-bold uppercase tracking-widest text-lime mb-2.5">이번 주 한 줄</div>' +
      '<p class="text-lg sm:text-xl font-display font-semibold tracking-tight leading-snug">' + escapeHtml(p.overview) + '</p></div>';

  // 주목 동향
  if (picks.length) {
    h += secHead('Picks', '주목 동향', s.total ? '전체 ' + s.total + '건 중 ' + picks.length + '건' : '');
    h += '<div class="space-y-4">' + picks.map(pickHTML).join('') + '</div>';
  }

  // 한컴 관점 결론
  if ((p.hancomConclusion || []).length) {
    h += secHead('Hancom', '이번 주 결론', '');
    h += '<div class="rounded-[24px] bg-lime/15 border border-lime p-5 sm:p-6"><ul class="space-y-2.5">' +
      p.hancomConclusion.map((x) =>
        '<li class="text-[14px] leading-[1.8] text-ink/90 pl-4 relative before:content-[\'\'] before:absolute before:left-0 before:top-[11px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-lime-600">' +
        escapeHtml(x) + '</li>').join('') + '</ul></div>';
  }

  // 키워드
  if ((s.topTags || []).length) {
    h += secHead('Keywords', '이번 주 키워드', '');
    h += '<div class="flex flex-wrap gap-2">' + s.topTags.map((t) =>
      '<span class="text-[13px] bg-white border border-ink/10 rounded-full pl-3.5 pr-2 py-1.5 inline-flex items-center gap-1.5">' +
      '#' + escapeHtml(t.tag) +
      '<span class="text-[11px] font-bold text-ink/40">' + (t.count || 0) + '</span>' +
      (t.isNew ? '<span class="text-[9px] font-bold bg-lime text-ink rounded-full px-1.5 py-0.5">NEW</span>' : '') +
      '</span>').join('') + '</div>';
    if ((s.newCompanies || []).length)
      h += '<p class="text-xs text-ink/55 mt-3">이번 주 처음 편입된 기업: <b class="font-semibold text-ink/75">' + escapeHtml(s.newCompanies.join(', ')) + '</b></p>';
  }

  // 그 외 동향
  if (others.length) {
    h += '<details class="mt-10 group">' +
      '<summary class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center gap-2 border-b border-ink/10 pb-2.5">' +
      '<span class="text-[10px] font-bold uppercase tracking-widest text-lime-600">Others</span>' +
      '<span class="font-display font-bold text-xl tracking-tight">이번 주 그 외 동향</span>' +
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
    : '아직 발행된 주간 인사이트가 없습니다';
  return '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-8 sm:p-10 text-center">' +
    '<div class="text-[11px] font-bold uppercase tracking-widest text-lime-600 mb-3">Weekly Insight</div>' +
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
  if (!item || !item.querySelector('.wk-body')) return;
  const open = item.classList.toggle('wk-open');
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  const more = item.querySelector('.wk-more');
  if (more) more.textContent = open ? '접기' : '자세히';
}

/* ===== 발행 전 미리보기 =====
   관리자가 발행 버튼을 누르기 전에 실제 화면을 확인하는 경로(?preview=1, 저장된 PIN 필요).
   초안에는 「그 외 동향」 스냅샷이 아직 없으므로(발행 시점에 고정된다) 후보에서 계산해 채운다. */
function draftToEdition(d) {
  const picks = (d.payload && d.payload.picks) || [];
  const picked = new Set(picks.map((p) => p.key));
  const stats = Object.assign({}, d.stats, { picks: picks.length });
  return {
    available: true, isPreview: true,
    week: d.week, issueNo: d.issueNo, start: d.start, end: d.end, label: d.label, publishedAt: null,
    stats,
    payload: {
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
  const isPreview = params.get('preview') === '1' && !!w;
  let data;
  try {
    data = isPreview ? draftToEdition(await API.weeklyPreview(w)) : await API.weekly(w);
  } catch {
    root.innerHTML = '<div class="text-sm text-center py-16">불러오지 못했습니다. <a href="/" class="text-lime-600 font-semibold hover:underline">대시보드로</a></div>';
    return;
  }
  if (!data || !data.available) {
    root.innerHTML = renderEmpty(data || {});
    return;
  }
  root.innerHTML = (data.isPreview ? previewBanner() : '') + renderEdition(data);
  // 브라우저 탭·링크 미리보기에 회차가 드러나게(정적 OG 는 Phase 2 에서 회차별로 주입)
  document.title = '주간 인사이트' + (data.issueNo ? ' ' + data.issueNo + '호' : '') + ' · ' + shortLabel(data.label) + ' — AX Biz Radar';

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
