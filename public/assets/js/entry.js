/* 보고서 1건(entry) 본문 렌더 — 대시보드 카드 · 기업 상세 페이지 공용.
   한 건의 본문이 같은 굵기의 글줄로 쏟아져 읽기 어려웠던 것을 카테고리 블록으로 나눈다.
   위계는 정보 성격 순서: 사실(주요 내용)=배경 없음 · 해석(시사점)=베이지 블록 · 판단(한컴 인사이트)=라임 블록.
   색은 design-preview.html 팔레트(라임·베이지·ink)만 사용한다. */

const ENTRY_ICON = {
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  trend: '<path d="M22 7l-8.5 8.5-4-4L2 19"/><path d="M16 7h6v6"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5C17.8 10.2 18 9 18 8A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};

const enSvg = (k, cls) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + cls + '">' +
  ENTRY_ICON[k] + '</svg>';

// 카테고리 머리 — 아이콘 칩 + 헤딩(15px font-display) + 우측 영문 라벨.
// 칩 색이 블록 위계를 한 번 더 알려준다: 옅은 ink → ink 바탕 → 라임 바탕.
function enHead(iconKey, title, chipCls, eyebrow) {
  return '<div class="flex items-center gap-2 mb-2">' +
    '<span class="flex-none w-6 h-6 rounded-lg flex items-center justify-center ' + chipCls + '">' + enSvg(iconKey, 'w-3.5 h-3.5') + '</span>' +
    '<h4 class="font-display font-bold text-[15px] tracking-tight leading-none">' + title + '</h4>' +
    '<span class="ml-auto text-[10px] font-bold uppercase tracking-widest text-ink/35">' + eyebrow + '</span>' +
    '</div>';
}

/* 주요 내용 — 번호 + 얇은 구분선 행. 항목이 많아도 몇 번째를 읽는지 눈으로 짚을 수 있다. */
const ENTRY_POINT_MAX = 4; // 초과분은 접어 둠(항목이 8개까지 오므로 첫 화면 부담을 줄인다)
const ENTRY_ROWS_CLS = 'divide-y divide-ink/[.06] border-t border-ink/[.06]';

const enRow = (x, n) =>
  '<li class="flex gap-2.5 py-2">' +
  '<span class="flex-none w-3.5 pt-[3px] text-right font-display text-[11px] font-bold text-lime-600">' + n + '</span>' +
  '<span class="text-[13.5px] leading-[1.7] text-ink/85">' + escapeHtml(x) + '</span></li>';

function enPoints(arr) {
  const shown = arr.slice(0, ENTRY_POINT_MAX), rest = arr.slice(ENTRY_POINT_MAX);
  let h = '<ul class="' + ENTRY_ROWS_CLS + '">' + shown.map((x, i) => enRow(x, i + 1)).join('') + '</ul>';
  if (rest.length) {
    // details/summary로 JS 없이 접는다. data-no-toggle은 대시보드 카드 토글로 클릭이 새지 않게 하는 표시.
    h += '<details class="group" data-no-toggle>' +
      '<summary class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center gap-1 pt-2 text-[11px] font-bold text-lime-600 hover:text-ink transition-colors">' +
        '<span class="group-open:hidden">' + rest.length + '개 더 보기</span>' +
        '<span class="hidden group-open:inline">접기</span>' +
        enSvg('chevron', 'w-3 h-3 transition-transform group-open:rotate-180') +
      '</summary>' +
      '<ul class="' + ENTRY_ROWS_CLS + '">' + rest.map((x, i) => enRow(x, i + 1 + ENTRY_POINT_MAX)).join('') + '</ul>' +
      '</details>';
  }
  return h;
}

// 시사점·한컴 인사이트는 보통 1개 장문이라 점 없는 문단으로 둔다(점 하나만 찍히면 되레 산만함).
function enProse(arr, dotCls, textCls) {
  if (arr.length === 1) return '<p class="' + textCls + '">' + escapeHtml(arr[0]) + '</p>';
  return '<ul class="space-y-2">' + arr.map((x) =>
    '<li class="' + textCls + ' pl-3.5 relative before:content-[\'\'] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full ' + dotCls + '">' +
    escapeHtml(x) + '</li>').join('') + '</ul>';
}

const EN_LINK_CLS = 'text-xs font-medium border border-ink/10 rounded-full px-3.5 py-2 inline-flex items-center gap-1.5 hover:bg-ink hover:text-white transition-colors';

/* 한 건(날짜)의 본문: 주요 내용 / 시사점 / 한컴 인사이트 / 링크. 없는 카테고리는 통째로 생략.
   담을 것이 하나도 없으면 빈 문자열 — 호출부가 이를 보고 정적 카드로 처리한다. */
function entryDetailHTML(e) {
  const kp = (e.keyPoints || []).filter(Boolean);
  const im = (e.implications || []).filter(Boolean);
  const hi = (e.hancomInsight || []).filter(Boolean);
  const src = safeUrl(e.sourceUrl), conf = safeUrl(e.confluenceUrl);
  let h = '';
  if (kp.length)
    h += '<section>' + enHead('list', '주요 내용', 'bg-ink/[.06] text-ink/55', 'Key facts') + enPoints(kp) + '</section>';
  if (im.length)
    h += '<section class="rounded-2xl bg-beige border border-ink/[.07] p-4">' +
      enHead('trend', '시사점', 'bg-ink text-lime', 'Implication') +
      enProse(im, 'before:bg-ink/30', 'text-[13.5px] leading-[1.75] text-ink/85') + '</section>';
  if (hi.length)
    h += '<section class="rounded-2xl bg-lime/15 border border-lime p-4">' +
      enHead('bulb', '한컴 인사이트', 'bg-lime text-ink', 'Hancom') +
      enProse(hi, 'before:bg-lime-600', 'text-[13.5px] leading-[1.75] text-ink/90') + '</section>';
  if (src || conf) {
    h += '<div class="flex flex-wrap gap-2 pt-1">' +
      (src ? '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener noreferrer" class="' + EN_LINK_CLS + '">' + enSvg('link', 'w-4 h-4') + ' 출처 기사</a>' : '') +
      (conf ? '<a href="' + escapeHtml(conf) + '" target="_blank" rel="noopener noreferrer" class="' + EN_LINK_CLS + '">' + enSvg('doc', 'w-4 h-4') + ' 상세 모니터링</a>' : '') +
      '</div>';
  }
  return h ? '<div class="space-y-3.5">' + h + '</div>' : '';
}
