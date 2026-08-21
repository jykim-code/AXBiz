// /api/weekly — 위클리 픽 발행물 (단톡방 주 1회 공유용)
//   GET  ?w=2026-W34        (공개) 그 주차 발행본. w·n·date 가 없으면 최신 발행 회차
//   GET  ?n=12              (공개) 회차 번호로 조회
//   GET  ?date=2026-08-19   (공개) 그 날짜가 속한 주차로 정규화
//   GET  ?w=…&draft=1       (PIN)  초안 + 그 주 후보 목록(체크리스트용)
//   POST {action}           (PIN)  save | assist | publish | unpublish
//
// 설계 원칙 (.omc/plans/weekly-insight-share-plan.md 3절)
//  - 공개 GET 은 weekly_edition 한 행만 읽고 LLM 을 호출하지 않는다. 단톡방 공유 직후 동시 클릭이
//    몰리는데 조회 경로에 생성을 두면 캐시 미스마다 LLM 이 동시에 여러 번 불린다.
//  - 발행본은 스냅샷이다. publish 시점의 항목 내용을 payload 에 복사해 고정하므로 원본(reports)이
//    나중에 바뀌어도 이미 공유한 링크의 내용은 변하지 않는다. 재발행할 때만 갱신된다.
//  - 선별은 사람이 한다. LLM 은 고른 것을 엮는 문장만 쓰고(assist), 무엇을 고를지는 정하지 않는다.
//  - 수치는 항상 코드 집계다. LLM 이 실패해도 수치와 주목 동향은 나온다.
import { pinOk, forbidden } from '../_auth.js';
import { entryKey } from '../_publish.js';
import { stripTrailingPeriod, replaceEmDash, replaceAxisWord, hasAxisWord } from '../_style.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_PICKS = 5;
const WEEK_RE = /^(\d{4})-W(\d{1,2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

/* ===== ISO 주차 계산 =====
   주는 월~일이며 대시보드 periodRange 와 같은 규칙이다(두 화면의 기간이 어긋나지 않게).
   연·주차 표기는 ISO 8601(1주차 = 첫 목요일이 있는 주)을 따른다. */
const pad2 = (n) => String(n).padStart(2, '0');
const utc = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
const fmt = (d) => d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
const shift = (d, days) => new Date(d.getTime() + days * DAY_MS);

// 그 해 1주차의 월요일 (1월 4일이 반드시 1주차에 속한다는 ISO 규칙 이용)
function week1Monday(year) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return shift(jan4, -((jan4.getUTCDay() + 6) % 7));
}
function isoWeekOf(dateStr) {
  const d = utc(dateStr);
  const monday = shift(d, -((d.getUTCDay() + 6) % 7));
  // 주차를 정하는 해는 그 주 목요일이 속한 해다(연말·연초 주가 갈리는 경우 처리).
  const year = shift(monday, 3).getUTCFullYear();
  const week = Math.round((monday - week1Monday(year)) / WEEK_MS) + 1;
  return year + '-W' + pad2(week);
}
function rangeOfWeek(w) {
  const m = WEEK_RE.exec(String(w || ''));
  if (!m) return null;
  const year = +m[1], week = +m[2];
  if (week < 1 || week > 53) return null;
  const start = shift(week1Monday(year), (week - 1) * 7);
  // 53주차가 없는 해에 ?w=2026-W53 이 오면 다음 해로 넘어가 버린다 — 왕복 검증으로 거른다.
  if (isoWeekOf(fmt(start)) !== year + '-W' + pad2(week)) return null;
  return [fmt(start), fmt(shift(start, 6))];
}
// '2026년 8월 3주' — 그 주 목요일이 속한 달을 기준으로 몇 번째 주인지 센다.
// 월요일 기준으로 세면 월말 주가 다음 달로 넘어가 읽는 사람 감각과 어긋난다.
function weekLabel(w) {
  const r = rangeOfWeek(w);
  if (!r) return '';
  const thu = shift(utc(r[0]), 3);
  return thu.getUTCFullYear() + '년 ' + (thu.getUTCMonth() + 1) + '월 ' + Math.ceil(thu.getUTCDate() / 7) + '주';
}

/* ===== 공용 ===== */
const arr = (v, max, len) =>
  (Array.isArray(v) ? v : []).slice(0, max).map((x) => stripTrailingPeriod(replaceEmDash(String(x == null ? '' : x).trim())).slice(0, len)).filter(Boolean);
const str = (v, len) => stripTrailingPeriod(replaceEmDash(String(v == null ? '' : v).trim())).slice(0, len);
const parseJson = (s, fb) => { try { const v = JSON.parse(s || ''); return v == null ? fb : v; } catch { return fb; } };

// reports 항목 → 주간 페이지가 쓰는 형태. 펼침 렌더가 이 값만 쓰므로 공개 조회가 reports 를 읽지 않는다.
function toItem(date, c) {
  return {
    key: date + '|' + entryKey(c),
    company: String(c.name || ''),
    category: String(c.category || ''),
    date,
    // summary(관리자 한 줄 요약)가 비어 있는 항목이 많아 주요내용 첫 줄로 대체한다
    // (대시보드 카드도 같은 폴백을 쓴다 — 제목이 빈 채로 목록에 뜨면 무엇을 고르는지 알 수 없다).
    title: str(c.summary || (Array.isArray(c.keyPoints) ? c.keyPoints[0] : ''), 300),
    keyPoints: arr(c.keyPoints, 20, 2000),
    implications: arr(c.implications, 20, 2000),
    hancomInsight: arr(c.hancomInsight, 20, 2000),
    tags: arr(c.tags, 20, 100),
    sourceUrl: String(c.sourceUrl || '').slice(0, 1000),
    confluenceUrl: String(c.confluenceUrl || '').slice(0, 1000),
  };
}

/* ===== 수치 집계 (코드) =====
   그 주 전체 기준으로 센다 — 「20건 중 3건을 골랐다」가 드러나야 선별이 신뢰받는다.
   신규(태그·기업) 판정은 기간 시작 이전 전체 이력이 필요하므로 관리자 경로에서만 계산하고,
   결과는 발행 시 stats 로 고정된다(공개 조회는 이 계산을 하지 않는다). */
async function collect(env, start, end) {
  const rows = (await env.DB.prepare('SELECT date, companies FROM reports WHERE date <= ? ORDER BY date ASC').bind(end).all()).results || [];

  const items = [];
  const seenCompany = new Set(), seenTag = new Set(); // 기간 시작 이전 이력
  const countByDate = {};
  for (const r of rows) {
    const list = parseJson(r.companies, []);
    if (!Array.isArray(list)) continue;
    countByDate[r.date] = (countByDate[r.date] || 0) + list.length;
    if (r.date >= start && r.date <= end) {
      for (const c of list) if (c && c.name) items.push(toItem(r.date, c));
      continue;
    }
    for (const c of list) {
      if (!c || !c.name) continue;
      seenCompany.add(c.name);
      for (const t of (c.tags || [])) seenTag.add(t);
    }
  }

  // 최근 4주 건수 추이(오래된 주부터). 대시보드에 추이가 없어 주간 발행물의 차별 지점이 된다.
  const rangeTotal = (s, e) => Object.keys(countByDate).reduce((n, d) => (d >= s && d <= e ? n + countByDate[d] : n), 0);
  const trend = [];
  for (let k = 3; k >= 0; k--) {
    const ws = fmt(shift(utc(start), -7 * k));
    trend.push({ start: ws, total: rangeTotal(ws, fmt(shift(utc(ws), 6))) });
  }
  const prevTotal = trend.length > 1 ? trend[trend.length - 2].total : 0;

  // key 중복 제거. key 는 화면의 선택 상태·저장된 픽을 잇는 신원이라 겹치면 다른 항목이 선택된다.
  // 같은 날 같은 기업의 두 동향이 출처 URL 을 공유하거나 본문이 같으면 entryKey 가 같아진다
  // (실측: 라이브 한 주에 3건). 순서는 날짜 오름차순 + 배열 순서라 같은 데이터에서 같은 key 가 나온다.
  const seenKey = new Set();
  for (const it of items) {
    let k = it.key;
    for (let n = 1; seenKey.has(k); n++) k = it.key + '#' + n;
    seenKey.add(k);
    it.key = k;
  }

  const countByCompany = {}, tagFreq = {};
  const days = new Set();
  for (const it of items) {
    countByCompany[it.company] = (countByCompany[it.company] || 0) + 1;
    days.add(it.date);
    for (const t of it.tags) tagFreq[t] = (tagFreq[t] || 0) + 1;
  }
  const newTags = [...new Set(items.flatMap((i) => i.tags))].filter((t) => !seenTag.has(t));
  const newCompanies = [...new Set(items.map((i) => i.company))].filter((n) => !seenCompany.has(n));
  const topTags = Object.keys(tagFreq)
    .sort((a, b) => tagFreq[b] - tagFreq[a] || a.localeCompare(b))
    .slice(0, 6)
    .map((t) => ({ tag: t, count: tagFreq[t], isNew: newTags.includes(t) }));

  const stats = {
    total: items.length,
    companies: Object.keys(countByCompany).length,
    prevTotal,
    delta: items.length - prevTotal, // 화면에는 쓰지 않는다(신규 기업 수로 교체됨)
    daysWithData: days.size,
    trend,
    topTags,
    newTags,
    newCompanies,
    picks: 0, // 발행 시 채움
  };

  // 후보 점수 — 선별용이 아니라 정렬용이다(선별은 사람이 한다). 무엇이 눈에 띄는지 위로 올린다.
  // 「신규 등장 태그 포함」은 신호로 쓰지 않는다: 태그가 항목마다 매우 구체적이라 거의 모든
  // 항목에 신규 태그가 하나씩 붙고(실측: 한 주 17건에 신규 태그 60여 종) 점수가 평평해진다.
  const top3 = new Set(topTags.slice(0, 3).map((t) => t.tag));
  const newCoSet = new Set(newCompanies);
  for (const it of items) {
    let s = 0;
    if (countByCompany[it.company] > 1) s += 2;
    if (newCoSet.has(it.company)) s += 2;
    if (it.hancomInsight.length >= 2) s += 1;
    if (it.tags.some((t) => top3.has(t))) s += 1;
    it.score = s;
  }
  items.sort((a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || '') || a.company.localeCompare(b.company));
  return { items, stats };
}

/* ===== LLM (엮는 문장만) ===== */
const STYLE = `문체 규칙(보고서 항목과 동일)
- 개조식으로 쓰고 체언(명사)으로 끝낸다. 예: ~확대, ~전환, ~구조, ~전망, ~필요
- 서술형(~이다 / ~한다 / ~했다 / ~된다 / ~있다)으로 끝내지 않는다
- 온점(.)을 쓰지 않고 쉼표로 이어 한 덩어리로 만든다. 제품명·버전 표기 안의 온점은 원문대로 둔다
- em dash(—)·물음표·느낌표를 쓰지 않는다. 쉼표와 콜론(:)은 허용
- 구어·가벼운 표현을 쓰지 않고 공문 수준의 문어체를 쓴다
- 「축」(대응 축·경쟁 축) 표현을 쓰지 않고 경쟁 지점·비교 기준·차별화 요소로 구체화한다`;

const PROMPTS = {
  why: `당신은 "AX Biz Radar" 위클리 픽의 편집자입니다.
주어진 동향 한 건이 왜 주목할 만한지 한 줄로 쓰세요. 한컴 Agentic OS(AI 오케스트레이션 AX 플랫폼) 관점에서
경쟁 지점·시장 변화의 의미를 짚습니다.

- 60~140자 한 문장
- 동향의 사실을 반복하지 않고 "그래서 왜 중요한가"만 쓴다
- 주어진 내용만 근거로 하고 추측하지 않는다

${STYLE}

문장만 출력하고 다른 텍스트를 붙이지 않는다.`,

  overview: `당신은 "AX Biz Radar" 위클리 픽의 편집자입니다.
이번 주 주목 동향들을 묶어 한 주의 흐름을 1~2문장으로 쓰세요.

- 개별 기업 나열이 아니라 공통 흐름·방향이 드러나게 쓴다
- 100~200자
- 주어진 내용만 근거로 하고 추측하지 않는다

${STYLE}

문장만 출력하고 다른 텍스트를 붙이지 않는다.`,

  bridge: `당신은 "AX Biz Radar" 위클리 픽의 편집자입니다.
지난 회차와 금주를 잇는 한 줄을 쓰세요. 회차가 이어지는 발행물이라는 것이 드러나야 합니다.

- 「지난 회차는 A, 금주는 B」 구조로 흐름의 변화 또는 이어짐을 드러낸다
- 80~140자 한 문장
- 지난 회차 정리와 금주 주목 동향만 근거로 하고 추측하지 않는다
- 지난 회차와 금주가 같은 흐름이면 이어짐을, 달라졌으면 무엇이 바뀌었는지를 쓴다

${STYLE}

문장만 출력하고 다른 텍스트를 붙이지 않는다.`,

  conclusion: `당신은 "AX Biz Radar" 위클리 픽의 편집자입니다.
이번 주 동향에서 한컴 Agentic OS 관점의 결론을 뽑으세요.

한컴 Agentic OS 는 기업의 모든 시스템과 데이터를 연결하고 여러 AI 에이전트의 협업으로 실제 업무 수행을
지원하는 기업용 AI 운영 체제입니다. 비교 기준은 에이전트 협업 조율 / 권한·거버넌스 / 모델 중립 /
배포·주권(클라우드·온프레미스·폐쇄망) / 레거시 연동을 우선합니다.

- 2~3개 불릿, 각 60~140자
- 개별 항목의 한컴 인사이트를 교차 종합하되 새로 지어내지 않는다
- 출력 형식: 불릿 하나를 한 줄로, 앞에 기호를 붙이지 않는다

${STYLE}`,
};

// LLM 출력에만 「축」 치환을 걸어 관리자가 화면에서 고쳐진 문장을 보고 저장하게 한다.
// reports 에서 승계한 본문에는 걸지 않는다 — 같은 항목이 대시보드와 주간 페이지에서 달라 보이면 안 된다.
const llmStr = (v, len) => replaceAxisWord(str(v, len));

// 금지 표현(「축」)이 남았으면 한 번 더 받아 본다. 마지막 시도 결과는 그대로 채택하고
// 호출부가 관리자에게 알린다 — 무엇으로 바꿀지는 문맥마다 달라 기계가 정할 수 없고,
// 이 화면에는 이유를 직접 쓰는 사람이 이미 붙어 있다.
async function llmClean(env, system, user, maxTokens) {
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llm(env, system, user, maxTokens);
    if (!raw) continue;
    last = replaceAxisWord(raw);
    if (!hasAxisWord(last)) return { text: last, warn: null };
    console.error('/api/weekly axis word remains', 'attempt=' + attempt, last.slice(0, 80));
  }
  return { text: last, warn: last ? 'AXIS_WORD' : null };
}

