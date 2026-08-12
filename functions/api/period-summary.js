// /api/period-summary  (공개)
//   POST {name, start, end, entries:[{date, keyPoints[], implications[], hancomInsight[]}]}
//        → { summary }  (그 기간 동향의 한국어 1~2문장 종합)
//   클라가 보낸 entries로 종합. (name|start|end|sig) 키로 D1 캐시.
import { stripTrailingPeriod } from '../_style.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function sigOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);

// 끊긴 생성 판별. finish_reason 이 stop 이 아니면(length·error 등) 도중 중단이다.
// 문체 기준이 체언 종결·온점 금지로 바뀌어 「온점·종결어미로 끝나는가」로는 판정할 수 없다
// (정상 출력인 "…수출 산업화로 확대"가 미완으로 오판된다). 대신 이어지는 말로 끝난 경우를 미완으로 본다.
// 체언 종결로 바뀌며 문장이 짧아졌다(서술형 어미가 빠짐). 옛 캐시에도 29자 종합이 있었으므로
// 하한을 40 → 25 로 낮춘다. 실제 절단은 finish_reason 과 DANGLING 이 잡는다.
const MIN_LEN = 25;
const DANGLING = /(?:[,·]|및|또는|그리고|이어|하며|되며|으로|로서|위해|통해|따라|에서|의|을|를|이|가)\s*$/;
function isComplete(text, finishReason) {
  if (!text || text.length < MIN_LEN) return false;
  if (finishReason && finishReason !== 'stop') return false;
  return !DANGLING.test(text);
}
// 서술형 종결은 문체 기준 위반이므로 재생성 대상. 단 마지막 시도에서는 종합이 사라지는 편이
// 더 나쁘므로 완결성만 보고 통과시킨다.
const isDeclarative = (t) => /다\.?$/.test(t);

const SYSTEM = `당신은 "AX Biz Radar"의 분석 도우미입니다.
한 기업의 선택 기간 동향(여러 날짜의 항목)을 한국어로 1~2문장으로 종합하세요.

내용 규칙
- 주어진 내용만 근거로 하고 추측·과장을 하지 않는다
- 흐름·방향이 드러나게 쓴다(예: 초반에는 A, 이후 B로 확대)
- 군더더기를 넣지 않는다

문체 규칙(보고서 항목과 동일)
- 개조식으로 쓰고 체언(명사)으로 끝낸다. 예: ~확대, ~전환, ~구조, ~전망, ~필요, ~미공개
- 서술형(~이다 / ~한다 / ~했다 / ~된다 / ~있다)으로 끝내지 않는다
- 온점(.)을 쓰지 않는다. 끝에도 중간에도 쓰지 않으며, 쉼표로 이어 한 덩어리로 만든다
- em dash(—)·물음표·느낌표를 쓰지 않는다. 쉼표와 콜론(:)은 허용
- 구어·가벼운 표현을 쓰지 않고 공문 수준의 문어체를 쓴다

문장만 출력하고 다른 텍스트를 붙이지 않는다.`;

export async function onRequestPost({ request, env }) {
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) return Response.json({ summary: null, reason: 'LLM_NOT_CONFIGURED' });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const name = String(body?.name || '').trim().slice(0, 200);
  const start = String(body?.start || '').trim();
  const end = String(body?.end || '').trim();
  const entries = Array.isArray(body?.entries) ? body.entries.slice(0, 60) : [];
  if (!name || entries.length < 2) return Response.json({ summary: null });

  // 컨텍스트(날짜 오름차순) + 캐시 키
  const ordered = entries.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const blocks = ordered.map((e) => {
    const kp = arr(e.keyPoints), im = arr(e.implications), hi = arr(e.hancomInsight);
    return `[${e.date || ''}] ` +
      (kp.length ? '주요: ' + kp.join(' / ') : '') +
      (im.length ? ' | 시사점: ' + im.join(' / ') : '') +
      (hi.length ? ' | 한컴인사이트: ' + hi.join(' / ') : '');
  }).join('\n');
  // v3: 문체 규칙(체언 종결·온점 금지) 적용. 옛 키(v2)의 서술형 종합이 계속 서빙되지 않도록 버전을 올린다.
  const ck = 'v3|' + name + '|' + start + '|' + end + '|' + sigOf(blocks);

  // 캐시
  try {
    const row = await env.DB.prepare('SELECT summary FROM period_summary WHERE ck = ?').bind(ck).first();
    if (row && row.summary) return Response.json({ summary: row.summary, cached: true });
  } catch { /* 무시 */ }

  let summary = null;
  for (let attempt = 0; attempt < 2 && !summary; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ax-biz-radar.pages.dev', 'X-Title': 'AX Biz Radar' },
        body: JSON.stringify({
          model: env.OPENROUTER_MODEL,
          temperature: 0.3,
          max_tokens: 700,
          reasoning: { enabled: false }, // 추론모델 토큰 낭비·빈 출력 방지
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `기업: ${name}\n기간: ${start} ~ ${end}\n\n${blocks}` },
          ],
        }),
      });
      if (!res.ok) {
        console.error('/api/period-summary openrouter', res.status, (await res.text().catch(() => '')).slice(0, 200));
        continue;
      }
      const data = await res.json();
      const choice = data?.choices?.[0];
      // 끝 온점은 문체 기준 위반이라 저장 전에 떼어 둔다(모델이 습관적으로 붙이는 경우가 있음)
      const text = stripTrailingPeriod((choice?.message?.content || '').trim());
      const reason = choice?.finish_reason || '';
      // 생성이 중간에 끊긴 응답을 그대로 캐시하면 문장이 잘린 종합이 계속 노출된다
      // (실측: "…확장한 데 이어" 42자에서 끊긴 값이 저장돼 있었음).
      if (!isComplete(text, reason)) {
        console.error('/api/period-summary incomplete', name, 'finish=' + reason, 'len=' + text.length, text.slice(-40));
        continue;
      }
      // 첫 시도에서 서술형이면 한 번 더 받아 본다(마지막 시도는 그대로 채택)
      if (isDeclarative(text) && attempt === 0) {
        console.error('/api/period-summary declarative retry', name, text.slice(-30));
        continue;
      }
      summary = text;
    } catch (err) { console.error('/api/period-summary fetch', err); }
  }

  if (summary) {
    try {
      await env.DB.prepare("INSERT INTO period_summary (ck, summary, fetched_at) VALUES (?, ?, datetime('now')) ON CONFLICT(ck) DO UPDATE SET summary=excluded.summary, fetched_at=datetime('now')").bind(ck, summary).run();
    } catch { /* 캐시 쓰기 실패 무시 */ }
  }
  return Response.json({ summary });
}
