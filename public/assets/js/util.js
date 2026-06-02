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
