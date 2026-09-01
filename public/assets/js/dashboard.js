/* 메인 대시보드 — API 연동, 지식 그래프(전체 누적), 스윔레인 카드, 캘린더 */

// 분류 키 → 컬럼. 키 목록은 functions/api/reports.js 의 CATEGORIES 와 반드시 일치시킬 것
// (불일치 시 해당 분류 카드가 조용히 누락됨).
const CAT = { 대기업: 'large', 중견기업: 'mid', '스타트업·중소': 'startup' };

/* ===== 상태 ===== */
const state = {
  reports: [], // 전체 보고서 [{date, companies}] — 기간 집계용
  dates: [], // 데이터 있는 날짜 (desc)
  dateSet: new Set(), // 빠른 조회용
  mode: 'week', // 'day' | 'week' | 'month' — 기본값 주간(2026-08-10 사용자 지시, 이전 월간)
  anchor: null, // 기준 날짜 'YYYY-MM-DD'
};

/* ===== 지식 그래프 (전체 기간 누적) ===== */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

// tags = 그래프에 실제로 그려지는 태그 수, tagsAll = 데이터 전체 태그 종류 수.
// 그래프는 여러 기업이 공유하는 태그만 그리므로 둘이 크게 다르다. "62 / 612" 로 함께 보여
// 표시량과 데이터 규모를 동시에 전달하고, 슬래시만으로는 뜻이 안 읽히므로 title 로 풀어 쓴다.
function setStats(total, companies, dates, tags, tagsAll) {
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statCompanies').textContent = companies;
  document.getElementById('statDates').textContent = dates;
  document.getElementById('statTags').textContent = tags;

  const all = document.getElementById('statTagsAll');
  const box = document.getElementById('statTagsBox');
  const hasBoth = tagsAll && tagsAll !== tags;
  if (all) all.textContent = hasBoth ? ' / ' + tagsAll : '';
  if (box) {
    box.title = hasBoth
      ? '관계망에 표시되는 태그 ' + tags + '개 (여러 기업이 공유하는 태그) / 전체 태그 ' + tagsAll + '종'
      : '전체 태그 ' + tags + '종';
  }
}

