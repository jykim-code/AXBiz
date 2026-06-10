/* 메인 대시보드 — API 연동, 지식 그래프(전체 누적), 스윔레인 카드, 캘린더 */

// 분류 키 → 컬럼. 키 목록은 functions/api/reports.js 의 CATEGORIES 와 반드시 일치시킬 것
// (불일치 시 해당 분류 카드가 조용히 누락됨).
const CAT = { 대기업: 'large', 중견기업: 'mid', '스타트업·중소': 'startup' };

/* ===== 상태 ===== */
const state = {
  reports: [], // 전체 보고서 [{date, companies}] — 기간 집계용
  dates: [], // 데이터 있는 날짜 (desc)
  dateSet: new Set(), // 빠른 조회용
  mode: 'day', // 'day' | 'week' | 'month'
  anchor: null, // 기준 날짜 'YYYY-MM-DD'
};

/* ===== 지식 그래프 (전체 기간 누적) ===== */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

function setStats(total, companies, dates, tags) {
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statCompanies').textContent = companies;
  document.getElementById('statDates').textContent = dates;
  document.getElementById('statTags').textContent = tags;
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

  setStats(all.length, companies.length, (reports || []).length, allTags.length);

  // 그래프 가독성: 빈도(연결 기업 수) 상위 30개 태그만 표시 (통계는 전체 기준)
  const tags = allTags.sort((a, b) => tagMap[b].length - tagMap[a].length || a.localeCompare(b)).slice(0, 30);

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
function icon(t) {
  if (t === 'link')
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
}

const bullets = (a) =>
  '<ul class="space-y-2">' +
  a
    .map(
      (x) =>
        '<li class="text-sm leading-relaxed opacity-80 pl-4 relative before:content-[\'\'] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-ink/30">' +
        escapeHtml(x) +
        '</li>'
    )
    .join('') +
  '</ul>';

// 한 건(날짜)의 상세: 주요 내용 / 시사점 / 한컴 인사이트 / 링크
function entryDetail(e) {
  const src = safeUrl(e.sourceUrl), conf = safeUrl(e.confluenceUrl);
  let h = '';
  if (e.keyPoints && e.keyPoints.length)
    h += '<div><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-2">주요 내용</div>' + bullets(e.keyPoints) + '</div>';
  if (e.implications && e.implications.length)
    h += '<div><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-2">시사점</div>' + bullets(e.implications) + '</div>';
  if (e.hancomInsight && e.hancomInsight.length)
    h += '<div class="bg-lime/15 border border-lime rounded-2xl p-4"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-2">한컴 인사이트</div><ul class="space-y-2">' +
      e.hancomInsight.map((x) => '<li class="text-sm leading-relaxed pl-4 relative before:content-[\'\'] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-lime-600">' + escapeHtml(x) + '</li>').join('') + '</ul></div>';
  if (src || conf) {
    h += '<div class="flex flex-wrap gap-2 pt-1">';
    if (src) h += '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener noreferrer" class="text-xs font-medium border border-ink/10 rounded-full px-3.5 py-2 flex items-center gap-1.5 hover:bg-ink hover:text-white transition-colors">' + icon('link') + ' 출처 기사</a>';
    if (conf) h += '<a href="' + escapeHtml(conf) + '" target="_blank" rel="noopener noreferrer" class="text-xs font-medium border border-ink/10 rounded-full px-3.5 py-2 flex items-center gap-1.5 hover:bg-ink hover:text-white transition-colors">' + icon('doc') + ' 상세 모니터링</a>';
    h += '</div>';
  }
  return h;
}

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
    '<p class="card-summary text-sm font-bold text-ink mt-1.5 leading-snug">' + sumText + '</p></div>' +
    '<span class="chev flex-none mt-1 opacity-75 transition-transform duration-300"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="m6 9 6 6 6-6"/></svg></span></div>';
  h += '<div class="card-body"><div class="px-6 pb-6 space-y-5">';
  // 기간 종합(다건일 때, 펼침 시 lazy 로드)
  if (n > 1)
    h += '<div class="period-summary">' +
      '<div class="text-[11px] font-bold uppercase tracking-widest text-lime-600 mb-1">기간 종합</div>' +
      '<div class="bg-ink rounded-xl p-3"><p class="summary-text text-sm leading-relaxed text-white opacity-90">종합 생성 중…</p></div></div>';
  if (n > 1) {
    // 날짜별 미니 타임라인(최신순)
    h += '<div class="space-y-5 border-l-2 border-lime/40 pl-5">';
    entries.forEach((e) => {
      h += '<div class="relative"><div class="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-lime border-2 border-white"></div>' +
        '<div class="text-xs font-bold text-lime-600 mb-2">' + escapeHtml(e.date) + '</div>' +
        '<div class="space-y-4">' + entryDetail(e) + '</div></div>';
    });
    h += '</div>';
  } else {
    h += '<div class="space-y-5">' + entryDetail(latest) + '</div>';
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

/* ===== 기간 브리핑 ===== */
function updateBrief(items, cols) {
  document.getElementById('briefKind').textContent = { day: 'Daily', week: 'Weekly', month: 'Monthly' }[state.mode];
  document.getElementById('briefDate').textContent = periodLabel();
  document.getElementById('briefCount').textContent = items.length;
  const bd = document.getElementById('briefBreakdown');
  const tagsEl = document.getElementById('briefTags');
  if (!items.length) { bd.textContent = '데이터 없음'; tagsEl.innerHTML = ''; return; }
  bd.textContent = '대기업 ' + cols.large.length + ' · 중견 ' + cols.mid.length + ' · 스타트업 ' + cols.startup.length;
  const freq = {};
  items.forEach((c) => (c.tags || []).forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
  const top = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 6);
  tagsEl.innerHTML = top
    .map((t) => '<span class="text-[11px] opacity-80 bg-beige border border-ink/5 rounded-full px-2.5 py-0.5">#' + escapeHtml(t) + '</span>')
    .join('');
}

/* ===== 기간 카드 렌더 ===== */
function renderPeriod() {
  const label = periodLabel();
  document.getElementById('selDate').textContent = label;
  document.getElementById('periodLabel').textContent = label; // 하단 네비 기간 라벨
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
      (has && !me ? '<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-lime-600"></span>' : '') +
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
    b.className = 'flex-1 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ' +
      (b.dataset.mode === state.mode ? 'bg-ink text-lime' : 'text-ink/60 hover:text-ink');
  });
}

/* ===== 카드 토글 (이벤트 위임 + 키보드) ===== */
function onCardActivate(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  if (e.target.closest('a')) return; // 카드 내 링크는 그대로 동작
  if (e.type === 'keydown') {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
  }
  const open = card.classList.toggle('open');
  card.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) loadPeriodSummary(card);
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
      if (lineEl) lineEl.textContent = fallback; // 종합 실패 → 접힘 줄은 최신 요약으로
      if (box) box.remove();                     // 펼침 박스는 숨김(타임라인은 그대로)
    }
  } catch {
    if (lineEl) lineEl.textContent = fallback;
    if (box) box.remove();
  }
}
function setupCardInteractions() {
  ['large', 'mid', 'startup'].forEach((k) => {
    const col = document.getElementById('col-' + k);
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
  state.anchor = state.dates[0] || todayYmd();
  if (!state.dates.length) document.getElementById('selDate').textContent = '데이터 없음';

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
}

document.addEventListener('DOMContentLoaded', init);
