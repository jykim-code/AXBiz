// 웹훅으로 나가는 회차 공유 메시지. 형식은 2026-08-24 사용자 지정이다.
//
// 왜 서버에 두는가: 메시지를 보내는 곳이 Function 이고, 관리자 화면은 보내기 전에 같은 함수의
// 결과를 미리 받아 보여 준다(dryRun). 두 곳에서 따로 만들면 「보낸 것과 본 것」이 갈라진다.
//
// 문체: 인사·안내는 존댓말 서술체로 쓴다. CLAUDE.md 의 개조식·명사형 기준은 보고서 항목
// (주요내용·시사점·한컴 인사이트)에 걸리는 것이고, 메신저 안내문은 대외 인사말이라 성격이 다르다.
// 픽 목록은 회차에 실린 제목을 그대로 옮기므로 그쪽 문체를 따른다.
//
// 아웃트로를 붙이지 않는다(사용자 지시). 자세한 것은 상세 페이지에서 읽으므로 메시지는
// 「무엇이 실렸는지」까지만 말하고 끝낸다.

const MAX_PICKS_IN_MSG = 7;   // 픽 수량 제한은 폐기됐다 — 메시지에서만 접는다
const MAX_NEW_CO = 5;
const TITLE_MAX = 32;         // 모바일 한 줄(약 26자)을 크게 넘지 않게

const oneLine = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const cut = (v, n) => (v.length > n ? v.slice(0, n - 1).trim() + '…' : v);
// '2026년 8월 3주' → '8월 3주차'
const weekLabel = (label) => {
  const s = oneLine(label).replace(/^\d{4}년\s*/, '');
  return s ? s + '차' : '';
};

export function buildWeeklyMessage(ed, origin) {
  const s = ed.stats || {};
  const p = ed.payload || {};
  const picks = Array.isArray(p.picks) ? p.picks : [];
  const label = weekLabel(ed.label);
  const newCo = (s.newCompanies || []).map(oneLine).filter(Boolean);

  const lines = [];
  lines.push('📡 [' + label + ' Weekly Picks]');
  lines.push('');
  lines.push('안녕하세요, AX Biz Radar입니다.');
  lines.push(label + '의 AX 동향 중 주요 이슈를 공유드립니다.');
  lines.push('');

  // 수치 한 줄. 데이터가 없는 항목은 문장에서 빼 「0곳」 같은 빈 말이 남지 않게 한다.
  const nums = [];
  if (s.total) nums.push('금주 동향 ' + s.total + '건');
  if (s.companies) nums.push('등장 기업 ' + s.companies + '곳');
  lines.push('📌 ' + (nums.length ? nums.join(', ') : '금주 동향 집계 중'));

  if (picks.length) lines.push('그중 ' + picks.length + '건을 주목 동향으로 선정했습니다.');
  /* 수를 앞으로 빼고 콜론으로 목록을 붙인다.
     문장형(「~은 A, B, C 3곳입니다」)으로 두면 목록을 접을 때 「A, B 외 3곳 8곳입니다」처럼
     수가 두 번 나와 읽히지 않는다. 접든 안 접든 같은 모양이 되는 쪽을 택했다. */
  if (newCo.length) {
    const rest = newCo.length - MAX_NEW_CO;
    lines.push('신규 진입 기업 ' + newCo.length + '곳: ' +
      newCo.slice(0, MAX_NEW_CO).join(', ') + (rest > 0 ? ' 외 ' + rest + '곳' : ''));
  }

  if (picks.length) {
    lines.push('');
    picks.slice(0, MAX_PICKS_IN_MSG).forEach((x) => {
      const title = cut(oneLine(x.title), TITLE_MAX);
      lines.push('• ' + oneLine(x.company) + (title ? '  ' + title : ''));
    });
    const rest = picks.length - MAX_PICKS_IN_MSG;
    if (rest > 0) lines.push('• 외 ' + rest + '건');
  }

  lines.push('');
  lines.push(String(origin || '').replace(/\/$/, '') + '/weekly?w=' + encodeURIComponent(ed.week || ''));

  return lines.join('\n');
}