async function llm(env, system, user, maxTokens) {
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) return null;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ax-biz-radar.pages.dev',
        'X-Title': 'AX Biz Radar',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        temperature: 0.3,
        max_tokens: maxTokens,
        reasoning: { enabled: false }, // 추론모델 토큰 낭비·빈 출력 방지
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      console.error('/api/weekly llm', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || '').trim() || null;
  } catch (err) {
    console.error('/api/weekly llm fetch', err);
    return null;
  }
}

const itemContext = (it) =>
  `기업: ${it.company} (${it.category})\n날짜: ${it.date}\n요약: ${it.title || '-'}\n` +
  `주요내용: ${it.keyPoints.join(' / ') || '-'}\n시사점: ${it.implications.join(' / ') || '-'}\n` +
  `한컴인사이트: ${it.hancomInsight.join(' / ') || '-'}\n태그: ${it.tags.join(', ') || '-'}`;

// 직전 발행 회차 — 「지난 회차와 이어지는 한 줄」의 근거이자 화면의 회차 표기용.
async function prevEdition(env, start) {
  try {
    return await env.DB.prepare(
      `SELECT week, issue_no, json_extract(payload, '$.overview') AS overview
         FROM weekly_edition WHERE status = 'published' AND range_end < ?
        ORDER BY range_end DESC LIMIT 1`
    ).bind(start).first();
  } catch { return null; }
}

