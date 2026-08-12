// 데이터 문체 기준 정규화 — CLAUDE.md 「데이터 문체 기준」 중 기계적으로 판정되는 항목만 처리한다.
// 저장 경로가 둘(발행 _publish.js · 자동화 진입점 api/reports.js)이라 규칙을 한 곳에 둔다.

// 온점 금지: 명사형으로 끝나는 항목에 붙은 끝 온점을 제거한다("상품화." → "상품화").
// 서술형(…다.)은 문장을 명사형으로 다시 쓰는 작업이라 자동으로 건드리지 않고 그대로 둔다.
// 끝 온점만 보므로 문장 중간의 버전 표기("Apache 2.0")는 영향받지 않는다.
export function stripTrailingPeriod(s) {
  const t = String(s == null ? '' : s);
  return /다\.$/.test(t) ? t : t.replace(/\.+$/, '');
}