function buildGraph(reports) {
  const all = (reports || []).flatMap((r) => r.companies || []);
  const seen = {};
  const companies = [];
  all.forEach((c) => {
    if (!c || !c.name) return;
    if (!seen[c.name]) {
      seen[c.name] = { name: c.name, tags: new Set() };
      companies.push(seen[c.name]);
    }
    (c.tags || []).forEach((t) => seen[c.name].tags.add(t));
  });
  const tagMap = {};
  companies.forEach((c) => c.tags.forEach((t) => (tagMap[t] = tagMap[t] || []).push(c.name)));
  const allTags = Object.keys(tagMap);

  // 표시 태그 선정은 Cytoscape 경로와 같은 기준(ontology.js 공용)을 쓴다 — 폴백만 다른 그래프가
  // 되지 않도록. 이 경로는 동기 함수라 핀은 반영하지 않는다(핀은 Cytoscape 경로에서만).
  const tags = (typeof selectCuratedTags === 'function' && typeof buildOntology === 'function')
    ? selectCuratedTags(reports, buildOntology(reports), [], 3).filter((t) => tagMap[t])
    : allTags.sort((a, b) => tagMap[b].length - tagMap[a].length || a.localeCompare(b)).slice(0, 30);

  setStats(all.length, companies.length, (reports || []).length, tags.length, allTags.length);

  const graphEl = document.getElementById('graph');
  if (!companies.length) {
    graphEl.innerHTML =
      '<div class="h-full flex items-center justify-center text-sm opacity-75">표시할 관계망 데이터가 없습니다</div>';
    return;
  }

  const W = 480,
    H = 360,
    cx = W / 2,
    cy = H / 2;
  const cp = {};
  companies.forEach((c, i) => {
    const a = (-90 + (i * 360) / companies.length) * (Math.PI / 180);
    cp[c.name] = { x: cx + Math.cos(a) * 128, y: cy + Math.sin(a) * 98, a };
  });
  const tp = {};
  tags.forEach((t) => {
    const conn = tagMap[t];
    let sx = 0,
      sy = 0;
    conn.forEach((n) => {
      sx += Math.cos(cp[n].a);
      sy += Math.sin(cp[n].a);
    });
    const a = Math.atan2(sy, sx) + (((hash(t) % 44) - 22) * Math.PI) / 180;
    const x = cx + Math.cos(a) * 205,
      y = cy + Math.sin(a) * 150;
    tp[t] = { x: Math.max(34, Math.min(W - 34, x)), y: Math.max(26, Math.min(H - 26, y)) };
  });

  let edges = '',
    nodes = '';
  companies.forEach((c) => {
    const p = cp[c.name];
    edges +=
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x + '" y2="' + p.y +
      '" stroke="#c8f200" stroke-opacity=".45" stroke-width="1.4"/>';
  });
  tags.forEach((t) => {
    tagMap[t].forEach((n) => {
      const a = cp[n],
        b = tp[t];
      edges +=
        '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y +
        '" stroke="#ffffff" stroke-opacity=".12" stroke-width="1"/>';
    });
  });
  tags.forEach((t) => {
    const p = tp[t];
    const anc = p.x < cx ? 'end' : 'start';
    const dx = p.x < cx ? -7 : 7;
    nodes += '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.4" fill="#ffffff" fill-opacity=".5"/>';
    nodes +=
      '<text x="' + (p.x + dx) + '" y="' + (p.y + 3) + '" text-anchor="' + anc +
      '" font-size="9" fill="#ffffff" fill-opacity=".42" font-family="Inter, Pretendard">#' +
      escapeHtml(t) + '</text>';
  });
  companies.forEach((c) => {
    const p = cp[c.name];
    const anc = p.x < cx ? 'end' : 'start';
    const dx = p.x < cx ? -9 : 9;
    nodes += '<circle cx="' + p.x + '" cy="' + p.y + '" r="6.5" fill="#c8f200"/>';
    nodes +=
      '<text x="' + (p.x + dx) + '" y="' + (p.y + 4) + '" text-anchor="' + anc +
      '" font-size="11.5" fill="#ffffff" font-weight="600" font-family="Space Grotesk, Pretendard">' +
      escapeHtml(c.name) + '</text>';
  });
  // 중앙 허브 (reduced-motion이면 펄스 애니메이션 생략)
  const pulse = REDUCED_MOTION
    ? ''
    : '<circle cx="' + cx + '" cy="' + cy +
      '" r="11" fill="none" stroke="#c8f200" stroke-width="1.5">' +
      '<animate attributeName="r" values="11;30" dur="2.8s" repeatCount="indefinite"/>' +
      '<animate attributeName="opacity" values=".6;0" dur="2.8s" repeatCount="indefinite"/></circle>';
  nodes +=
    '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#c8f200"/>' +
    pulse +
    '<text x="' + cx + '" y="' + (cy + 4) +
    '" text-anchor="middle" font-size="10" fill="#111" font-weight="700" font-family="Space Grotesk">AX</text>';

  graphEl.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H +
    '" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">' +
    '<ellipse cx="' + cx + '" cy="' + cy + '" rx="128" ry="98" fill="none" stroke="#ffffff" stroke-opacity=".05"/>' +
    '<ellipse cx="' + cx + '" cy="' + cy + '" rx="205" ry="150" fill="none" stroke="#ffffff" stroke-opacity=".04"/>' +
    edges + nodes + '</svg>';
}

/* ===== 카드 ===== */
// 한 건(날짜)의 본문은 entry.js 의 entryDetailHTML — 기업 상세 페이지와 같은 카테고리 구성을 쓴다.