/* ===== GET ===== */
function editionResponse(row, prev) {
  return Response.json({
    available: true,
    week: row.week,
    issueNo: row.issue_no,
    start: row.range_start,
    end: row.range_end,
    label: weekLabel(row.week),
    publishedAt: row.published_at,
    stats: parseJson(row.stats, {}),
    payload: parseJson(row.payload, {}),
    prev: prev || [],
  });
}

// 발행 회차 목록(푸터 아카이브). payload 전체를 읽지 않고 필요한 값만 뽑아 가볍게 유지한다.
async function publishedList(env, limit) {
  const rows = (await env.DB.prepare(
    `SELECT week, issue_no, range_start, range_end,
            json_extract(payload, '$.overview') AS overview,
            json_extract(stats, '$.total') AS total
       FROM weekly_edition WHERE status = 'published'
      ORDER BY range_end DESC LIMIT ?`
  ).bind(limit).all()).results || [];
  return rows.map((r) => ({
    week: r.week, issueNo: r.issue_no, start: r.range_start, end: r.range_end,
    label: weekLabel(r.week), overview: r.overview || '', total: r.total || 0,
  }));
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const draft = u.searchParams.get('draft') === '1';
  let week = String(u.searchParams.get('w') || '').trim();
  const dateParam = String(u.searchParams.get('date') || '').trim();
  const issueParam = String(u.searchParams.get('n') || '').trim();

  if (!week && DATE_RE.test(dateParam)) week = isoWeekOf(dateParam);
  if (week && !rangeOfWeek(week)) return Response.json({ error: 'INVALID_WEEK' }, { status: 400 });

  try {
    /* --- 관리자: 초안 + 후보 목록 --- */
    if (draft) {
      if (!pinOk(env, request)) return forbidden();
      if (!week) return Response.json({ error: 'WEEK_REQUIRED' }, { status: 400 });
      const [start, end] = rangeOfWeek(week);
      const { items, stats } = await collect(env, start, end);
      const row = await env.DB.prepare('SELECT * FROM weekly_edition WHERE week = ?').bind(week).first();
      const payload = row ? parseJson(row.payload, {}) : {};
      // 회차 번호: 이미 있으면 그대로, 없으면 다음 번호를 미리 보여 준다(발행 시 확정)
      let issueNo = row ? row.issue_no : null;
      if (issueNo == null) {
        const mx = await env.DB.prepare('SELECT MAX(issue_no) AS m FROM weekly_edition').first();
        issueNo = ((mx && mx.m) || 0) + 1;
      }
      const pe = await prevEdition(env, start);
      return Response.json({
        available: true, week, start, end, label: weekLabel(week),
        status: row ? row.status : 'none',
        issueNo, stats, candidates: items,
        // 「지난 회차와 이어지는 한 줄」을 쓸 근거. 첫 회차면 null 이라 화면에서 그 입력을 감춘다.
        prevEdition: pe ? { week: pe.week, issueNo: pe.issue_no, label: weekLabel(pe.week), overview: pe.overview || '' } : null,
        payload: {
          bridge: payload.bridge || '',
          overview: payload.overview || '',
          hancomConclusion: payload.hancomConclusion || [],
          picks: payload.picks || [],
        },
      });
    }

    /* --- 공개: 발행본 1건 (LLM 호출 없음, D1 읽기만) --- */
    let row = null;
    if (week) {
      row = await env.DB.prepare("SELECT * FROM weekly_edition WHERE week = ? AND status = 'published'").bind(week).first();
    } else if (/^\d+$/.test(issueParam)) {
      row = await env.DB.prepare("SELECT * FROM weekly_edition WHERE issue_no = ? AND status = 'published'").bind(+issueParam).first();
    } else {
      row = await env.DB.prepare("SELECT * FROM weekly_edition WHERE status = 'published' ORDER BY range_end DESC LIMIT 1").first();
    }
    const prev = await publishedList(env, 12);
    if (!row) {
      return Response.json({
        available: false,
        reason: week || issueParam ? 'NOT_PUBLISHED' : 'NONE',
        week: week || null,
        label: week ? weekLabel(week) : '',
        prev,
      });
    }
    return editionResponse(row, prev.filter((p) => p.week !== row.week));
  } catch (err) {
    console.error('GET /api/weekly', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

/* ===== POST (관리자) ===== */
// 회차 번호 확정. issue_no 에 부분 유니크 인덱스가 있어 남이 쓰는 번호를 그대로 넣으면 저장이 실패한다
// (관리자 화면은 다음 번호를 미리 보여 주므로 초안이 둘이면 같은 번호를 들고 올 수 있다).
// 남이 쓰는 번호면 조용히 다음 번호로 넘긴다.
async function resolveIssueNo(env, week, desired) {
  if (Number.isInteger(desired) && desired > 0) {
    const dup = await env.DB.prepare('SELECT week FROM weekly_edition WHERE issue_no = ? AND week <> ?').bind(desired, week).first();
    if (!dup) return desired;
  }
  const mx = await env.DB.prepare('SELECT MAX(issue_no) AS m FROM weekly_edition').first();
  return ((mx && mx.m) || 0) + 1;
}

// 저장·발행에 담기는 주목 동향. 관리자가 고친 제목·이유를 받고 본문은 후보에서 그대로 승계한다.
function sanitizePick(p) {
  if (!p || !p.company || !DATE_RE.test(String(p.date || ''))) return null;
  return {
    key: String(p.key || '').slice(0, 1200),
    company: String(p.company).slice(0, 200),
    category: String(p.category || '').slice(0, 40),
    date: String(p.date),
    title: str(p.title, 300),
    why: str(p.why, 300),
    keyPoints: arr(p.keyPoints, 20, 2000),
    implications: arr(p.implications, 20, 2000),
    hancomInsight: arr(p.hancomInsight, 20, 2000),
    tags: arr(p.tags, 20, 100),
    sourceUrl: String(p.sourceUrl || '').slice(0, 1000),
    confluenceUrl: String(p.confluenceUrl || '').slice(0, 1000),
  };
}

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const action = String(body?.action || '');
  const week = String(body?.week || '').trim();
  const range = rangeOfWeek(week);
  if (!range) return Response.json({ error: 'INVALID_WEEK' }, { status: 400 });
  const [start, end] = range;

  try {
    /* --- LLM 초안: 비어 있는 칸만 채운다. 저장하지 않고 반환하며 사람이 확인 후 저장한다 --- */
    if (action === 'assist') {
      const kind = String(body?.kind || '');
      if (!PROMPTS[kind]) return Response.json({ error: 'INVALID_KIND' }, { status: 400 });
      const picks = (Array.isArray(body?.picks) ? body.picks : []).slice(0, MAX_PICKS).map(sanitizePick).filter(Boolean);

      if (kind === 'why') {
        const it = sanitizePick(body?.item);
        if (!it) return Response.json({ error: 'ITEM_REQUIRED' }, { status: 400 });
        const r = await llmClean(env, PROMPTS.why, itemContext(it), 400);
        return Response.json({ text: r.text ? llmStr(r.text, 300) : null, warn: r.warn });
      }
      if (!picks.length) return Response.json({ error: 'PICKS_REQUIRED' }, { status: 400 });

      if (kind === 'bridge') {
        const pe = await prevEdition(env, start);
        // 첫 회차거나 지난 회차에 정리가 없으면 이을 것이 없다 — 없는 연결을 지어내지 않는다.
        if (!pe || !pe.overview) return Response.json({ text: null, reason: 'NO_PREV_EDITION' });
        const ctx = `지난 회차(${pe.issue_no}호 ${weekLabel(pe.week)}) 정리: ${pe.overview}\n\n` +
          `금주 주목 동향\n` + picks.map((p, i) => `${i + 1}) ${p.company}: ${p.title}${p.why ? ' / 주목 이유: ' + p.why : ''}`).join('\n');
        const r = await llmClean(env, PROMPTS.bridge, ctx, 500);
        return Response.json({ text: r.text ? llmStr(r.text, 300) : null, warn: r.warn, prevIssueNo: pe.issue_no });
      }

      if (kind === 'overview') {
        const ctx = picks.map((p, i) => `${i + 1}) ${p.company}: ${p.title}${p.why ? ' / 주목 이유: ' + p.why : ''}`).join('\n');
        const r = await llmClean(env, PROMPTS.overview, `기간: ${start} ~ ${end}\n\n${ctx}`, 500);
        return Response.json({ text: r.text ? llmStr(r.text, 400) : null, warn: r.warn });
      }
      // conclusion — 불릿 여러 개
      const ctx = picks.map((p) => `[${p.company}] ${p.title}\n한컴인사이트: ${p.hancomInsight.join(' / ') || '-'}\n주목 이유: ${p.why || '-'}`).join('\n\n');
      const rc = await llmClean(env, PROMPTS.conclusion, `기간: ${start} ~ ${end}\n\n${ctx}`, 700);
      const items = rc.text
        ? rc.text.split('\n').map((l) => llmStr(l.replace(/^[-·•*\s]+/, ''), 300)).filter(Boolean).slice(0, 3)
        : [];
      return Response.json({ items, warn: rc.warn });
    }

    /* --- 초안 저장 (발행 상태는 건드리지 않는다) --- */
    if (action === 'save') {
      const p = body?.payload || {};
      const payload = {
        bridge: str(p.bridge, 300),
        overview: str(p.overview, 400),
        hancomConclusion: arr(p.hancomConclusion, 3, 300),
        picks: (Array.isArray(p.picks) ? p.picks : []).slice(0, MAX_PICKS).map(sanitizePick).filter(Boolean),
      };
      const row = await env.DB.prepare('SELECT status, issue_no, payload FROM weekly_edition WHERE week = ?').bind(week).first();
      // 초안 단계에서는 번호를 잡아 두지 않는다(발행 순서대로 부여). 관리자가 지정한 경우만 반영.
      const issueNo = Number.isInteger(body?.issueNo) && body.issueNo > 0
        ? await resolveIssueNo(env, week, body.issueNo)
        : (row ? row.issue_no : null);
      // 발행본을 다시 저장하는 경우 발행 시점에만 굳는 값(그 외 동향 스냅샷·이은 회차)을 잃지 않도록 유지한다.
      if (row && row.status === 'published') {
        const cur = parseJson(row.payload, {});
        if (Array.isArray(cur.others)) payload.others = cur.others;
        if (cur.bridgeRef) payload.bridgeRef = cur.bridgeRef;
      }
      if (row) {
        await env.DB.prepare("UPDATE weekly_edition SET payload = ?, issue_no = COALESCE(?, issue_no), updated_at = datetime('now') WHERE week = ?")
          .bind(JSON.stringify(payload), issueNo, week).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO weekly_edition (week, issue_no, range_start, range_end, payload, status, updated_at)
           VALUES (?, ?, ?, ?, ?, 'draft', datetime('now'))`
        ).bind(week, issueNo, start, end, JSON.stringify(payload)).run();
      }
      return Response.json({ ok: true, week, picks: payload.picks.length });
    }

    /* --- 발행: 이 시점 내용을 payload·stats 에 고정한다 --- */
    if (action === 'publish') {
      const row = await env.DB.prepare('SELECT * FROM weekly_edition WHERE week = ?').bind(week).first();
      if (!row) return Response.json({ error: 'NO_DRAFT' }, { status: 404 });
      const payload = parseJson(row.payload, {});
      const picks = (Array.isArray(payload.picks) ? payload.picks : []).map(sanitizePick).filter(Boolean);
      if (!picks.length) return Response.json({ error: 'NO_PICKS' }, { status: 400 });
      // 「왜 주목하나」가 비면 페이지가 대시보드 복사본이 된다 — 발행을 막는다(기획 3절 원칙 1).
      const missing = picks.filter((p) => !p.why).map((p) => p.company);
      if (missing.length) return Response.json({ error: 'WHY_REQUIRED', companies: missing }, { status: 400 });

      const { items, stats } = await collect(env, start, end);
      const picked = new Set(picks.map((p) => p.key));
      const others = items.filter((it) => !picked.has(it.key)).map((it) => { const { score, ...rest } = it; return rest; });
      stats.picks = picks.length;

      const issueNo = await resolveIssueNo(env, week, row.issue_no);
      // 이은 회차 번호도 함께 굳힌다. 나중에 다른 회차가 발행돼도 이 발행본의 「N호 대비」는 변하지 않는다.
      const pe = payload.bridge ? await prevEdition(env, start) : null;
      const finalPayload = {
        bridge: str(payload.bridge, 300),
        bridgeRef: pe ? { week: pe.week, issueNo: pe.issue_no } : null,
        overview: str(payload.overview, 400),
        hancomConclusion: arr(payload.hancomConclusion, 3, 300),
        picks, others,
      };
      await env.DB.prepare(
        `UPDATE weekly_edition
            SET issue_no = ?, stats = ?, payload = ?, status = 'published',
                published_at = COALESCE(published_at, datetime('now')), updated_at = datetime('now')
          WHERE week = ?`
      ).bind(issueNo, JSON.stringify(stats), JSON.stringify(finalPayload), week).run();
      return Response.json({ ok: true, week, issueNo, picks: picks.length, others: others.length });
    }

    if (action === 'unpublish') {
      await env.DB.prepare("UPDATE weekly_edition SET status = 'draft', updated_at = datetime('now') WHERE week = ?").bind(week).run();
      return Response.json({ ok: true, week });
    }

    return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/weekly', action, err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
