/* 기업 — 카드 그리드(검색·카테고리 필터·정렬) + 상세(?name=)  /api/reports/all 재사용 */
let REPORTS = [], ONT = null;
let cq = '', activeCat = null, sortBy = 'latest'; // 'latest'(최신 분석일) | 'count'(등장 횟수)
const CATS = ['대기업', '중견기업', '스타트업·중소'];

function getParam(k) { return new URLSearchParams(location.search).get(k); }
function el(id) { return document.getElementById(id); }

async function init() {
  try { REPORTS = await API.all(); } catch { REPORTS = []; }
  ONT = buildOntology(REPORTS);

  const name = getParam('name');
  if (name && ONT.companies.some((c) => c.name === name)) {
    el('compBrowse').classList.add('hidden'); // 상세 진입 시 그리드 숨김
    renderDetail(name);
    return;
  }

  el('cq').addEventListener('input', (e) => { cq = e.target.value.trim().toLowerCase(); renderGrid(); });
  el('sortToggle').addEventListener('click', () => { sortBy = sortBy === 'latest' ? 'count' : 'latest'; renderGrid(); });
  renderCatFilter();
  renderGrid();
}

function renderCatFilter() {
  const chip = (label, val) =>
    '<button class="catchip text-xs rounded-full px-3 py-1.5 border ' +
    (activeCat === val ? 'bg-lime border-lime text-ink font-semibold' : 'bg-beige border-ink/5 text-ink/80 hover:border-lime') +
    '" data-c="' + (val === null ? '' : escapeHtml(val)) + '">' + label + '</button>';
  el('catFilter').innerHTML = chip('전체', null) + CATS.map((c) => chip(c, c)).join('');
  el('catFilter').querySelectorAll('.catchip').forEach((b) => b.onclick = () => {
    activeCat = b.dataset.c || null;
    renderCatFilter();
    renderGrid();
  });
}

function renderGrid() {
  let rows = ONT.companies.slice();
  if (activeCat) rows = rows.filter((c) => c.category === activeCat);
  if (cq) rows = rows.filter((c) => (c.name + ' ' + [...c.tags].join(' ') + ' ' + (c.latest || '')).toLowerCase().includes(cq));
  rows.sort((a, b) => sortBy === 'latest'
    ? (b.latestDate || '').localeCompare(a.latestDate || '') || b.count - a.count
    : b.count - a.count || (b.latestDate || '').localeCompare(a.latestDate || ''));
  el('compCount').textContent = rows.length + '개 기업' + (activeCat ? ' · ' + activeCat : '');
  el('sortToggle').textContent = '정렬: ' + (sortBy === 'latest' ? '최신순' : '등장순');
  el('compGrid').innerHTML = rows.map(cardHTML).join('') || '<div class="text-sm text-ink/75 p-4">결과 없음</div>';
}

// Template index.html 의 에디토리얼 카드 스타일. 첫 카드는 다크 featured(light+dark 페어링).
const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';

function cardHTML(c, i) {
  const dark = i === 0; // 최신순 첫 기업을 다크 카드로 강조
  const tags = [...c.tags].slice(0, 3);
  const cardCls = dark
    ? 'bg-ink text-white hover:shadow-xl hover:shadow-ink/20'
    : 'bg-white border border-ink/5 hover:shadow-xl hover:shadow-ink/5';
  const eyebrow = dark ? 'text-lime' : 'text-lime-600';
  const sub = dark ? 'text-white/60' : 'text-ink/55';
  const body = dark ? 'text-white/70' : 'text-ink/70';
  const chip = dark ? 'text-white/70 bg-white/10 border-white/10' : 'text-ink/70 bg-beige border-ink/5';
  const arrowWrap = dark ? 'bg-white/10 group-hover:bg-lime group-hover:text-ink' : 'bg-beige group-hover:bg-lime';
  return '<a href="/company?name=' + encodeURIComponent(c.name) + '" class="group block p-7 sm:p-9 rounded-[28px] transition-all duration-300 ' + cardCls + '">' +
    '<div class="flex items-center gap-2 mb-4">' +
    '<span class="text-sm font-bold uppercase tracking-widest ' + eyebrow + '">' + escapeHtml(c.category || '') + '</span>' +
    '<span class="text-xs ' + sub + ' ml-auto">' + escapeHtml(c.latestDate || '') + (c.count ? ' · ' + c.count + '회' : '') + '</span></div>' +
    '<h3 class="text-2xl sm:text-3xl font-display font-bold tracking-tight mb-3">' + escapeHtml(c.name) + '</h3>' +
    '<p class="' + body + ' leading-relaxed mb-6 line-clamp-3">' + escapeHtml(c.latest || '') + '</p>' +
    '<div class="flex items-center gap-2 flex-wrap">' +
    tags.map((t) => '<span class="text-[11px] rounded-full px-2.5 py-0.5 border ' + chip + '">#' + escapeHtml(t) + '</span>').join('') +
    '<span class="ml-auto w-10 h-10 rounded-full flex items-center justify-center transition-colors ' + arrowWrap + '">' + ARROW + '</span>' +
    '</div></a>';
}