// 옵션 1: 기업별 1카드. 접힘=최신 헤드라인+N건 / 펼침=기간 종합(다건) + 날짜별 타임라인
function cardHTML(co) {
  const entries = co.entries || [];
  const latest = entries[0] || co;
  const n = co.count || entries.length || 1;
  // 접힘 줄: 단건=관리자 한 줄 요약(없으면 첫 주요내용) / 다건=기간 종합(렌더 직후 비동기 채움)
  const sumText = n > 1
    ? '<span class="opacity-50 font-normal">기간 종합 불러오는 중…</span>'
    : escapeHtml((latest.summary && String(latest.summary).trim()) || (latest.keyPoints && latest.keyPoints[0]) || '');
  const badge = n > 1 ? '<span class="text-[10px] font-bold text-lime-600 bg-lime/15 rounded-full px-2 py-0.5 flex-none">' + n + '건</span>' : '';
  const dateChip = co.date ? '<span class="text-[11px] text-ink/55 font-medium ml-auto flex-none">' + escapeHtml(co.date) + '</span>' : '';
  let h = '<div class="card group bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 hover:-translate-y-1 transition-transform duration-300 cursor-pointer" role="button" tabindex="0" aria-expanded="false" data-company="' + escapeHtml(co.name) + '">';
  h += '<div class="p-6 flex items-start gap-3"><div class="flex-1 min-w-0">' +
    '<div class="flex items-center gap-2">' +
    '<a href="/company?name=' + encodeURIComponent(co.name) + '" class="font-display font-bold text-lg tracking-tight hover:text-lime-600 inline-flex items-center gap-1" title="기업 상세 보기">' + escapeHtml(co.name) +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-lime-600 flex-none"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg></a>' +
    badge + dateChip + '</div>' +
    '<p class="card-summary' + (n > 1 ? ' is-period' : '') + ' text-sm font-bold text-ink mt-1.5 leading-snug">' + sumText + '</p></div>' +
    '<span class="chev flex-none mt-1 opacity-75 transition-transform duration-300"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="m6 9 6 6 6-6"/></svg></span></div>';
  h += '<div class="card-body"><div class="px-6 pb-6 space-y-5">';
  // 기간 종합(다건일 때, 펼침 시 lazy 로드)
  if (n > 1)
    h += '<div class="period-summary">' +
      '<div class="text-[11px] font-bold uppercase tracking-widest text-lime-600 mb-1">기간 종합</div>' +
      '<div class="bg-ink rounded-xl p-3"><p class="summary-text text-sm leading-relaxed text-white opacity-90">종합 생성 중…</p></div></div>';
  if (n > 1) {
    // 날짜별 미니 타임라인(최신순)
    h += '<div class="space-y-6 border-l-2 border-lime/40 pl-5">';
    entries.forEach((e) => {
      h += '<div class="relative"><div class="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-lime border-2 border-white"></div>' +
        '<div class="text-xs font-bold text-lime-600 mb-2">' + escapeHtml(e.date) + '</div>' +
        entryDetailHTML(e) + '</div>';
    });
    h += '</div>';
  } else {
    h += entryDetailHTML(latest);
  }
  if (co.tags && co.tags.length)
    h += '<div class="flex flex-wrap gap-2">' + co.tags.map((t) => '<span class="text-xs opacity-80 bg-beige border border-ink/5 rounded-full px-3 py-1">#' + escapeHtml(t) + '</span>').join('') + '</div>';
  h += '</div></div></div>';
  return h;
}

/* ===== 기간(일/주/월) 계산 ===== */
function parseYmd(s) { return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); }
function fmtDate(dt) { return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// 현재 mode·anchor 기준 [시작, 끝] (YYYY-MM-DD). 주=월~일, 월=1일~말일.
function periodRange() {
  const a = parseYmd(state.anchor);
  if (state.mode === 'day') return [state.anchor, state.anchor];
  if (state.mode === 'week') {
    const dow = (a.getDay() + 6) % 7; // 월=0
    const s = new Date(a); s.setDate(a.getDate() - dow);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return [fmtDate(s), fmtDate(e)];
  }
  const s = new Date(a.getFullYear(), a.getMonth(), 1);
  const e = new Date(a.getFullYear(), a.getMonth() + 1, 0);
  return [fmtDate(s), fmtDate(e)];
}
function periodLabel() {
  const [s, e] = periodRange();
  if (state.mode === 'day') return s + ' (' + DOW[parseYmd(s).getDay()] + ')';
  if (state.mode === 'week') return s + ' ~ ' + e.slice(5);
  return s.slice(0, 4) + '년 ' + (+s.slice(5, 7)) + '월';
}
function stepPeriod(dir) {
  const a = parseYmd(state.anchor);
  if (state.mode === 'day') {
    // 일 모드도 ◀▶는 보통 달력처럼 "월 이동"(날짜는 유지, 말일 보정). 특정 날짜는 캘린더 클릭으로 선택.
    const d = a.getDate();
    a.setDate(1); a.setMonth(a.getMonth() + dir);
    const last = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
    a.setDate(Math.min(d, last));
  } else if (state.mode === 'week') a.setDate(a.getDate() + 7 * dir);
  else a.setDate(1), a.setMonth(a.getMonth() + dir);
  state.anchor = fmtDate(a);
}

// 기간 내 항목을 기업별로 묶음 (entries[] 최신순 + 태그 합집합). 내용 손실 없음.
function aggregate() {
  const [s, e] = periodRange();
  const map = {};
  (state.reports || []).forEach((r) => {
    if (!r.date || r.date < s || r.date > e) return;
    (r.companies || []).forEach((c) => {
      if (!c || !c.name) return;
      const co = (map[c.name] = map[c.name] || { name: c.name, category: c.category, entries: [], _tags: new Set() });
      co.entries.push(Object.assign({ date: r.date }, c));
      (c.tags || []).forEach((t) => co._tags.add(t));
      co.category = c.category; // 최신 분류 반영(대개 동일)
    });
  });
  const items = Object.values(map);
  items.forEach((co) => {
    co.entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    co.count = co.entries.length;
    co.date = co.entries[0] ? co.entries[0].date : '';
    co.tags = [...co._tags];
  });
  return items;
}

/* ===== 주차 계산 헬퍼 (4일 이상 기준) ===== */
// 날짜가 속한 주의 월요일을 반환
function weekMonday(date) {
  const dow = (date.getDay() + 6) % 7; // Mon=0
  const s = new Date(date);
  s.setDate(date.getDate() - dow);
  s.setHours(0, 0, 0, 0);
  return s;
}
// 주(월~일)가 속한 달 판단: 7일 중 4일 이상인 달
function weekOwnerMonth(wkMon) {
  const counts = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkMon);
    d.setDate(wkMon.getDate() + i);
    const k = d.getFullYear() * 12 + d.getMonth();
    counts[k] = (counts[k] || 0) + 1;
  }
  let bestKey = null, bestCnt = 0;
  Object.keys(counts).forEach(function (k) {
    if (counts[k] > bestCnt) { bestCnt = counts[k]; bestKey = +k; }
  });
  if (!bestKey || bestCnt < 4) return null;
  return { year: Math.floor(bestKey / 12), month: bestKey % 12 };
}
// 해당 달의 첫 번째 주 월요일 반환
function firstWeekMonOfMonth(y, m) {
  const first = new Date(y, m, 1);
  const s = weekMonday(first);
  const owner = weekOwnerMonth(s);
  if (owner && owner.year === y && owner.month === m) return s;
  const next = new Date(s);
  next.setDate(s.getDate() + 7);
  return next;
}

