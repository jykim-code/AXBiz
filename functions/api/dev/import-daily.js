// POST /api/dev/import-daily  (관리자 PIN)
//   { url } → 컨플 "AX 플랫폼 주요 경쟁사 사업동향 [YYMMDD]" 데일리 페이지의
//   📰 섹션 A(상위 보고용)를 LLM으로 기업별 구조화 → draft_entries(source='daily') 적재.
//   라이브 reports 무변경. 같은 (date,company,'daily') draft는 갱신.
import { pinOk, forbidden } from '../../_auth.js';
import { fetchPage, decode, CATEGORIES, failureResponse } from '../../_confluence.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// XHTML → 줄바꿈 보존 텍스트 (링크는 "텍스트 (URL)" 로 보존 → LLM이 출처 URL 추출 가능)
function toText(html) {
  let s = String(html || '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => t.replace(/<[^>]+>/g, '') + ' (' + h + ')')
    .replace(/<\/(p|li|tr|h[1-6]|div|td|th)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decode(s);
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// 섹션 A(상위 보고용)만 슬라이스. 마커 못 찾으면 전체(상한)로 폴백.
//   「섹션 B」는 반드시 섹션 A 이후에서 찾는다. 머리말에 그 말이 먼저 나오는 회차가 있고
//   (260903: "catch-up 처리: … 섹션 B에만 기재하고 …"), 그때 b < a 가 되어 정상 경로가
//   무너지고 상한 폴백으로 떨어진다. 그러면 섹션 A 뒷부분 항목이 잘려 통째로 누락된다.
const MAX_SECTION_CHARS = 30000; // 섹션 A 7건 실측 약 14,000자. 회차가 커지는 추세라 여유를 둔다.
function sliceSectionA(text) {
  const a = text.search(/섹션\s*A/);
  if (a < 0) return text.slice(0, MAX_SECTION_CHARS);
  const rel = text.slice(a).search(/섹션\s*B/); // a 기준 상대 위치
  if (rel > 0) return text.slice(a, a + rel);
  return text.slice(a, a + MAX_SECTION_CHARS);
}

// 조사 기준일: 본문 "조사 기준일: YYYY-MM-DD" → 제목 [YYMMDD] 폴백
function findDate(text, title) {
  let m = String(text).match(/조사\s*기준일[^0-9]{0,10}(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  m = String(title).match(/\[(\d{2})(\d{2})(\d{2})\]/);
  if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const SYSTEM = `당신은 "AX Biz Radar"의 데이터 추출기입니다.
컨플루언스 데일리 모니터링 보고서의 "섹션 A(상위 보고용)" 텍스트에서 기업별 동향을 JSON 배열로 추출하세요.
각 항목 형식: {"name":"기업명","category":"대기업|중견기업|스타트업·중소","keyPoints":["..."],"implications":["..."],"hancomInsight":["..."],"sourceUrl":"http...","tags":["..."]}
규칙:
- name: 모니터링 대상 기업명으로 정규화. 그룹 차원 보도에 대상 기업이 병기되면 그 기업명 사용(예: "현대차그룹(현대오토에버)" → "현대오토에버"). 알려진 대상 목록을 우선 사용.
- keyPoints: "◆ 주요 내용" 불릿들을 각각 간결한 1문장으로. implications: "◆ 시사점". hancomInsight: "◆ 한컴 관점에서의 의미"/"한컴 인사이트" 불릿들.
- sourceUrl: "◆ 출처"의 첫 번째 URL 하나만.
- tags: 해시태그·본문에서 핵심 태그 4~8개(# 제거, 1~3어절).
- 섹션 A에 명시된 기업 항목만 추출(참고 동향·당일 신규 없음은 제외). 내용 창작 금지.
- 출력은 JSON 배열만(다른 텍스트 금지). 항목이 없으면 [].`;

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) return Response.json({ error: 'LLM_NOT_CONFIGURED' }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const page = await fetchPage(env, body?.url);
  if (!page.ok) return failureResponse(page);

  const text = toText(page.html);
  const date = findDate(text, page.title);
  if (!date) return Response.json({ error: 'NO_DATE', hint: '조사 기준일(YYYY-MM-DD) 또는 제목 [YYMMDD]를 찾지 못했습니다' }, { status: 422 });
  const sectionA = sliceSectionA(text);

  // 알려진 기업명 힌트 (name 정규화용)
  let known = [];
  try {
    const r = await env.DB.prepare('SELECT DISTINCT company FROM company_entries LIMIT 100').all();
    known = (r.results || []).map((x) => x.company);
  } catch { /* 힌트 없이 진행 */ }

  // LLM 추출
  let raw;
  let finish = ''; // 출력이 잘렸는지(length) 구분해 실패 안내에 쓴다
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ax-biz-radar.pages.dev', 'X-Title': 'AX Biz Radar' },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        temperature: 0.2,
        // 출력 예산은 섹션 A 항목 수에 비례한다. 3000 이던 값으로는 260903 회차(7건, 각
        // 주요내용 8·시사점 4·인사이트 5불릿)에서 JSON 이 중간에 끊겨 파싱 실패 → NO_ITEMS 였다.
        // 한글 1자가 대략 토큰 1개이므로 7건이면 8,000토큰을 넘는다.
        max_tokens: 16000,
        reasoning: { enabled: false }, // qwen 등 추론모델: 추론이 응답 예산을 잡아먹어 빈 출력(NO_ITEMS) → 추론 비활성
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `알려진 대상 기업: ${known.join(', ') || '(없음)'}\n날짜: ${date}\n\n${sectionA.slice(0, MAX_SECTION_CHARS)}` },
        ],
      }),
    });
    if (!res.ok) { console.error('/api/dev/import-daily openrouter', res.status); return Response.json({ error: 'LLM_FAILED' }, { status: 502 }); }
    const data = await res.json();
    raw = data?.choices?.[0]?.message?.content || '';
    finish = String(data?.choices?.[0]?.finish_reason || '');
  } catch (err) {
    console.error('/api/dev/import-daily fetch', err);
    return Response.json({ error: 'LLM_FAILED' }, { status: 502 });
  }

  // JSON 배열 파싱(코드블록/잡텍스트 방어)
  let items = [];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(m ? m[0] : raw);
    if (Array.isArray(parsed)) items = parsed;
  } catch { /* 빈 목록 */ }
  // 실패 안내는 원인을 구분해 적는다. 「추출하지 못했습니다」만 띄우면 섹션 A 마커를
  // 의심하게 되는데, 실제로는 출력 토큰이 모자라 JSON 이 끊긴 경우가 있었다(260903 회차).
  if (!items.length) {
    const hint = finish === 'length'
      ? `LLM 출력이 max_tokens 한도에서 끊겨 JSON 을 완성하지 못했습니다 (섹션 A ${sectionA.length}자). 회차 항목 수가 많으면 한도를 올려야 합니다`
      : `섹션 A에서 기업 항목을 추출하지 못했습니다 (섹션 A ${sectionA.length}자, finish_reason=${finish || '미확인'})`;
    return Response.json({ error: 'NO_ITEMS', hint, rawHead: raw.slice(0, 200) }, { status: 422 });
  }

  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 50) : []);
  let upserted = 0;
  const companies = [];
  for (const it of items.slice(0, 30)) {
    const name = String(it?.name || '').trim().slice(0, 200);
    if (!name) continue;
    const category = CATEGORIES.includes(it?.category) ? it.category : '대기업';
    const data = JSON.stringify({
      name, category, summary: '',
      sourceUrl: String(it?.sourceUrl || '').trim().slice(0, 1000),
      confluenceUrl: page.confUrl,
      keyPoints: arr(it?.keyPoints), implications: arr(it?.implications), hancomInsight: arr(it?.hancomInsight),
      tags: arr(it?.tags).map((t) => t.replace(/^#/, '')).slice(0, 10),
    });
    try {
      // 같은 데일리 페이지 재추출은 갱신, 다른 페이지의 같은 (날짜,기업)은 별개 동향으로 공존.
      await env.DB.prepare("DELETE FROM draft_entries WHERE date = ? AND company = ? AND source = 'daily' AND source_ref = ? AND status = 'draft'").bind(date, name, String(page.pageId)).run();
      await env.DB.prepare(
        `INSERT INTO draft_entries (date, company, category, data, source, source_ref, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'daily', ?, 'draft', datetime('now'), datetime('now'))`
      ).bind(date, name, category, data, String(page.pageId)).run();
      upserted++;
      companies.push(name);
    } catch (err) { console.error('dev/import-daily upsert', name, err); }
  }

  return Response.json({ ok: true, date, count: upserted, companies, pageTitle: page.title });
}
