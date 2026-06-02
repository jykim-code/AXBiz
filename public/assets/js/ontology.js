/* 온톨로지: 전체 보고서 → 타입드 그래프 데이터 + 통계 (홈 그래프·탐색·기업 공용) */
function buildOntology(reports) {
  const all = (reports || []).flatMap((r) => r.companies || []);
  const compMap = {};
  const tagMap = {}; // tag -> Set(companyName)
  all.forEach((c) => {
    if (!c || !c.name) return;
    if (!compMap[c.name]) compMap[c.name] = { name: c.name, category: c.category || '', count: 0, tags: new Set() };
    compMap[c.name].count++;
    (c.tags || []).forEach((t) => {
      compMap[c.name].tags.add(t);
      (tagMap[t] = tagMap[t] || new Set()).add(c.name);
    });
  });
  const companies = Object.values(compMap);
  const tags = Object.keys(tagMap);
  return {
    companies,
    tags,
    tagMap,
    stats: { total: all.length, companies: companies.length, dates: (reports || []).length, tags: tags.length },
  };
}
