/* 온톨로지: 전체 보고서 → 타입드 그래프 데이터 + 통계 (홈 그래프·탐색·기업 공용)
   기업별 최신값(latestDate/latest 요약)도 함께 집계 — 카드 그리드의 "최신" 표기용. */
function buildOntology(reports) {
  const compMap = {};
  const tagMap = {}; // tag -> Set(companyName)
  let total = 0;
  (reports || []).forEach((r) => {
    const date = r.date || '';
    (r.companies || []).forEach((c) => {
      if (!c || !c.name) return;
      total++;
      let e = compMap[c.name];
      if (!e) e = compMap[c.name] = { name: c.name, category: c.category || '', count: 0, tags: new Set(), latestDate: '', latest: '' };
      e.count++;
      (c.tags || []).forEach((t) => {
        e.tags.add(t);
        (tagMap[t] = tagMap[t] || new Set()).add(c.name);
      });
      // 최신 항목 기준으로 카테고리·요약(주요내용 첫 줄) 갱신
      if (date >= e.latestDate) {
        e.latestDate = date;
        e.category = c.category || e.category;
        e.latest = (c.keyPoints || [])[0] || e.latest;
      }
    });
  });
  const companies = Object.values(compMap);
  const tags = Object.keys(tagMap);
  return {
    companies,
    tags,
    tagMap,
    stats: { total: total, companies: companies.length, dates: (reports || []).length, tags: tags.length },
  };
}