/* ===== 월간 주차별 바 차트 HTML ===== */
function buildMonthlyWeekBars() {
  const a = parseYmd(state.anchor);
  const y = a.getFullYear(), m = a.getMonth();
  const cur = firstWeekMonOfMonth(y, m);
  const weeks = [];
  for (let n = 1; n <= 6; n++) {
    const we = new Date(cur); we.setDate(cur.getDate() + 6);
    const owner = weekOwnerMonth(cur);
    if (!owner || owner.year !== y || owner.month !== m) break;
    weeks.push({ label: n + '주차', start: fmtDate(cur), end: fmtDate(we), count: 0 });
    cur.setDate(cur.getDate() + 7);
  }
  (state.reports || []).forEach(function (r) {
    if (!r.date) return;
    weeks.forEach(function (w) { if (r.date >= w.start && r.date <= w.end) w.count += (r.companies || []).length; });
  });
  if (!weeks.some(function (w) { return w.count > 0; })) return '';
  const max = Math.max.apply(null, weeks.map(function (w) { return w.count; })) || 1;
  return '<div class="space-y-1.5">' +
    '<div class="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">주차별</div>' +
    weeks.map(function (w) {
      return '<div class="flex items-center gap-2 text-xs">' +
        '<span class="w-10 opacity-50">' + w.label + '</span>' +
        '<div class="flex-1 h-1.5 bg-beige rounded-full overflow-hidden">' +
          '<div class="h-full rounded-full" style="width:' + Math.round(w.count / max * 100) + '%;background:#7ba500"></div>' +
        '</div>' +
        '<span class="opacity-50 w-8 text-right">' + (w.count || '—') + '</span>' +
      '</div>';
    }).join('') + '</div>';
}

/* ===== 위클리 픽 버튼 (해당 주 발행 여부 확인 후 렌더) ===== */
const _wkCache = {}; // dateStr → {available, week} | null
function fetchWeeklyBtn(dateStr, el) {
  if (_wkCache[dateStr] !== undefined) {
    renderWeeklyBtn(el, _wkCache[dateStr]);
    return;
  }
  fetch('/api/weekly?date=' + encodeURIComponent(dateStr), { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      _wkCache[dateStr] = (data && data.available && data.week) ? data : null;
      // anchor 가 바뀌었으면 무시
      if (dateStr === state.anchor && state.mode === 'week') renderWeeklyBtn(el, _wkCache[dateStr]);
    })
    .catch(function () { _wkCache[dateStr] = null; });
}
function renderWeeklyBtn(el, data) {
  if (!el) return;
  if (!data) { el.innerHTML = ''; return; }
  el.innerHTML =
    '<a href="/weekly?w=' + encodeURIComponent(data.week) + '" class="inline-flex items-center gap-2 bg-lime text-ink text-xs font-bold rounded-full px-3.5 py-1.5 hover:opacity-90 transition-opacity">' +
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
    '이 주의 위클리 픽</a>';
}

