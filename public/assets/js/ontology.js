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

/* 큐레이션 태그 목록 (지식그래프·탐색 공용)
   선정 = 핀(관리자 지정) ∪ 공유 태그(2개 기업 이상) ∪ 기업별 대표 상위 K(항목 내 등장 횟수)
   정렬(중요도순) = 연결 기업 수 desc → 총 등장 횟수 desc → 가나다 */
function selectCuratedTags(reports, ont, pinned, topPerCompany) {
  const K = topPerCompany || 3;
  const perCo = {}; // name -> {tag: count}
  const totals = {}; // tag -> 총 등장 횟수
  (reports || []).forEach((r) => (r.companies || []).forEach((c) => {
    if (!c || !c.name) return;
    const m = (perCo[c.name] = perCo[c.name] || {});
    (c.tags || []).forEach((t) => { m[t] = (m[t] || 0) + 1; totals[t] = (totals[t] || 0) + 1; });
  }));
  const set = new Set();
  (Array.isArray(pinned) ? pinned : []).forEach((t) => { if (ont.tagMap[t]) set.add(t); }); // 데이터에 존재하는 핀만
  ont.tags.forEach((t) => { if (ont.tagMap[t].size >= 2) set.add(t); });
  Object.values(perCo).forEach((m) => {
    Object.keys(m).sort((a, b) => m[b] - m[a] || a.localeCompare(b)).slice(0, K).forEach((t) => set.add(t));
  });
  return [...set].sort((a, b) =>
    ont.tagMap[b].size - ont.tagMap[a].size || (totals[b] || 0) - (totals[a] || 0) || a.localeCompare(b));
}
