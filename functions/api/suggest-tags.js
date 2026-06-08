// /api/suggest-tags  (관리자 PIN)
//   POST {name, keyPoints[], implications[], hancomInsight[]} → { tags: [...] }
//   기업 동향 본문을 LLM으로 읽어 한국어 태그 후보를 추출(관리자 채택용, 자동확정 아님).
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_TAGS = 10;

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 50) : []);

const SYSTEM = `당신은 기업 AX(AI 전환) 동향 자료에 태그를 다는 도우미입니다.
주어진 본문에서 핵심 주제·기술·키워드를 한국어 태그로 4~8개 뽑으세요.
규칙:
- 각 태그는 1~3어절로 짧고 일반적인 표기(예: "AI 에이전트", "멀티 LLM", "공공 SI", "온프레미스").
- 기업명 자체, 너무 일반적인 말("AI", "기술"), 문장형은 제외.
- 표기를 일관되게(띄어쓰기·영문 대소문자 정돈).
- 출력은 JSON 배열 하나만: ["태그1","태그2", ...] (다른 텍스트 금지).`;

export async function onRequestPost({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) return Response.json({ error: 'LLM_NOT_CONFIGURED' }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const name = String(body?.name || '').trim().slice(0, 200);
  const kp = arr(body?.keyPoints), im = arr(body?.implications), hi = arr(body?.hancomInsight);
  if (!kp.length && !im.length && !hi.length) return Response.json({ error: 'EMPTY_CONTENT' }, { status: 400 });

  const content =
    (name ? `기업: ${name}\n` : '') +
    (kp.length ? `주요내용:\n- ${kp.join('\n- ')}\n` : '') +
    (im.length ? `시사점:\n- ${im.join('\n- ')}\n` : '') +
    (hi.length ? `한컴인사이트:\n- ${hi.join('\n- ')}\n` : '');

  let raw;
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
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: content.slice(0, 6000) },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('/api/suggest-tags openrouter', res.status, t.slice(0, 200));
      return Response.json({ error: 'LLM_FAILED' }, { status: 502 });
    }
    const data = await res.json();
    raw = data?.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('/api/suggest-tags fetch', err);
    return Response.json({ error: 'LLM_FAILED' }, { status: 502 });
  }

  // JSON 배열 추출(코드블록/잡텍스트 방어)
  let tags = [];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(m ? m[0] : raw);
    if (Array.isArray(parsed)) {
      const seen = new Set();
      for (const x of parsed) {
        const t = String(x || '').trim().slice(0, 40);
        if (t && !seen.has(t)) { seen.add(t); tags.push(t); }
        if (tags.length >= MAX_TAGS) break;
      }
    }
  } catch { /* 파싱 실패 → 빈 목록 */ }

  return Response.json({ tags });
}