/* ===== 기간 브리핑 ===== */
function updateBrief(items, cols) {
  const modeLabel = { day: '일간', week: '주간', month: '월간' }[state.mode];
  const kindBadge = document.getElementById('briefKindBadge');
  if (kindBadge) kindBadge.textContent = modeLabel;

  document.getElementById('briefCount').textContent = items.length;
  const countSummary = document.getElementById('briefCountSummary');
  if (countSummary) countSummary.textContent = items.length;

  const bdSummary = document.getElementById('briefBreakdownSummary');
  const largEl = document.getElementById('briefLarge');
  const midEl = document.getElementById('briefMid');
  const startupEl = document.getElementById('briefStartup');
  const weeklyEl = document.getElementById('briefWeekly');
  const tagsEl = document.getElementById('briefTags');
  const extraEl = document.getElementById('briefExtra');

  if (!items.length) {
    if (bdSummary) bdSummary.textContent = '';
    if (largEl) largEl.textContent = '0';
    if (midEl) midEl.textContent = '0';
    if (startupEl) startupEl.textContent = '0';
    if (weeklyEl) weeklyEl.innerHTML = '';
    tagsEl.innerHTML = '';
    if (extraEl) extraEl.innerHTML = '';
    return;
  }

  const breakdownText = '대기업 ' + cols.large.length + ' · 중견 ' + cols.mid.length + ' · 스타트업 ' + cols.startup.length;
  if (bdSummary) bdSummary.textContent = breakdownText;
  if (largEl) largEl.textContent = cols.large.length;
  if (midEl) midEl.textContent = cols.mid.length;
  if (startupEl) startupEl.textContent = cols.startup.length;

  // 주간 모드: 해당 주 발행 여부 확인 후 버튼 표시
  if (weeklyEl) {
    if (state.mode === 'week') {
      weeklyEl.innerHTML = ''; // 조회 중 비워둠
      fetchWeeklyBtn(state.anchor, weeklyEl);
    } else {
      weeklyEl.innerHTML = '';
    }
  }

  const freq = {};
  items.forEach((c) => (c.tags || []).forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
  const top = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 6);
  // 월간 모드는 태그 미표시
  tagsEl.innerHTML = state.mode === 'month' ? '' : top
    .map((t) => '<span class="text-[11px] opacity-80 bg-beige border border-ink/5 rounded-full px-2.5 py-0.5">#' + escapeHtml(t) + '</span>')
    .join('');

  if (!extraEl) return;
  if (state.mode === 'month') {
    extraEl.innerHTML = buildMonthlyWeekBars();
  } else {
    extraEl.innerHTML = '';
  }
}

/* ===== 기간 카드 렌더 ===== */
function renderPeriod() {
  const label = periodLabel();
  document.getElementById('periodLabel').textContent = label;
  const pls = document.getElementById('periodLabelSummary'); if (pls) pls.textContent = label;
  const items = aggregate();
  const cols = { large: [], mid: [], startup: [] };
  items.forEach((c) => { const k = CAT[c.category]; if (k) cols[k].push(c); });
  for (const k of ['large', 'mid', 'startup']) {
    cols[k].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name));
    document.getElementById('col-' + k).innerHTML =
      cols[k].map(cardHTML).join('') || '<div class="text-sm text-ink/55 px-2 py-3">해당 기간 동향 없음</div>';
    document.getElementById('cnt-' + k).textContent = cols[k].length;
  }
  // 다건 카드의 기간 종합을 렌더 직후 미리 로드(서버 캐시로 재조회는 즉시) — 접힘 줄·펼침 박스 동시 채움
  for (const k of ['large', 'mid', 'startup']) {
    document.getElementById('col-' + k).querySelectorAll('.card').forEach((card) => loadPeriodSummary(card));
  }
  updateBrief(items, cols);
}

