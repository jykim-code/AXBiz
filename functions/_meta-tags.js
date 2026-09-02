// functions/_meta-tags.js — 주제가 아니라 「상태」를 표시하는 메타 태그의 단일 처리 지점.
//
// 「신규편입」·「AX신규진입」은 그 기업의 상태 표시이고 동향의 주제가 아니다. 그런데 지침이
// `#태그` 로 적게 되어 있어 태그 배열에 그대로 저장됐고, 그 결과 카드 하단 태그 칩·지식그래프
// 노드·주간 키워드 순위에 주제 태그와 섞여 들어갔다(실측: 라이브 355건 중 19건).
// weekly.js 는 이것을 걸러내는 우회 코드를 따로 갖고 있었다.
// 2026-09-03 사용자 지시로 태그 저장을 폐기하고 아래로 정리한다.
//
//   신규편입   → 저장하지 않는다. 그 기업의 첫 등장 여부는 데이터로 계산되므로 화면이
//                「신규」 배지로 그린다. 사람이 붙이면 빠뜨리거나 잘못 붙는다
//                (실측: 19건 중 3건이 그 기업의 첫 등장이 아니었다).
//   AX신규진입 → `axEntry: true` 필드로 옮긴다. 「그 기업이 AX 시장에 처음 진입했다」는
//                작성자 판단이라 우리 데이터로는 계산할 수 없다. 화면은 「AX 진입」 배지.
//
// 회차 페이지 작성 양식은 그대로 두고(작성자는 계속 `#AX신규진입` 을 적는다) 적재 단계에서
// 이 함수가 필드로 옮긴다. 그래서 지침을 바꾸지 않아도 태그 칩으로는 새지 않는다.

export const META_TAGS = new Set(['신규편입', 'AX신규진입']);

// 이 중 하나라도 있으면 axEntry 로 승격한다.
const AX_ENTRY_TAGS = new Set(['AX신규진입']);

/* 태그 배열에서 메타 태그를 걷어내고 axEntry 여부를 함께 돌려준다.
   - 입력 배열은 변경하지 않는다(호출부가 원본을 다시 쓰는 경우가 있다).
   - 선행 `#` 과 앞뒤 공백을 흡수해 비교한다(회차 페이지에서 `#AX신규진입` 형태로 온다).
   - prevAxEntry 는 이미 필드로 저장돼 있던 값 — 태그가 없어도 유지된다(수정 시 소실 방지). */
export function splitMetaTags(tags, prevAxEntry) {
  const kept = [];
  let axEntry = prevAxEntry === true;
  for (const raw of Array.isArray(tags) ? tags : []) {
    const t = String(raw == null ? '' : raw).trim().replace(/^#/, '');
    if (!t) continue;
    if (META_TAGS.has(t)) {
      if (AX_ENTRY_TAGS.has(t)) axEntry = true;
      continue;
    }
    kept.push(raw);
  }
  return { tags: kept, axEntry };
}
