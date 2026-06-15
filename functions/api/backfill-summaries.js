// /api/backfill-summaries  (관리자 PIN)
//   GET            → { total, withSummary, missing }  현황
//   POST {limit?, force?} → 한 줄 요약이 없는(또는 force=true면 전부) 기업 항목을 LLM으로 생성해 채움.
//                            한 번에 limit개(기본 20, 최대 60)만 처리하고 { processed, remaining } 반환.
//                            남으면 remaining>0 이므로 호출 측이 반복 호출. (기존 데이터 1회성 백필용)
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
function forbidden(env, pin) { return !env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN); }

const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 50) : []);
const hasContent = (c) => arr(c && c.keyPoints).length || arr(c && c.implications).length || arr(c && c.hancomInsight).length;
const hasSummary = (c) => !!(c && c.summary && String(c.summary).trim());

const SYSTEM = `당신은 기업 AX(AI 전환) 동향 카드의 "한 줄 요약"을 만드는 도우미입니다.
주어진 한 기업·한 시점의 주요내용을 한국어 **한 문장(공백 포함 70자 이내)**으로 압축하세요.
규칙: 가장 핵심인 사실 1개만, 간결한 명사형 종결, 군더더기·평가어 최소, 따옴표/불릿/접두어 없이 **문장만** 출력.`;

async function genSummary(env, c) {
  const kp = arr(c.keyPoints), im = arr(c.implications);
  if (!kp.length && !im.length) return null;
  const content =
    (c.name ? `기업: ${c.name}\n` : '') +
    (kp.length ? `주요내용:\n- ${kp.join('\n- ')}\n` : '') +
    (im.length ? `시사점:\n- ${im.join('\n- ')}` : '');
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
        max_tokens: 600, // 추론·응답 토큰 여유(모델 무관, period-summary 와 동일 사유)
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: content.slice(0, 6000) },
        ],
      }),
    });
    if (!res.ok) { console.error('/api/backfill-summaries openrouter', res.status); return null; }
    const data = await res.json();
    let out = (data?.choices?.[0]?.message?.content || '').trim();
    out = out.split('\n')[0].replace(/^["'`\-\s>]+/, '').trim().slice(0, 200);
    return out || null;
  } catch (err) { console.error('/api/backfill-summaries fetch', err); return null; }
}

export async function onRequestGet({ request, env }) {
  if (forbidden(env, request.headers.get('x-admin-pin') || '')) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  let total = 0, withS = 0;
  try {
    const rows = await env.DB.prepare('SELECT companies FROM reports').all();
    for (const row of (rows.results || [])) {
      let cs; try { cs = JSON.parse(row.companies || '[]'); } catch { continue; }
      for (const c of cs) { if (!hasContent(c)) continue; total++; if (hasSummary(c)) withS++; }
    }
  } catch (err) { console.error('GET /api/backfill-summaries', err); return Response.json({ error: 'DB_ERROR' }, { status: 500 }); }
  return Response.json({ total, withSummary: withS, missing: total - withS });
}

export async function onRequestPost({ request, env }) {
  if (forbidden(env, request.headers.get('x-admin-pin') || '')) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) return Response.json({ error: 'LLM_NOT_CONFIGURED' }, { status: 503 });

  let body = {}; try { body = await request.json(); } catch { /* 기본값 사용 */ }
  const limit = Math.min(Math.max(+body.limit || 20, 1), 60);
  const force = !!body.force;

  let rows;
  try { rows = await env.DB.prepare('SELECT date, companies FROM reports ORDER BY date ASC').all(); }
  catch (err) { console.error('POST /api/backfill-summaries load', err); return Response.json({ error: 'DB_ERROR' }, { status: 500 }); }

  let processed = 0, remaining = 0;
  const dirty = []; // [date, companiesArray]
  for (const row of (rows.results || [])) {
    let cs; try { cs = JSON.parse(row.companies || '[]'); } catch { continue; }
    let changed = false;
    for (const c of cs) {
      if (!hasContent(c)) continue;
      if (hasSummary(c) && !force) continue; // 이미 있음 → 건너뜀(멱등)
      if (processed >= limit) { remaining++; continue; } // 이번 배치 한도 초과 → 다음 호출로
      const s = await genSummary(env, c);
      if (s) { c.summary = s; changed = true; processed++; }
    }
    if (changed) dirty.push([row.date, cs]);
  }

  for (const [date, cs] of dirty) {
    try { await env.DB.prepare("UPDATE reports SET companies = ?, updated_at = datetime('now') WHERE date = ?").bind(JSON.stringify(cs), date).run(); }
    catch (err) { console.error('POST /api/backfill-summaries write', date, err); }
  }
  return Response.json({ processed, remaining, datesUpdated: dirty.length });
}
