/* 공통 유틸 — 출력 안전성 (XSS / 링크 스킴 방어) */

// HTML/SVG 텍스트로 안전하게 삽입하기 위한 이스케이프
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// http(s) 절대 URL만 허용. 스킴 없는 문자열·protocol-relative(//host)·javascript:·data: 등은
// base 없이 파싱하면 throw 되거나 스킴 불일치로 걸러져 빈 문자열 반환 → 링크 미표시.
function safeUrl(u) {
  const s = String(u == null ? '' : u).trim();
  if (!s) return '';
  try {
    const parsed = new URL(s); // base 미지정: 스킴 없는 입력은 throw
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password) {
      return parsed.href;
    }
  } catch {
    /* 잘못된 URL */
  }
  return '';
}

// YYYY-MM-DD 포맷 헬퍼
const pad2 = (n) => String(n).padStart(2, '0');
function ymd(y, m, d) {
  return y + '-' + pad2(m) + '-' + pad2(d);
}
function todayYmd() {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 한컴 로고 ─────────────────────────────────
   로고 색은 CSS 필터로 만들지 않고 파일 두 개를 갈아끼운다(2026-08-31 사용자 지시).
   `filter: invert()` 는 글자만 뒤집지 않고 H 자 오렌지 강조(#ef5222)까지 시안(#10addd)으로
   바꿔 브랜드 색을 없앤다. 두 파일은 판형(716x158)과 잉크 위치가 같게 맞춰 두었으므로
   같은 h-* 클래스에서 크기가 어긋나지 않는다. */
const LOGO_ON_LIGHT = '/assets/HANCOM.png';   // 밝은 바탕 → 검정 글자
const LOGO_ON_DARK = '/assets/HANCOM-w.png';  // 어두운 바탕 → 흰 글자
function hancomLogo(onDark) {
  return onDark ? LOGO_ON_DARK : LOGO_ON_LIGHT;
}

/* 다크 모드를 따라 배경이 바뀌는 로고(nav·사이드바 등)를 현재 모드에 맞게 갈아끼운다.
   자기 판의 배경색을 스스로 아는 로고(뉴스레터 판·위클리 커버)는 `data-logo-fixed` 를
   달아 두어 여기서 건드리지 않는다 — 그 판들은 다크 모드와 무관하게 바탕이 정해져 있다. */
function syncHancomLogos(root) {
  const want = hancomLogo(document.documentElement.classList.contains('dark'));
  (root || document).querySelectorAll('img[src*="HANCOM"]:not([data-logo-fixed])')
    .forEach(function (img) {
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    });
}