const sec = (t, a) => (a && a.length)
  ? '<div class="mt-2"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-1.5">' + t + '</div><ul class="space-y-1.5">' +
    a.map((x) => '<li class="text-sm opacity-80 pl-3 relative before:content-[\'\'] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-ink/30">' + escapeHtml(x) + '</li>').join('') + '</ul></div>'
  : '';

function renderDetail(name) {
  const ap = [];
  REPORTS.forEach((r) => (r.companies || []).filter((c) => c.name === name).forEach((c) => ap.push({ date: r.date, ...c })));
  ap.sort((a, b) => b.date.localeCompare(a.date));
  const tags = [...new Set(ap.flatMap((a) => a.tags || []))];
  const cat = ap[0] ? ap[0].category : '';
  const related = ONT.companies.filter((c) => c.name !== name && [...c.tags].some((t) => tags.includes(t))).slice(0, 6).map((c) => c.name);

  const timeline = ap.map((a) => {
    const src = safeUrl(a.sourceUrl), conf = safeUrl(a.confluenceUrl);
    let links = '';
    if (src) links += '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener noreferrer" class="text-xs border border-ink/10 rounded-full px-3 py-1.5 hover:bg-ink hover:text-white">출처 기사</a>';
    if (conf) links += '<a href="' + escapeHtml(conf) + '" target="_blank" rel="noopener noreferrer" class="text-xs border border-ink/10 rounded-full px-3 py-1.5 hover:bg-ink hover:text-white">상세 모니터링</a>';
    return '<div class="relative">' +
      '<div class="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-lime border-2 border-white"></div>' +
      '<div class="text-xs font-bold text-lime-600">' + escapeHtml(a.date) + '</div>' +
      sec('주요 내용', a.keyPoints) + sec('시사점', a.implications) +
      ((a.hancomInsight && a.hancomInsight.length) ? '<div class="bg-lime/10 border border-lime/40 rounded-xl p-3 mt-2"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-1.5">한컴 인사이트</div><ul class="space-y-1.5">' + a.hancomInsight.map((x) => '<li class="text-sm pl-3 relative before:content-[\'\'] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-lime-600">' + escapeHtml(x) + '</li>').join('') + '</ul></div>' : '') +
      (links ? '<div class="flex flex-wrap gap-2 mt-2">' + links + '</div>' : '') +
      '</div>';
  }).join('');

  const tagsHTML = tags.map((t) => '<a href="/explore?tag=' + encodeURIComponent(t) + '" class="text-xs bg-white border border-ink/5 rounded-full px-2.5 py-1 hover:border-lime">#' + escapeHtml(t) + '</a>').join('');
  document.getElementById('compDetail').innerHTML =
    // 헤더 (전체 폭)
    '<div class="mb-6">' +
      '<div class="flex items-center gap-3 flex-wrap"><h2 class="font-display font-bold text-3xl tracking-tight">' + escapeHtml(name) + '</h2><span class="text-xs bg-white border border-ink/5 rounded-full px-3 py-1 text-ink/70">' + escapeHtml(cat) + '</span></div>' +
      '<div class="flex items-baseline gap-6 mt-2 text-sm text-ink/80"><span><b class="font-display text-lg text-ink">' + ap.length + '</b> 회 등장</span><span>최근 <b class="text-ink">' + escapeHtml(ap[0] ? ap[0].date : '-') + '</b></span><span><b class="font-display text-lg text-ink">' + tags.length + '</b> 태그</span></div>' +
      '<div class="flex flex-wrap gap-1.5 mt-3">' + tagsHTML + '</div>' +
    '</div>' +
    // 2단: 좌(주요 동향 2/3) · 우(회사정보+재무, 비동기 로드)
    '<div class="grid lg:grid-cols-3 gap-6 items-start">' +
      '<div id="detailMain" class="lg:col-span-2 bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-6">' +
        '<div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-3">주요 동향</div>' +
        '<div class="space-y-5 border-l-2 border-lime/40 pl-5">' + timeline + '</div>' +
      '</div>' +
      '<div id="compProfile" class="space-y-6"></div>' +
    '</div>' +
    // 연관 기업 (전체 폭)
    (related.length ? '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-6 mt-6"><div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-2">연관 기업 (태그 공유)</div><div class="flex flex-wrap gap-2">' + related.map((n) => '<a href="/company?name=' + encodeURIComponent(n) + '" class="text-sm rounded-full px-3 py-1.5 border bg-white border-ink/10 hover:border-lime">' + escapeHtml(n) + '</a>').join('') + '</div></div>' : '');
  loadProfile(name);
}