/* ===== 캘린더 (anchor 월 표시, 선택 기간 하이라이트) ===== */
function renderCal() {
  const a = parseYmd(state.anchor);
  const y = a.getFullYear(), m = a.getMonth();
  const [ps, pe] = periodRange();
  let h = DOW
    .map((d) => '<div class="text-[10px] font-semibold uppercase tracking-wider opacity-75 text-center">' + d + '</div>')
    .join('');
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  // 선택 기간을 "연결된 라임 바"로: 가로 gap 제거 + 범위 양끝만 둥글게
  const inR = (d) => { if (d < 1 || d > days) return false; const ds = ymd(y, m + 1, d); return ds >= ps && ds <= pe; };
  for (let i = 0; i < first; i++) h += '<div class="h-8"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = ymd(y, m + 1, d);
    const has = state.dateSet.has(ds);
    const col = (first + d - 1) % 7;
    const me = inR(d), L = me && col > 0 && inR(d - 1), R = me && col < 6 && inR(d + 1);
    let cls = 'relative h-8 flex items-center justify-center text-sm font-display cursor-pointer transition-colors ';
    if (me) cls += 'bg-lime text-ink font-bold ' + (L ? '' : 'rounded-l-lg ') + (R ? '' : 'rounded-r-lg ');
    else if (has) cls += 'rounded-lg font-semibold hover:bg-beige';
    else cls += 'rounded-lg opacity-30 hover:bg-beige';
    h +=
      '<div class="' + cls + '" data-date="' + ds + '" role="button" tabindex="0" aria-label="' + ds + '">' +
      d +
      // 데이터 있는 날 표시 점. 선택 기간(라임 바) 안에서는 lime-600이 배경에 묻히므로 ink로 반전.
      (has ? '<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ' + (me ? 'bg-ink' : 'bg-lime-600') + '"></span>' : '') +
      '</div>';
  }
  const g = document.getElementById('calGrid');
  g.innerHTML = h;
  g.querySelectorAll('[data-date]').forEach((el) => {
    const pick = () => { state.anchor = el.dataset.date; renderPeriod(); renderCal(); };
    el.onclick = pick;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); pick(); }
    });
  });
}

/* ===== 모드 토글 활성 표시 ===== */
function renderToggle() {
  document.querySelectorAll('#modeToggle button').forEach((b) => {
    b.className = 'flex-1 px-3.5 py-1 rounded-full text-xs font-semibold transition-colors ' +
      (b.dataset.mode === state.mode ? 'bg-ink text-lime' : 'text-ink/60 hover:text-ink');
  });
}

/* ===== 카드 토글 (이벤트 위임 + 키보드) ===== */
// 본문을 드래그해 선택하고 버튼을 놓으면 click 이 카드에서 발생해 펼친 카드가 닫혔다.
// 누른 지점과 뗀 지점의 거리, 그리고 카드 안에 남은 선택 영역으로 「읽으려는 드래그」를 걸러낸다.
const DRAG_SLOP_PX = 4;
let cardPress = null;

function onCardPress(e) {
  cardPress = { x: e.clientX, y: e.clientY };
}

function isTextDrag(e, card) {
  const p = cardPress;
  cardPress = null;
  if (p && Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > DRAG_SLOP_PX) return true;
  const sel = window.getSelection ? window.getSelection() : null;
  if (!sel || sel.isCollapsed || !String(sel).trim()) return false;
  const node = sel.anchorNode;
  const el = node && (node.nodeType === 1 ? node : node.parentNode);
  return !!(el && card.contains(el));
}

function onCardActivate(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  if (e.target.closest('a')) return; // 카드 내 링크는 그대로 동작
  // 주요 내용 '더 보기'(details/summary)는 자체 토글이므로 카드를 접지 않는다.
  if (e.target.closest('summary, [data-no-toggle]')) return;
  if (e.type === 'keydown') {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
  } else if (isTextDrag(e, card)) {
    return; // 텍스트를 읽기 위한 드래그이므로 토글하지 않는다
  }
  const open = card.classList.toggle('open');
  card.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) loadPeriodSummary(card);
}

// 종합 실패 → 펼침 박스는 제거하고 접힘 줄만 최신 요약으로 남김.
// 이때 .is-period(펼치면 숨김)를 떼야 카드를 펼쳤을 때 요약이 사라지지 않음.
function degradeToLatest(lineEl, box, fallback) {
  if (lineEl) { lineEl.textContent = fallback; lineEl.classList.remove('is-period'); }
  if (box) box.remove();
}

