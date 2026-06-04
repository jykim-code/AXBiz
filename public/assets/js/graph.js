/* 홈 지식그래프 — Cytoscape(concentric=레이더형) 온톨로지 내비게이션 허브
   - Company 노드 클릭 → /company?name=
   - Tag 노드 클릭 → /explore?tag=
   - Cytoscape 미로드(CDN 차단 등) 시 dashboard.js 의 buildGraph(SVG) 로 폴백 */
function initGraph(reports) {
  const ont = buildOntology(reports);
  if (typeof setStats === 'function') setStats(ont.stats.total, ont.stats.companies, ont.stats.dates, ont.stats.tags);
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

  const els = [{ data: { id: 'AX', label: 'AX', type: 'ax', level: 0 } }];
  ont.companies.forEach((c) => els.push({ data: { id: 'company:' + c.name, label: c.name, type: 'company', level: 1, deg: c.tags.size } }));
  ont.tags.forEach((t) => els.push({ data: { id: 'tag:' + t, label: '#' + t, type: 'tag', level: 2 } }));
  ont.companies.forEach((c) => els.push({ data: { id: 'eax:' + c.name, source: 'AX', target: 'company:' + c.name, kind: 'hub' } }));
  ont.tags.forEach((t) => ont.tagMap[t].forEach((n) => els.push({ data: { id: 'et:' + n + '::' + t, source: 'company:' + n, target: 'tag:' + t, kind: 'tag' } })));

  const reduce = typeof REDUCED_MOTION !== 'undefined' && REDUCED_MOTION;
  const cy = cytoscape({
    container: el,
    elements: els,
    style: [
      { selector: 'node', css: { label: 'data(label)', color: '#fff', 'font-size': 9, 'font-family': 'Inter, Pretendard', 'text-valign': 'center', 'text-halign': 'right', 'text-margin-x': 3 } },
      { selector: 'node[type="ax"]', css: { 'background-color': '#c8f200', width: 22, height: 22, label: 'AX', color: '#111', 'text-halign': 'center', 'font-weight': 'bold' } },
      { selector: 'node[type="company"]', css: { 'background-color': '#c8f200', width: 'mapData(deg,0,5,12,24)', height: 'mapData(deg,0,5,12,24)', 'font-weight': 600, 'font-size': 10 } },
      { selector: 'node[type="tag"]', css: { 'background-color': '#ffffff', 'background-opacity': 0.55, width: 7, height: 7, opacity: 0.7 } },
      { selector: 'edge', css: { width: 1, 'line-color': '#c8f200', 'line-opacity': 0.4 } },
      { selector: 'edge[kind="tag"]', css: { 'line-color': '#ffffff', 'line-opacity': 0.12 } },
      { selector: '.dim', css: { opacity: 0.12 } },
      { selector: '.hi', css: { opacity: 1, 'line-opacity': 0.9 } },
    ],
    layout: { name: 'concentric', concentric: (n) => 3 - n.data('level'), levelWidth: () => 1, minNodeSpacing: 24, animate: !reduce },
    wheelSensitivity: 0.2,
    autoungrabify: true,
  });

  cy.on('mouseover', 'node', (e) => { cy.elements().addClass('dim'); e.target.closedNeighborhood().removeClass('dim').addClass('hi'); });
  cy.on('mouseout', 'node', () => cy.elements().removeClass('dim hi'));
  cy.on('tap', 'node', (e) => {
    const ty = e.target.data('type');
    if (ty === 'company') location.href = '/company?name=' + encodeURIComponent(e.target.data('label'));
    else if (ty === 'tag') location.href = '/explore?tag=' + encodeURIComponent(String(e.target.data('label')).replace(/^#/, ''));
  });
  cy.on('tap', (e) => { if (e.target === cy) cy.fit(undefined, 28); });
  setTimeout(() => { cy.resize(); cy.fit(undefined, 28); }, 100);
}
