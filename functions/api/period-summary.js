// /api/period-summary  (공개)
//   POST {name, start, end, entries:[{date, keyPoints[], implications[], hancomInsight[]}]}
//        → { summary }  (그 기간 동향의 한국어 1~2문장 종합)
//   클라가 보낸 entries로 종합. (name|start|end|sig) 키로 D1 캐시.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function sigOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);

const SYSTEM = `당신은 "AX Biz Radar"의 분석 도우미입니다.
한 기업의 선택 기간 동향(여러 날짜의 항목)을 한국어로 **1~2문장**으로 종합하세요.
규칙: 주어진 내용만 근거로(추측·과장 금지), 흐름·방향이 드러나게(예: "초반엔 A, 이후 B로 확대"), 군더더기 없이. 문장만 출력.`;

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
  const ck = name + '|' + start + '|' + end + '|' + sigOf(blocks);

  // 캐시
  try {
    const row = await env.DB.prepare('SELECT summary FROM period_summary WHERE ck = ?').bind(ck).first();
    if (row && row.summary) return Response.json({ summary: row.summary, cached: true });
  } catch { /* 무시 */ }

  let summary = null;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ax-biz-radar.pages.dev', 'X-Title': 'AX Biz Radar' },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `기업: ${name}\n기간: ${start} ~ ${end}\n\n${blocks}` },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      summary = (data?.choices?.[0]?.message?.content || '').trim() || null;
    } else {
      console.error('/api/period-summary openrouter', res.status);
    }
  } catch (err) { console.error('/api/period-summary fetch', err); }

  if (summary) {
    try {
      await env.DB.prepare("INSERT INTO period_summary (ck, summary, fetched_at) VALUES (?, ?, datetime('now')) ON CONFLICT(ck) DO UPDATE SET summary=excluded.summary, fetched_at=datetime('now')").bind(ck, summary).run();
    } catch { /* 캐시 쓰기 실패 무시 */ }
  }
  return Response.json({ summary });
}