/* ===== 회사정보 + 재무(DART) — 우측 컬럼 ===== */
function fmtKRW(n) {
  if (n == null) return '-';
  const neg = n < 0, a = Math.abs(n);
  let s;
  if (a >= 1e12) s = (a / 1e12).toFixed(a / 1e12 >= 10 ? 0 : 1) + '조';
  else if (a >= 1e8) s = Math.round(a / 1e8).toLocaleString() + '억';
  else s = Math.round(a).toLocaleString();
  return (neg ? '-' : '') + s;
}
function yoyBadge(y) {
  if (y == null) return '';
  const up = y >= 0, cls = up ? 'text-lime-600' : 'text-rose-500', ar = up ? '▲' : '▼';
  return '<span class="text-xs font-semibold ' + cls + '">' + ar + ' ' + (Math.abs(y) * 100).toFixed(1) + '% <span class="text-ink/45 font-normal">전년比</span></span>';
}
function metricRow(label, series, yoy) {
  if (!series || !series.length) return '';
  const latest = series[series.length - 1];
  return '<div class="flex items-baseline gap-3 py-2.5 border-b border-ink/5 last:border-0">' +
    '<span class="text-sm text-ink/60 w-16 flex-none">' + label + '</span>' +
    '<span class="font-display font-bold text-xl tracking-tight">' + fmtKRW(latest.value) + '</span>' +
    '<span class="text-[11px] text-ink/45">' + latest.year + '년</span>' +
    '<span class="ml-auto">' + yoyBadge(yoy) + '</span></div>';
}
// 매출액·영업이익 분기별 묶음 막대 + 범례.
// 값 범위가 억~조 단위로 크고 음수도 있어 √(제곱근) 스케일 + 0 기준선(가운데 선) 사용.
// 막대 높이는 √보정(크기 순서 유지·시인성 확보), 정확한 값은 라벨로 표기.
function groupedBarChart(pts) {
  const flat = pts.flatMap((p) => [p.revenue, p.operatingProfit]).filter((v) => v != null);
  if (!flat.length) return '';
  const W = 400, H = 210, padT = 34, padB = 30, padX = 12, ph = H - padT - padB, pw = W - padX * 2;
  const mag = (v) => Math.sqrt(Math.abs(v)); // √ 스케일: 큰 값 압축, 작은 값 가시화
  const maxPosS = Math.max(0, ...flat.map((v) => (v > 0 ? mag(v) : 0)));
  const maxNegS = Math.max(0, ...flat.map((v) => (v < 0 ? mag(v) : 0)));
  const span = (maxPosS + maxNegS) || 1, scale = ph / span, zeroY = padT + maxPosS * scale;
  const n = pts.length, slot = pw / n, bw = Math.min(20, slot * 0.3), gap = 6;
  let g = '';
  // 범례
  g += '<rect x="' + padX + '" y="10" width="11" height="11" rx="2" fill="#c8f200"/><text x="' + (padX + 16) + '" y="19" font-size="11" fill="#111">매출액</text>';
  g += '<rect x="' + (padX + 72) + '" y="10" width="11" height="11" rx="2" fill="#111"/><text x="' + (padX + 88) + '" y="19" font-size="11" fill="#111">영업이익</text>';
  // 0 기준선(가운데 선)
  g += '<line x1="' + padX + '" y1="' + zeroY + '" x2="' + (W - padX) + '" y2="' + zeroY + '" stroke="#111" stroke-opacity=".18" stroke-width="1"/>';
  pts.forEach((p, i) => {
    const cx = padX + slot * i + slot / 2;
    const labels = [];
    [['revenue', '#c8f200', -(bw + gap / 2)], ['operatingProfit', '#111', gap / 2]].forEach(([key, color, off]) => {
      const v = p[key];
      if (v == null) { labels.push(null); return; }
      const x = cx + off, h = Math.max(2, mag(v) * scale);
      const y = v >= 0 ? zeroY - h : zeroY;
      g += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="2" fill="' + color + '"/>';
      let ly = v >= 0 ? y - 5 : zeroY + h + 11;
      labels.push({ x: x + bw / 2, ly, v });
    });
    // 같은 방향(위/아래) 라벨이 겹치면 9px 간격으로 분리
    const [a, b] = labels;
    if (a && b && (a.v >= 0) === (b.v >= 0) && Math.abs(a.ly - b.ly) < 9) {
      if (a.v >= 0) { if (a.ly <= b.ly) a.ly = b.ly - 9; else b.ly = a.ly - 9; }
      else { if (a.ly >= b.ly) a.ly = b.ly + 9; else b.ly = a.ly + 9; }
    }
    labels.forEach((L) => {
      if (!L) return;
      const ly = Math.max(10, Math.min(H - 20, L.ly)); // 상단/분기라벨과 충돌 방지
      g += '<text x="' + L.x + '" y="' + ly + '" text-anchor="middle" font-size="8.5" font-weight="700" fill="#111">' + fmtKRW(L.v) + '</text>';
    });
    g += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="#888">' + escapeHtml(p.period) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" preserveAspectRatio="xMidYMid meet">' + g + '</svg>';
}
function companyCard(c) {
  const rows = [];
  if (c.ceo) rows.push(['대표자', escapeHtml(c.ceo)]);
  if (c.established) rows.push(['설립일', escapeHtml(c.established)]);
  if (c.corpClass || c.stockCode) rows.push(['상장', escapeHtml([c.corpClass, c.stockCode].filter(Boolean).join(' · '))]);
  if (c.industryCode) rows.push(['업종코드', escapeHtml(c.industryCode)]);
  if (c.address) rows.push(['주소', escapeHtml(c.address)]);
  if (c.homepage) { const u = safeUrl(c.homepage); if (u) rows.push(['홈페이지', '<a href="' + u + '" target="_blank" rel="noopener" class="text-lime-600 hover:underline">' + escapeHtml(c.homepage.replace(/^https?:\/\//, '')) + '</a>']); }
  if (!rows.length) return '';
  return '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-5">' +
    '<div class="text-xs font-bold uppercase tracking-widest text-lime-600 mb-3">회사 정보</div>' +
    '<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">' +
    rows.map(([k, v]) => '<dt class="text-ink/55">' + k + '</dt><dd class="text-ink/90 break-all">' + v + '</dd>').join('') +
    '</dl></div>';
}
function financeCard(f) {
  if (!f) return '';
  const a = f.annual, q = f.quarterly;
  if (!a && !(q && q.length)) return '';
  let html = '<div class="bg-white rounded-[24px] border border-ink/5 shadow-xl shadow-ink/5 p-5">' +
    '<div class="flex items-center gap-2 mb-2"><div class="text-xs font-bold uppercase tracking-widest text-lime-600">재무</div><span class="text-[10px] text-ink/45 ml-auto">출처: DART' + (a && a.fs ? ' · ' + a.fs : '') + ' · 단위 원</span></div>';
  if (a) html += '<div>' + metricRow('매출액', a.revenue, a.revenueYoY) + metricRow('영업이익', a.operatingProfit, a.operatingProfitYoY) + '</div>';
  if (q && q.length) html += '<div class="border-t border-ink/5 pt-3 mt-3"><div class="text-[11px] font-semibold text-ink/55 mb-1">분기 추이 (최신 4분기)</div>' + groupedBarChart(q) + '</div>';
  return html + '</div>';
}
async function loadProfile(name) {
  const right = document.getElementById('compProfile');
  if (!right) return;
  let d = null;
  try { d = await API.companyProfile(name); } catch { d = null; }
  if (d && d.available) {
    const html = (d.company ? companyCard(d.company) : '') + (d.financials ? financeCard(d.financials) : '');
    if (html.trim()) { right.innerHTML = html; return; }
  }
  // 데이터 없음(해외·미매핑) → 우측 제거, 좌측 전체폭
  right.remove();
  const main = document.getElementById('detailMain');
  if (main) { main.classList.remove('lg:col-span-2'); main.classList.add('lg:col-span-3'); }
}

document.addEventListener('DOMContentLoaded', init);
