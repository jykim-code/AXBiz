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

// 태그 표기 정규화(띄어쓰기·기호 차이 흡수) — 기업명과 태그를 같은 것으로 볼 때 쓴다.
function tagNormKey(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[\s·・\-_,.，、/()]/g, '');
}

/* 그래프 태그 노드의 자격 임계값(= 최소 공유 기업 수). 기본 3.
   화면에서 강도를 비교해보려면 ?tagmin=2 처럼 URL 로 덮어쓸 수 있다. */
function tagMinCompanies(fallback) {
  const base = Number(fallback) > 0 ? Number(fallback) : 3;
  try {
    const v = Number(new URLSearchParams(location.search).get('tagmin'));
    return v >= 1 && v <= 9 ? v : base;
  } catch { return base; }
}

/* 큐레이션 태그 목록 (지식그래프·탐색 공용)
   한 기업만 쓰는 태그는 관계가 아니라 라벨이라, 관계망에 넣으면 노드·링크만 늘고 아무것도 연결하지 않는다.
   그래서 자격을 "여러 기업이 공유하는가" 하나로 좁혔다.
     선정 = 핀(관리자 지정) ∪ 공유 태그(minCompanies 개 기업 이상)
     제외 = 기업명과 같은 태그 — 그래프에 기업 노드가 이미 있어 같은 대상이 두 번 그려진다.
     보완 = 태그 연결이 0인 기업에만 그 기업 태그 중 가장 폭 넓은 1개(고립 방지).
            기업마다 상위 K개를 넣던 이전 방식은 1회성 태그를 그래프로 끌어올리는 주된 원인이었다.
   정렬(중요도순) = 연결 기업 수 desc → 총 등장 횟수 desc → 가나다 */
function selectCuratedTags(reports, ont, pinned, minCompanies) {
  const MIN = tagMinCompanies(minCompanies);
  const totals = {}; // tag -> 총 등장 횟수
  (reports || []).forEach((r) => (r.companies || []).forEach((c) => {
    if (!c || !c.name) return;
    (c.tags || []).forEach((t) => { totals[t] = (totals[t] || 0) + 1; });
  }));

  const companyKeys = new Set(ont.companies.map((c) => tagNormKey(c.name)));
  const isCompanyName = (t) => companyKeys.has(tagNormKey(t));
  const rank = (a, b) => ont.tagMap[b].size - ont.tagMap[a].size
    || (totals[b] || 0) - (totals[a] || 0) || a.localeCompare(b);

  const set = new Set();
  (Array.isArray(pinned) ? pinned : []).forEach((t) => { if (ont.tagMap[t]) set.add(t); }); // 데이터에 존재하는 핀만
  ont.tags.forEach((t) => { if (!isCompanyName(t) && ont.tagMap[t].size >= MIN) set.add(t); });

  ont.companies.forEach((c) => {
    const own = [...c.tags].filter((t) => !isCompanyName(t) && ont.tagMap[t]);
    if (own.some((t) => set.has(t))) return; // 이미 연결됨
    const best = own.sort(rank)[0];
    if (best) set.add(best);
  });

  return [...set].sort(rank);
}