// 다건 카드의 기간 종합 로드(카드당 1회). 접힘 줄(.card-summary)과 펼침 박스(.summary-text)를 동시에 채움.
// 단건 카드는 종합이 없으므로 일찍 반환(접힘 줄엔 per-entry 요약이 이미 들어가 있음).
async function loadPeriodSummary(card) {
  if (!card || card.dataset.sumLoaded === '1') return;
  const name = card.dataset.company;
  const co = aggregate().find((x) => x.name === name);
  if (!co || co.entries.length < 2) return;
  card.dataset.sumLoaded = '1';
  const lineEl = card.querySelector('.card-summary');
  const box = card.querySelector('.period-summary');
  const textEl = box ? box.querySelector('.summary-text') : null;
  const fallback = (co.entries[0].summary && String(co.entries[0].summary).trim()) || (co.entries[0].keyPoints || [])[0] || '';
  const [start, end] = periodRange();
  try {
    const { summary } = await API.periodSummary({
      name, start, end,
      entries: co.entries.map((e) => ({ date: e.date, keyPoints: e.keyPoints, implications: e.implications, hancomInsight: e.hancomInsight })),
    });
    if (summary) {
      if (lineEl) lineEl.textContent = summary;
      if (textEl) { textEl.textContent = summary; textEl.classList.remove('opacity-90'); }
    } else {
      degradeToLatest(lineEl, box, fallback);
    }
  } catch {
    degradeToLatest(lineEl, box, fallback);
  }
}
function setupCardInteractions() {
  ['large', 'mid', 'startup'].forEach((k) => {
    const col = document.getElementById('col-' + k);
    col.addEventListener('mousedown', onCardPress);
    col.addEventListener('click', onCardActivate);
    col.addEventListener('keydown', onCardActivate);
  });
}

