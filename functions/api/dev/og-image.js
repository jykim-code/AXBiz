// /api/dev/og-image?url=<기사 주소>   (관리자 PIN)
//
// 기사 HTML 을 **Cloudflare 엣지에서** 받아 og:image 주소만 돌려준다.
// 「기사 사진을 슬라이드에 쓸 수 있는가」를 확인하기 위한 임시 엔드포인트이며,
// 회차 데이터에는 아무것도 저장하지 않는다. 확인이 끝나면 지운다.
//
// 사내망(국내 IP)에서는 이미 되는 것을 확인했다. 여기서 확인하려는 것은 그것이 아니라
// **엣지 IP 로도 되는가** 다 — 국내 매체 CDN 이 데이터센터 IP 를 막는 경우가 있어
// 코드를 올려 보지 않으면 알 수 없는 항목이었다.
import { pinOk, forbidden } from '../../_auth.js';

// 임의 주소를 받아 서버가 대신 호출해 주는 엔드포인트는 그대로 두면 내부망 스캔 도구가 된다(SSRF).
// PIN 만으로 막지 않고 **추적 중인 매체만 허용 목록**으로 받는다. 확인 목적이라 목록은 좁게 둔다.
const ALLOW = [
  'zdnet.co.kr', 'etnews.com', 'aitimes.com', 'yna.co.kr', 'mk.co.kr', 'hankyung.com',
  'sedaily.com', 'dt.co.kr', 'ddaily.co.kr', 'thelec.kr', 'byline.network', 'bloter.net',
  'techm.kr', 'inews24.com', 'newsis.com', 'fnnews.com', 'ajunews.com', 'edaily.co.kr',
];
const hostOk = (h) => ALLOW.some((d) => h === d || h.endsWith('.' + d));

// DART 호출에서 겪었던 것과 같다 — UA 가 없으면 비-JSON/차단으로 떨어지는 곳이 있어 항상 붙인다.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const meta = (html, key, attr) => {
  const a = html.match(new RegExp('<meta[^>]+' + attr + '=["\']' + key + '["\'][^>]+content=["\']([^"\']+)["\']', 'i'));
  if (a) return a[1];
  const b = html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+' + attr + '=["\']' + key + '["\']', 'i'));
  return b ? b[1] : null;
};

async function timed(fn) {
  const t0 = Date.now();
  try { return { ...(await fn()), ms: Date.now() - t0 }; }
  catch (e) { return { error: String((e && e.message) || e), ms: Date.now() - t0 }; }
}

// 이미지 본문을 다 받지 않고 응답 헤더만 본다. HEAD 를 막는 곳이 있어 Range 로 한 번 더 시도한다.
async function probeImage(url, referer) {
  const headers = { 'User-Agent': UA };
  if (referer) headers.Referer = referer;
  let r = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' });
  if (r.status === 405 || r.status === 501) {
    r = await fetch(url, { method: 'GET', headers: { ...headers, Range: 'bytes=0-1023' }, redirect: 'follow' });
  }
  return {
    status: r.status,
    type: r.headers.get('content-type') || '',
    bytes: Number(r.headers.get('content-length') || 0) || null,
  };
}

export async function onRequestGet({ request, env }) {
  if (!pinOk(env, request)) return forbidden();

  const raw = new URL(request.url).searchParams.get('url') || '';
  let target;
  try { target = new URL(raw); } catch { return Response.json({ error: 'INVALID_URL' }, { status: 400 }); }
  if (!/^https?:$/.test(target.protocol)) return Response.json({ error: 'SCHEME_NOT_ALLOWED' }, { status: 400 });
  if (!hostOk(target.hostname)) {
    return Response.json({ error: 'HOST_NOT_ALLOWED', host: target.hostname, allow: ALLOW }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  // 1) 기사 HTML — 엣지에서 받는다
  const page = await timed(async () => {
    const r = await fetch(target.href, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    // og 태그는 head 에 있다. 본문을 다 읽을 이유가 없어 앞부분만 본다.
    const html = (await r.text()).slice(0, 400000);
    return { status: r.status, finalUrl: r.url || target.href, html };
  });
  if (page.error) return Response.json({ ok: false, stage: 'article', ...page }, { status: 502 });

  const html = page.html || '';
  const found = meta(html, 'og:image', 'property') || meta(html, 'twitter:image', 'name');
  const declaredW = meta(html, 'og:image:width', 'property');
  const declaredH = meta(html, 'og:image:height', 'property');

  const out = {
    ok: true,
    article: { url: target.href, status: page.status, ms: page.ms, bytes: html.length },
    image: null,
    edgeColo: request.headers.get('cf-ray') || null,
  };
  if (!found) return Response.json({ ...out, ok: false, reason: 'NO_OG_IMAGE' });

  const abs = new URL(found, page.finalUrl || target.href).href;
  out.image = {
    url: abs,
    declared: declaredW && declaredH ? declaredW + 'x' + declaredH : null,
    // Referer 없음 = 서버가 받아 저장하는 경우 / Referer 우리 도메인 = 페이지에서 바로 거는 경우(핫링크)
    noReferer: await timed(() => probeImage(abs, null)),
    ourReferer: await timed(() => probeImage(abs, origin + '/')),
  };
  return Response.json(out);
}
