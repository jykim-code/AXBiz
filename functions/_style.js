// 데이터 문체 기준 정규화 — CLAUDE.md 「데이터 문체 기준」 중 기계적으로 판정되는 항목만 처리한다.
// 저장 경로가 둘(발행 _publish.js · 자동화 진입점 api/reports.js)이라 규칙을 한 곳에 둔다.

// 온점 금지: 명사형으로 끝나는 항목에 붙은 끝 온점을 제거한다("상품화." → "상품화").
// 서술형(…다.)은 문장을 명사형으로 다시 쓰는 작업이라 자동으로 건드리지 않고 그대로 둔다.
// 끝 온점만 보므로 문장 중간의 버전 표기("Apache 2.0")는 영향받지 않는다.
export function stripTrailingPeriod(s) {
  const t = String(s == null ? '' : s);
  return /다\.$/.test(t) ? t : t.replace(/\.+$/, '');
}

// em dash 금지: 연결에 쓰인 em dash 를 쉼표로 바꾼다("전략 수립—차량 데이터로" → "전략 수립, 차량 데이터로").
// 생성 요약(_summary.js)이 프롬프트의 금지 지시를 무시하고 넣는 경우가 있어 기계적으로 정규화한다.
// en dash(–)는 연도 범위("2025–2026")에 쓰일 수 있어 건드리지 않는다.
export function replaceEmDash(s) {
  return String(s == null ? '' : s)
    .replace(/\s*—\s*/g, ', ')
    .replace(/,\s*(?=,)/g, '') // "A, , B" 처럼 쉼표가 겹친 경우 정리
    .replace(/^[\s,]+/, '')
    .replace(/[\s,]+$/, '');
}