/* ===== reveal 애니메이션 ===== */
function setupReveal() {
  const o = new IntersectionObserver(
    function (e) {
      e.forEach(function (i) {
        if (i.isIntersecting) {
          i.target.classList.add('sn-visible');
          o.unobserve(i.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.sn-reveal').forEach(function (el) {
    o.observe(el);
  });
}

/* ===== 초기화 ===== */
async function init() {
  setupReveal();
  setupCardInteractions();

  // 전체 보고서(그래프·기간 집계 공용)
  try { state.reports = await API.all(); } catch { state.reports = []; }

  // 그래프/통계: 전체 누적 — graph.js(Cytoscape)가 담당, 미로드 시 buildGraph(SVG) 폴백
  const render = typeof initGraph === 'function' ? initGraph : buildGraph;
  try { render(state.reports); } catch { render([]); }

  // 날짜 목록 → 최신을 기준점으로
  state.dates = (state.reports || []).map((r) => r.date).filter(Boolean).sort((a, b) => b.localeCompare(a));
  state.dateSet = new Set(state.dates);
  // ?date=YYYY-MM-DD 로 특정 기간을 열 수 있게 한다(위클리 픽 → 「대시보드에서 이 주 보기」 딥링크).
  // 값이 없거나 형식이 다르면 기존 동작(최신 날짜)을 그대로 쓴다.
  const qDate = new URLSearchParams(location.search).get('date') || '';
  state.anchor = (/^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : null) || state.dates[0] || todayYmd();
  if (!state.dates.length) { const pls = document.getElementById('periodLabelSummary'); if (pls) pls.textContent = '데이터 없음'; }

  renderToggle();
  renderPeriod();
  renderCal();

  // 일/주/월 토글
  document.querySelectorAll('#modeToggle button').forEach((b) => {
    b.onclick = () => { state.mode = b.dataset.mode; renderToggle(); renderPeriod(); renderCal(); };
  });
  // 기간 네비 ◀ ▶
  document.getElementById('periodPrev').onclick = () => { stepPeriod(-1); renderPeriod(); renderCal(); };
  document.getElementById('periodNext').onclick = () => { stepPeriod(1); renderPeriod(); renderCal(); };

  // 캘린더 카드 토글 — 요약 바 버튼으로 열고 닫기 모두 처리
  const calToggleBtn = document.getElementById('calToggleBtn');
  const calBody = document.getElementById('calBody');
  const calToggleChev = document.getElementById('calToggleChev');
  const calToggleLbl = document.getElementById('calToggleLbl');
  // 기본 상태: 펼쳐진 상태 → 레이블/화살표 초기값 설정
  // 열린 상태: 화살표 ˅(아래) / 닫힌 상태: 화살표 ˄(위)
  if (calToggleChev) calToggleChev.style.transform = '';
  if (calToggleLbl) calToggleLbl.textContent = '캘린더 닫기';
  if (calToggleBtn && calBody) {
    calToggleBtn.addEventListener('click', function () {
      const isNowHidden = calBody.classList.toggle('hidden');
      if (calToggleChev) calToggleChev.style.transform = isNowHidden ? 'rotate(180deg)' : '';
      if (calToggleLbl) calToggleLbl.textContent = isNowHidden ? '캘린더 펼치기' : '캘린더 닫기';
    });
  }

  setupHeroSearch();
}

/* ===== 상단 Hero 검색 — 페이지 이탈 없이 인앱 RAG 답변(원툴/이탈 방지) ===== */
function setupHeroSearch() {
  const form = document.getElementById('heroSearch');
  if (!form || typeof API === 'undefined' || !API.ask) return;
  const q = document.getElementById('heroQ');
  const btn = document.getElementById('heroBtn');
  const ans = document.getElementById('heroAnswer');
  const chipsEl = document.getElementById('heroChips');

  const CHIPS = ['삼성SDS 최근 동향', '멀티 LLM 허브를 추진하는 기업', '조달청과 관련된 기업', 'AI 에이전트 거버넌스 동향'];
  if (chipsEl) {
    chipsEl.innerHTML = CHIPS.map((c) => '<button type="button" class="hero-chip text-xs bg-white border border-ink/10 rounded-full px-3 py-1.5 hover:border-lime-600 transition-colors">' + escapeHtml(c) + '</button>').join('');
    chipsEl.querySelectorAll('.hero-chip').forEach((c) => (c.onclick = () => { q.value = c.textContent; ask(); }));
  }

  function close() { ans.classList.add('hidden'); ans.innerHTML = ''; }

  function srcHTML(s) {
    const links = [];
    if (s.sourceUrl) links.push('<a href="' + safeUrl(s.sourceUrl) + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">원문</a>');
    if (s.confluenceUrl) links.push('<a href="' + safeUrl(s.confluenceUrl) + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">상세</a>');
    return '<div class="bg-beige border border-ink/5 rounded-xl p-2.5">' +
      '<div class="flex items-center gap-1.5"><span class="text-[10px] font-bold text-lime-600">[' + s.n + ']</span>' +
      '<a href="/company?name=' + encodeURIComponent(s.name) + '" class="font-display font-semibold text-xs tracking-tight hover:text-lime-600">' + escapeHtml(s.name) + '</a>' +
      '<span class="text-[10px] text-ink/45 ml-auto">' + escapeHtml(s.date || '') + '</span></div>' +
      (links.length ? '<div class="text-[11px] mt-1 flex gap-2">' + links.join('') + '</div>' : '') + '</div>';
  }

  function answerHTML(data, question) {
    let html = '<div class="flex items-center gap-2 mb-2"><span class="text-[11px] font-bold uppercase tracking-widest text-lime-600">답변</span>' +
      '<span class="text-[11px] text-ink/45">사이트 내 · 이탈 없음</span>' +
      '<button type="button" id="heroAnsClose" aria-label="닫기" class="ml-auto text-ink/40 hover:text-ink text-lg leading-none">×</button></div>';
    if (!data || !data.answer) {
      return html + '<div class="text-sm text-ink/70">관련 자료를 찾지 못했어요. 다른 표현으로 물어봐 주세요.</div>';
    }
    const body = escapeHtml(data.answer).replace(/\[(\d+)\]/g, '<sup class="text-[10px] font-bold text-lime-600 align-super">[$1]</sup>');
    html += '<div class="leading-relaxed whitespace-pre-line text-ink/90 text-sm">' + body + '</div>';
    const srcs = data.sources || [];
    if (srcs.length) {
      html += '<p class="text-[11px] font-semibold tracking-widest text-lime-600 uppercase mt-4 mb-2">출처</p>' +
        '<div class="grid sm:grid-cols-2 gap-2">' + srcs.map(srcHTML).join('') + '</div>';
    }
    html += '<div class="mt-3 text-right"><a href="/explore?q=' + encodeURIComponent(question) + '" class="text-xs text-lime-600 font-semibold hover:underline">탐색 페이지에서 더 보기 →</a></div>';
    return html;
  }

  async function ask() {
    const question = (q.value || '').trim();
    if (!question) return;
    btn.disabled = true;
    ans.classList.remove('hidden');
    ans.innerHTML = '<div class="flex items-center gap-2 text-ink/60 text-sm"><span class="inline-block w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin"></span>자료를 검색하고 답변을 작성하는 중…</div>';
    try {
      const data = await API.ask(question);
      ans.innerHTML = answerHTML(data, question);
    } catch {
      ans.innerHTML = '<div class="text-sm">답변을 가져오지 못했어요. <a href="/explore" class="text-lime-600 hover:underline">검색 페이지</a>에서 다시 시도해 주세요.</div>';
    } finally {
      btn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ask(); } });
  ans.addEventListener('click', (e) => { if (e.target.closest('#heroAnsClose')) close(); });
  // 바깥 클릭·ESC 로 답변 닫기
  document.addEventListener('click', (e) => {
    if (ans.classList.contains('hidden')) return;
    if (!e.target.closest('#heroAnswer') && !e.target.closest('#heroSearch') && !e.target.closest('#heroChips')) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

document.addEventListener('DOMContentLoaded', init);
