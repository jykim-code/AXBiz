// 웹훅으로 나가는 회차 공유 메시지. 형식은 2026-08-24 사용자 지정이다.
//
// 왜 서버에 두는가: 메시지를 보내는 곳이 Function 이고, 관리자 화면은 보내기 전에 같은 함수의
// 결과를 미리 받아 보여 준다(dryRun). 두 곳에서 따로 만들면 「보낸 것과 본 것」이 갈라진다.
//
// **서식은 마크다운이 아니다.** Google Chat 은 자체 문법을 쓴다 — 굵게는 `*한 개*`,
// 기울임 `_한 개_`, 취소선 `~한 개~`, 고정폭 백틱. 마크다운 `**두 개**` 를 보내면 별표가
// 그대로 보인다. 그래서 이 파일은 별표 한 개로 쓴다. Slack 도 같은 문법이고,
// 카카오워크·Teams 로 보낼 경우 서식만 무시되고 글은 그대로 읽힌다.
//
// URL 을 대괄호로 감싸지 않는다. Google Chat 은 맨 URL 을 자동으로 링크로 만드는데
// 뒤에 `]` 가 붙으면 그 문자까지 주소로 먹어 링크가 깨진다.
//
// 문체: 인사·안내는 존댓말 서술체다. CLAUDE.md 의 개조식·명사형 기준은 보고서 항목
// (주요내용·시사점·한컴 인사이트)에 걸리는 것이고, 메신저 안내문은 대외 인사말이라 성격이 다르다.
// 픽 목록은 회차에 실린 제목을 그대로 옮기므로 그쪽 문체를 따른다.

/* 글머리기호는 문자 그대로 넣는다(2026-08-24 사용자 지시로 두 절 모두 붙인다).
   `- ` 나 `* ` 를 줄 앞에 두면 안 된다 — Google Chat 은 목록으로 바꿔 주지 않고,
   특히 `*` 는 굵게 시작으로 읽혀 뒤 문장이 통째로 굵어진다. */
const BULLET = '• ';

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
  const url = String(origin || '').replace(/\/$/, '') + '/weekly?w=' + encodeURIComponent(ed.week || '');

  const lines = [];

  lines.push('🎯 *[' + label + ' Weekly Picks]*');
  lines.push('');
  lines.push('안녕하세요. AX Biz Radar입니다.');
  lines.push('지난주 AX 동향 중 주요 이슈를 Pick하여 Weekly Picks 리포트로 공유드립니다 :)');
  lines.push('');

  lines.push('📌 *금주 요약*');
  // 수치는 슬래시로 한 줄에 묶는다. 없는 항목은 빼 「0곳」 같은 빈 말이 남지 않게 한다.
  const nums = [];
  if (s.total) nums.push('수집 동향 ' + s.total + '건');
  if (s.companies) nums.push('대상 기업 ' + s.companies + '곳');
  if (picks.length) nums.push('그중 주요 동향 ' + picks.length + '건');
  if (nums.length) lines.push(BULLET + nums.join(' / '));
  /* 신규 진입 기업은 수를 앞으로 뺀다. 문장형으로 두면 목록을 접을 때 「A, B 외 3곳 8곳」처럼
     수가 두 번 나와 읽히지 않는다. 접든 안 접든 같은 모양이 되는 쪽을 택했다. */
  if (newCo.length) {
    const rest = newCo.length - MAX_NEW_CO;
    lines.push(BULLET + '신규 진입 기업 ' + newCo.length + '곳 : ' +
      newCo.slice(0, MAX_NEW_CO).join(', ') + (rest > 0 ? ' 외 ' + rest + '곳' : ''));
  }

  if (picks.length) {
    lines.push('');
    lines.push('🔍 *주요 동향*');
    picks.slice(0, MAX_PICKS_IN_MSG).forEach((x) => {
      const title = cut(oneLine(x.title), TITLE_MAX);
      // 기업명을 굵게 — 목록에서 눈이 먼저 걸리는 곳이고, 「내가 아는 회사가 있나」로 클릭이 결정된다.
      lines.push(BULLET + '*' + oneLine(x.company) + '*' + (title ? ' : ' + title : ''));
    });
    const rest = picks.length - MAX_PICKS_IN_MSG;
    if (rest > 0) lines.push(BULLET + '외 ' + rest + '건');
  }

  /* 링크는 맺음말 바로 앞에 한 번만 둔다(2026-08-24 사용자 지시).
     `<주소|라벨>` 은 Google Chat 문법으로, 주소를 감추고 라벨만 눌리게 한다.
     주소를 맨 텍스트로 두면 회차 주소가 길어 줄을 먹고, 대괄호로 감싸면 자동 링크가
     닫는 괄호까지 주소로 먹어 깨진다 — 그래서 이 형태를 쓴다.
     맺음말이 「상단 링크」가 아니라 「위 링크」인 이유: 링크가 바로 위 줄에 있다. */
  lines.push('');
  lines.push('👉 <' + url + '|' + label + ' Weekly Pick 링크>');
  lines.push('자세한 내용은 위 링크를 참고해 주세요. 감사합니다 🙌');

  return lines.join('\n');
}
