/* 홈 지식그래프 — Cytoscape(concentric=레이더형) 온톨로지 내비게이션 허브
   - Company 노드 클릭 → /company?name=
   - Tag 노드 클릭 → /explore?tag=
   - Cytoscape 미로드(CDN 차단 등) 시 dashboard.js 의 buildGraph(SVG) 로 폴백 */
async function initGraph(reports) {
  const ont = buildOntology(reports);
  // 통계의 "그래프 태그" 는 실제로 그려지는 태그 수. 핀 조회는 비동기라 우선 핀 없이 계산해 채우고,
  // 핀을 받은 뒤 아래에서 다시 갱신한다(핀은 태그를 추가하기만 하므로 수가 같거나 늘어난다).
  if (typeof setStats === 'function') {
    setStats(ont.stats.total, ont.stats.companies, ont.stats.dates, selectCuratedTags(reports, ont, [], 3).length, ont.stats.tags);
  }
  const el = document.getElementById('graph');
  if (!el) return;
  if (!ont.companies.length) {
    el.innerHTML = '<div class="h-full flex items-center justify-center text-sm opacity-75">표시할 관계망 데이터가 없습니다</div>';
    return;
  }
  if (typeof cytoscape === 'undefined') {
    if (typeof buildGraph === 'function') buildGraph(reports); // SVG 폴백
    return;
  }
  el.innerHTML = '';

  // 표시 태그 = 핀 ∪ 공유(3개 기업 이상, 기업명 태그 제외) + 고립 기업 보완
  //   — 선정·중요도 정렬은 ontology.js 공용(selectCuratedTags). ?tagmin= 으로 임계값 조정 가능.
  let pinned = [];
  try { const r = await fetch('/api/pinned-tags'); if (r.ok) pinned = await r.json(); } catch { /* 핀 없이 진행 */ }
  const tags = selectCuratedTags(reports, ont, pinned, 3);
  if (typeof setStats === 'function') setStats(ont.stats.total, ont.stats.companies, ont.stats.dates, tags.length, ont.stats.tags);
  const tagSet = new Set(tags);

  // bw = 확대 전 기본 지름(px). 호버 판정 반경을 이 값으로 계산해, 포커스로 노드가 커져도
  // 판정 범위가 함께 커지지 않게 한다(아래 nearestNode 참조).
  const els = [{ data: { id: 'AX', label: 'AX', type: 'ax', level: 0, bw: 22 } }];
  ont.companies.forEach((c) => {
    const deg = [...c.tags].filter((t) => tagSet.has(t)).length;
    els.push({ data: { id: 'company:' + c.name, label: c.name, type: 'company', level: 1, deg, bw: 12 + (Math.min(deg, 5) / 5) * 12 } });
  });
  tags.forEach((t) => els.push({ data: { id: 'tag:' + t, label: '#' + t, type: 'tag', level: 2, bw: 7 } }));
  ont.companies.forEach((c) => els.push({ data: { id: 'eax:' + c.name, source: 'AX', target: 'company:' + c.name, kind: 'hub' } }));
  tags.forEach((t) => ont.tagMap[t].forEach((n) => els.push({ data: { id: 'et:' + n + '::' + t, source: 'company:' + n, target: 'tag:' + t, kind: 'tag' } })));

  const reduce = typeof REDUCED_MOTION !== 'undefined' && REDUCED_MOTION;
  const cy = cytoscape({
    container: el,
    elements: els,
    style: [
      { selector: 'node', css: {
        label: 'data(label)', color: '#fff', 'font-size': 9, 'font-family': 'Inter, Pretendard',
        'text-valign': 'center', 'text-halign': 'right', 'text-margin-x': 3, 'text-events': 'yes',
        'transition-property': 'width height border-width outline-width opacity background-opacity',
        'transition-duration': reduce ? '0s' : '0.13s',
      } },
      { selector: 'node[type="ax"]', css: { 'background-color': '#c8f200', width: 22, height: 22, label: 'AX', color: '#111', 'text-halign': 'center', 'font-weight': 'bold' } },
      { selector: 'node[type="company"]', css: { 'background-color': '#c8f200', width: 'mapData(deg,0,5,12,24)', height: 'mapData(deg,0,5,12,24)', 'font-weight': 600, 'font-size': 10 } },
      { selector: 'node[type="tag"]', css: { 'background-color': '#ffffff', 'background-opacity': 0.55, width: 7, height: 7, opacity: 0.7 } },
      { selector: 'edge', css: { width: 1, 'line-color': '#c8f200', 'line-opacity': 0.4 } },
      { selector: 'edge[kind="tag"]', css: { 'line-color': '#ffffff', 'line-opacity': 0.12 } },
      { selector: '.dim', css: { opacity: 0.12 } },
      { selector: '.hi', css: { opacity: 1, 'line-opacity': 0.9 } },
      // 중간 단계: 강조된 이웃 태그는 기본 7px 로는 너무 작아 라벨이 읽히지 않으므로 2배로 키운다.
      // (포커스된 노드는 아래 .focus 규칙이 뒤에 있어 그쪽 크기가 적용된다)
      { selector: 'node.hi[type="tag"]', css: { width: 14, height: 14, 'background-opacity': 0.95 } },
      // 커서가 근접한 노드 하나만 크게 확대(기본 대비 약 3배) + 라임 헤일로 + 라벨을 어두운 판 위에
      // 크게 올려, 확대됐다는 것이 한눈에 보이게 한다.
      { selector: 'node.focus', css: {
        'border-width': 4, 'border-color': '#ffffff', 'border-opacity': 0.95, 'z-index': 9999,
        'outline-width': 10, 'outline-color': '#c8f200', 'outline-opacity': 0.28, 'outline-offset': 2,
        'font-weight': 'bold', 'text-margin-x': 10, 'text-background-color': '#111',
        'text-background-opacity': 0.85, 'text-background-padding': 5, 'text-background-shape': 'roundrectangle',
      } },
      { selector: 'node.focus[type="company"]', css: { width: 'mapData(deg,0,5,38,64)', height: 'mapData(deg,0,5,38,64)' } },
      { selector: 'node.focus[type="ax"]', css: { width: 52, height: 52 } },
      { selector: 'node.focus[type="tag"]', css: { width: 26, height: 26, 'background-opacity': 1, opacity: 1 } },
    ],
    // force(cose) 레이아웃 — 연결된 기업·태그가 서로 끌려 붙어 관계가 가깝게 보임(concentric 의 링 분리 해소)
    layout: {
      name: 'cose', animate: !reduce, randomize: true, padding: 20,
      idealEdgeLength: 70, nodeRepulsion: 5500, edgeElasticity: 120,
      gravity: 0.75, numIter: 1200, nodeDimensionsIncludeLabels: false,
    },
    wheelSensitivity: 0.2,
    autoungrabify: true,
  });

  // 줌 레벨별 라벨 가독성: 축소(overview) 시 라벨이 너무 작아 안 보이는 문제 해소.
  //  - 기업/AX 라벨은 화면상 거의 일정 크기로 유지(font-size = 목표px / zoom, 범위 제한)
  //  - 태그 라벨은 텍스트 클러터라 축소하면 숨기고, 확대하거나 호버하면 표시
  const clampF = (px, z, lo, hi) => Math.max(lo, Math.min(hi, Math.round(px / z)));
  let focused = null; // 커서 근접 포커스 대상(아래 포커스 블록에서 사용) — zoom 핸들러보다 먼저 선언
  function applyZoomLabels() {
    const z = cy.zoom() || 1;
    const showTags = z >= 0.85;
    cy.batch(() => {
      cy.nodes('[type="company"]').style('font-size', clampF(12, z, 9, 28));
      cy.nodes('[type="ax"]').style('font-size', clampF(13, z, 11, 30));
      if (showTags) cy.nodes('[type="tag"]').removeStyle('label').style('font-size', clampF(10, z, 8, 20));
      else cy.nodes('[type="tag"]').style('label', '');
    });
  }
  cy.on('zoom', () => { applyZoomLabels(); if (focused) applyFocusFont(focused); });

  /* ── 커서 근접 포커스 ─────────────────────────────────────────────────────
     노드가 작아 정확히 겨냥해야 하는 불편을 줄이려는 장치.
     커서에 가장 가까운 노드 하나를 (반지름 + 여유 20px 안에서) 골라 확대·강조하고,
     빈 곳을 눌러도 그 노드로 이동한다. 커서를 옮기면 포커스도 따라 옮겨간다. */
  const HOVER_PAD = 20; // 화면 기준 여유 반경(px)

  function nearestNode(rp) {
    if (!rp) return null;
    const z = cy.zoom() || 1;
    let best = null, bestScore = Infinity;
    cy.nodes().forEach((n) => {
      const p = n.renderedPosition();
      // 판정 반경은 '확대 전' 크기(bw) 기준 — 포커스로 커진 크기를 쓰면 판정 범위가 계속 커진다.
      // 단 포커스 중인 노드는 확대된 원 안쪽에서 포커스가 풀려 깜빡이지 않도록 실제 크기까지 인정한다.
      const r = (n.data('bw') || 12) * z / 2 + HOVER_PAD;
      const d = Math.hypot(p.x - rp.x, p.y - rp.y);
      if (d > (n.hasClass('focus') ? Math.max(r, n.renderedWidth() / 2 + 4) : r)) return;
      // 커서에서 실제로 가장 가까운 노드를 잡는다. 거리를 노드 크기로 정규화하면 판정 반경이
      // 작은 태그점이 옆에 붙은 기업 노드에 계속 밀려, 점 위에 정확히 올려야만 잡히게 된다.
      let score = d;
      if (focused && focused.id() === n.id()) score *= 0.85; // 히스테리시스: 잡은 노드가 쉽게 풀리지 않게
      if (score < bestScore) { bestScore = score; best = n; }
    });
    return best;
  }
  function applyFocusFont(n) {
    const z = cy.zoom() || 1;
    // 인라인 지정 — applyZoomLabels 가 넣는 기본 font-size 를 덮어쓴다
    n.style('font-size', clampF(n.data('type') === 'tag' ? 20 : 24, z, 16, 52));
  }
  function clearFocus() {
    if (!focused) return;
    focused = null;
    cy.elements().removeClass('dim hi focus');
    cy.nodes().removeStyle('font-size');
    applyZoomLabels();
    el.style.cursor = '';
  }
  function focusNode(n) {
    if (focused && focused.id() === n.id()) return;
    cy.nodes().removeStyle('font-size'); // 직전 포커스의 확대 폰트 제거
    applyZoomLabels();                   // 라벨·폰트 기본값 복원 (batch 중첩을 피해 밖에서 호출)
    const z = cy.zoom() || 1;
    cy.batch(() => {
      cy.elements().removeClass('hi focus').addClass('dim');
      const nb = n.closedNeighborhood();
      nb.removeClass('dim').addClass('hi');
      // 강조된 이웃은 라벨을 줌과 무관하게 표시하고, 기본 폰트로는 읽기 어려우니 함께 키운다.
      // (기업에 호버하면 연결된 태그 이름들이 같이 읽히는 효과 — 태그마다 겨냥할 필요가 없다)
      nb.nodes('[type="tag"]').removeStyle('label').style('font-size', clampF(14, z, 11, 26));
      nb.nodes('[type="company"]').style('font-size', clampF(14, z, 11, 26));
      n.addClass('focus').removeStyle('label');
      applyFocusFont(n); // 포커스 노드 본인은 가장 크게 — 이웃 폰트 지정 뒤에 덮어쓴다
    });
    focused = n;
    el.style.cursor = 'pointer';
  }
  // mousemove 는 초당 수십 번 오므로 프레임당 1회만 근접 계산(노드 수 × 프레임 비용 억제)
  let pendingRp = null, rafId = 0;
  cy.on('mousemove', (e) => {
    pendingRp = e.renderedPosition;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const n = nearestNode(pendingRp);
      if (n) focusNode(n); else clearFocus();
    });
  });
  el.addEventListener('mouseleave', () => { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } clearFocus(); });

  function navigate(n) {
    const ty = n.data('type');
    if (ty === 'company') location.href = '/company?name=' + encodeURIComponent(n.data('label'));
    else if (ty === 'tag') location.href = '/explore?tag=' + encodeURIComponent(String(n.data('label')).replace(/^#/, ''));
  }
  cy.on('tap', 'node', (e) => navigate(e.target));
  // 배경 탭: 근접 노드가 있으면 그 노드로 이동(작은 노드를 정확히 누르지 않아도 되게), 없으면 화면 맞춤
  cy.on('tap', (e) => {
    if (e.target !== cy) return;
    const n = nearestNode(e.renderedPosition);
    if (n) navigate(n); else cy.fit(undefined, 28);
  });
  setTimeout(() => { cy.resize(); cy.fit(undefined, 28); applyZoomLabels(); }, 100);
}
