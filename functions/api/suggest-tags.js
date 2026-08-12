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

// 프롬프트에 실어 보낼 기존 태그 수(빈도 상위). 너무 늘리면 토큰만 먹는다.
const VOCAB_IN_PROMPT = 180;

// 표기 정규화 — "소버린 AI" 와 "소버린AI" 를 같은 것으로 본다.
const normKey = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s·・\-_,.，、/()]/g, '');

// 기존 태그 사전(빈도 desc). 추천이 매번 새 표현을 만들어 1회성 태그가 쌓이는 것을 막는 근거 자료.
async function loadVocab(env) {
  const rows = (await env.DB.prepare('SELECT companies FROM reports').all()).results || [];
  const count = new Map();
  for (const row of rows) {
    let companies;
    try { companies = JSON.parse(row.companies || '[]'); } catch { continue; }
    for (const c of companies || []) {
      for (const t of ((c && c.tags) || [])) {
        const k = String(t || '').trim();
        if (k) count.set(k, (count.get(k) || 0) + 1);
      }
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

const SYSTEM = `당신은 기업 AX(AI 전환) 동향 자료에 태그를 다는 도우미입니다.
주어진 본문에서 핵심 주제·기술·키워드를 한국어 태그로 4~8개 뽑으세요.
규칙:
- **기존 태그 목록에 있는 표기를 최우선으로 사용**하세요. 같은 개념이면 새 표현을 만들지 말고 목록의 표기를 그대로 쓰세요.
- 목록에 없는 태그는 정말 새로운 개념일 때만 추가하고, 그 경우에도 목록의 작명 방식(띄어쓰기·대소문자)을 따르세요.
- 각 태그는 1~3어절로 짧고 일반적인 표기(예: "소버린AI", "온프레미스", "에이전틱AI").
- 기업명 자체, 인물명, 고객사명, 금액·용량 수치, 진행 상태(신규편입 등), 행사명, 문장형은 제외.
- 한 항목에만 쓰일 지나치게 좁은 태그는 만들지 마세요(예: "문서컨텍스트", "임플로이에이전트").
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

  // 기존 태그 사전 — 실패해도 추천 자체는 진행(사전 없이 동작하던 이전과 동일)
  let vocab = [];
  try { vocab = await loadVocab(env); } catch (err) { console.error('/api/suggest-tags vocab', err); }

  // 사전은 system 으로 보낸다. user 쪽은 6000자로 자르므로 여기 넣으면 본문이 밀려난다.
  const system = SYSTEM + (vocab.length
    ? `\n\n기존 태그 목록(빈도순, 이 표기를 우선 사용):\n${vocab.slice(0, VOCAB_IN_PROMPT).join(', ')}`
    : '');

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
        reasoning: { enabled: false }, // 추론모델 토큰 낭비·빈 출력 방지
        messages: [
          { role: 'system', content: system },
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
  // 프롬프트만으로는 "소버린 AI" vs "소버린AI" 같은 표기 분화를 완전히 막지 못하므로,
  // 정규화가 같은 기존 태그가 있으면 그 표기로 되돌린다(결정적 처리).
  const byNorm = new Map();
  for (const t of vocab) { const k = normKey(t); if (k && !byNorm.has(k)) byNorm.set(k, t); }

  let tags = [];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(m ? m[0] : raw);
    if (Array.isArray(parsed)) {
      const seen = new Set();
      for (const x of parsed) {
        const t0 = String(x || '').trim().slice(0, 40);
        if (!t0) continue;
        const k = normKey(t0);
        const t = byNorm.get(k) || t0;
        if (!seen.has(k)) { seen.add(k); tags.push(t); }
        if (tags.length >= MAX_TAGS) break;
      }
    }
  } catch { /* 파싱 실패 → 빈 목록 */ }

  return Response.json({ tags });
}
