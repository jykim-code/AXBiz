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

  const els = [{ data: { id: 'AX', label: 'AX', type: 'ax', level: 0 } }];
  ont.companies.forEach((c) => els.push({ data: { id: 'company:' + c.name, label: c.name, type: 'company', level: 1, deg: [...c.tags].filter((t) => tagSet.has(t)).length } }));
  tags.forEach((t) => els.push({ data: { id: 'tag:' + t, label: '#' + t, type: 'tag', level: 2 } }));
  ont.companies.forEach((c) => els.push({ data: { id: 'eax:' + c.name, source: 'AX', target: 'company:' + c.name, kind: 'hub' } }));
  tags.forEach((t) => ont.tagMap[t].forEach((n) => els.push({ data: { id: 'et:' + n + '::' + t, source: 'company:' + n, target: 'tag:' + t, kind: 'tag' } })));

  const reduce = typeof REDUCED_MOTION !== 'undefined' && REDUCED_MOTION;
  const cy = cytoscape({
    container: el,
    elements: els,
    style: [
      { selector: 'node', css: { label: 'data(label)', color: '#fff', 'font-size': 9, 'font-family': 'Inter, Pretendard', 'text-valign': 'center', 'text-halign': 'right', 'text-margin-x': 3, 'text-events': 'yes' } },
      { selector: 'node[type="ax"]', css: { 'background-color': '#c8f200', width: 22, height: 22, label: 'AX', color: '#111', 'text-halign': 'center', 'font-weight': 'bold' } },
      { selector: 'node[type="company"]', css: { 'background-color': '#c8f200', width: 'mapData(deg,0,5,12,24)', height: 'mapData(deg,0,5,12,24)', 'font-weight': 600, 'font-size': 10 } },
      { selector: 'node[type="tag"]', css: { 'background-color': '#ffffff', 'background-opacity': 0.55, width: 7, height: 7, opacity: 0.7 } },
      { selector: 'edge', css: { width: 1, 'line-color': '#c8f200', 'line-opacity': 0.4 } },
      { selector: 'edge[kind="tag"]', css: { 'line-color': '#ffffff', 'line-opacity': 0.12 } },
      { selector: '.dim', css: { opacity: 0.12 } },
      { selector: '.hi', css: { opacity: 1, 'line-opacity': 0.9 } },
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
  cy.on('zoom', applyZoomLabels);

  cy.on('mouseover', 'node', (e) => {
    cy.elements().addClass('dim');
    const nb = e.target.closedNeighborhood();
    nb.removeClass('dim').addClass('hi');
    nb.nodes('[type="tag"]').removeStyle('label'); // 강조된 이웃의 태그 라벨은 줌과 무관하게 표시
  });
  cy.on('mouseout', 'node', () => { cy.elements().removeClass('dim hi'); applyZoomLabels(); });
  cy.on('tap', 'node', (e) => {
    const ty = e.target.data('type');
    if (ty === 'company') location.href = '/company?name=' + encodeURIComponent(e.target.data('label'));
    else if (ty === 'tag') location.href = '/explore?tag=' + encodeURIComponent(String(e.target.data('label')).replace(/^#/, ''));
  });
  cy.on('tap', (e) => { if (e.target === cy) cy.fit(undefined, 28); });
  setTimeout(() => { cy.resize(); cy.fit(undefined, 28); applyZoomLabels(); }, 100);
}
