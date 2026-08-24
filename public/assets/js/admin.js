/* 관리자 입력 — PIN 게이트, 동적 폼, 기존일 로드, upsert 저장 */

const CATEGORIES = ['대기업', '중견기업', '스타트업·중소'];
const BULLET_FIELDS = [
  { key: 'keyPoints', label: '주요 내용' },
  { key: 'implications', label: '시사점' },
  { key: 'hancomInsight', label: '한컴 인사이트' },
];

let adminPin = '';

/* ===== DOM 헬퍼 ===== */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function')
        node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
  }
  (children || []).forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function toast(msg, ok) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok === false ? '#dc2626' : '#111';
  t.style.opacity = '1';
  setTimeout(() => (t.style.opacity = '0'), 2600);
}

/* ===== 불릿 그룹 ===== */
function bulletRow(value) {
  const input = el('input', { class: 'field bullet-input', type: 'text', value: value || '' });
  const remove = el('button', {
    type: 'button',
    class: 'btn flex-none w-9 h-9 border border-ink/15 hover:bg-red-500 hover:text-white hover:border-red-500',
    text: '×',
    onclick: () => row.remove(),
  });
  const row = el('div', { class: 'flex gap-2 items-center' }, [input, remove]);
  return row;
}

function bulletGroup(field, label, items) {
  const list = el('div', { class: 'space-y-2', 'data-field': field.key });
  (items && items.length ? items : ['']).forEach((v) => list.appendChild(bulletRow(v)));
  const add = el('button', {
    type: 'button',
    class: 'text-xs font-semibold text-lime-600 hover:text-ink mt-1',
    text: '+ ' + label + ' 추가',
    onclick: () => list.appendChild(bulletRow('')),
  });
  return el('div', { class: 'space-y-1.5' }, [
    el('div', { class: 'label', text: label }),
    list,
    add,
  ]);
}

/* ===== 기업 블록 ===== */
function companyBlock(data) {
  data = data || {};
  const name = el('input', { class: 'field c-name', type: 'text', placeholder: '기업명', value: data.name || '' });

  const category = el('select', { class: 'field c-category' });
  CATEGORIES.forEach((c) => {
    const opt = el('option', { value: c, text: c });
    if (data.category === c) opt.selected = true;
    category.appendChild(opt);
  });

  const source = el('input', { class: 'field c-source', type: 'url', placeholder: '출처 기사 URL (https://...)', value: data.sourceUrl || '' });
  const confluence = el('input', { class: 'field c-confluence', type: 'url', placeholder: 'Confluence URL (https://...)', value: data.confluenceUrl || '' });
  const tags = el('input', { class: 'field c-tags', type: 'text', placeholder: '태그 (쉼표로 구분)', value: (data.tags || []).join(', ') });

  const removeBtn = el('button', {
    type: 'button',
    class: 'btn text-xs border border-ink/15 px-3 py-1.5 hover:bg-red-500 hover:text-white hover:border-red-500',
    text: '기업 삭제',
    onclick: () => block.remove(),
  });

  const head = el('div', { class: 'flex items-center justify-between mb-4' }, [
    el('div', { class: 'label', text: '기업' }),
    removeBtn,
  ]);

  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4' }, [
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: '기업명' }), name]),
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: '분류' }), category]),
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: '출처 링크' }), source]),
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: 'Confluence 링크' }), confluence]),
  ]);

  const bulletWrap = el('div', { class: 'space-y-4 mb-4' });
  BULLET_FIELDS.forEach((f) => bulletWrap.appendChild(bulletGroup(f, f.label, data[f.key])));

  // 접힘 카드용 한 줄 요약 (비우면 대시보드가 첫 주요내용으로 폴백)
  const summary = el('input', { class: 'field c-summary', type: 'text', placeholder: '한 줄 요약 — 접힘 카드에 표시 (비우면 첫 주요 내용)', value: data.summary || '' });
  const summaryWrap = el('div', { class: 'space-y-1.5 mb-4' }, [
    el('div', { class: 'label', text: '한 줄 요약' }),
    summary,
  ]);

  const sugBox = el('div', { class: 'flex flex-wrap gap-1.5' });
  const suggestBtn = el('button', {
    type: 'button',
    class: 'text-xs font-semibold text-lime-600 hover:text-ink',
    text: 'AI 태그 추천',
    onclick: (e) => suggestTagsFor(e.target.closest('.company-block'), tags, sugBox),
  });
  const tagsWrap = el('div', { class: 'space-y-1.5' }, [
    el('div', { class: 'flex items-center gap-3' }, [el('div', { class: 'label', text: '태그' }), suggestBtn]),
    tags,
    sugBox,
  ]);

  const block = el('div', { class: 'company-block bg-white rounded-[20px] border border-ink/5 shadow-xl shadow-ink/5 p-6' }, [
    head,
    grid,
    bulletWrap,
    summaryWrap,
    tagsWrap,
  ]);
  return block;
}

/* ===== AI 태그 추천 (본문 → LLM 후보, 관리자가 클릭 채택) ===== */
async function suggestTagsFor(block, tagsInput, sugBox) {
  if (!block) return;
  const payload = {
    name: block.querySelector('.c-name').value.trim(),
    keyPoints: collectBullets(block, 'keyPoints'),
    implications: collectBullets(block, 'implications'),
    hancomInsight: collectBullets(block, 'hancomInsight'),
  };
  if (!payload.keyPoints.length && !payload.implications.length && !payload.hancomInsight.length) {
    sugBox.innerHTML = '<span class="text-xs text-red-500">주요 내용을 먼저 입력하세요</span>';
    return;
  }
  sugBox.innerHTML = '<span class="text-xs opacity-50">추천 생성 중…</span>';
  try {
    const { tags } = await API.suggestTags(payload, adminPin);
    const existing = new Set(tagsInput.value.split(',').map((s) => s.trim()).filter(Boolean));
    sugBox.innerHTML = '';
    (tags || []).filter((t) => !existing.has(t)).forEach((t) => {
      const chip = el('button', { type: 'button', class: 'text-xs rounded-full px-3 py-1 border border-ink/15 bg-beige hover:bg-lime hover:border-lime', text: '+ ' + t });
      chip.onclick = () => {
        const cur = tagsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
        if (!cur.includes(t)) { cur.push(t); tagsInput.value = cur.join(', '); }
        chip.remove();
      };
      sugBox.appendChild(chip);
    });
    if (!sugBox.children.length) sugBox.innerHTML = '<span class="text-xs opacity-50">추가할 새 태그가 없습니다</span>';
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    sugBox.innerHTML = '<span class="text-xs text-red-500">추천 실패: ' + ((e.data && e.data.error) || e.status || e.message) + '</span>';
  }
}

/* ===== 수집 / 검증 ===== */
function collectBullets(block, field) {
  const list = block.querySelector('[data-field="' + field + '"]');
  return Array.from(list.querySelectorAll('.bullet-input'))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

function collect() {
  const blocks = Array.from(document.querySelectorAll('.company-block'));
  const companies = [];
  for (const b of blocks) {
    const name = b.querySelector('.c-name').value.trim();
    if (!name) continue; // 기업명 없으면 스킵
    companies.push({
      name,
      category: b.querySelector('.c-category').value,
      summary: b.querySelector('.c-summary').value.trim(),
      sourceUrl: b.querySelector('.c-source').value.trim(),
      confluenceUrl: b.querySelector('.c-confluence').value.trim(),
      keyPoints: collectBullets(b, 'keyPoints'),
      implications: collectBullets(b, 'implications'),
      hancomInsight: collectBullets(b, 'hancomInsight'),
      tags: b.querySelector('.c-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    });
  }
  return companies;
}

/* ===== 기존 데이터 로드 ===== */
async function loadExisting() {
  const date = document.getElementById('reportDate').value;
  const status = document.getElementById('loadStatus');
  const btn = document.getElementById('loadBtn');
  if (!date) {
    status.textContent = '날짜를 먼저 선택하세요.';
    return;
  }
  btn.disabled = true;
  status.textContent = '불러오는 중…';
  try {
    const companies = await API.report(date);
    const wrap = document.getElementById('companies');
    wrap.innerHTML = '';
    if (companies.length) {
      companies.forEach((c) => wrap.appendChild(companyBlock(c)));
      status.textContent = companies.length + '개 기업 불러옴 (수정 후 저장 시 덮어쓰기)';
    } else {
      wrap.appendChild(companyBlock());
      status.textContent = '해당 날짜 데이터 없음 (새로 입력)';
    }
  } catch (e) {
    status.textContent = '불러오기 실패: ' + (e.status || e.message);
  } finally {
    btn.disabled = false;
  }
}

/* ===== 저장 (수동 입력 → draft, 검수·배포 동일 흐름) ===== */
async function save() {
  const date = document.getElementById('reportDate').value;
  const status = document.getElementById('saveStatus');
  const btn = document.getElementById('saveBtn');
  if (!date) {
    status.textContent = '날짜를 선택하세요.';
    status.style.color = '#dc2626';
    return;
  }
  const companies = collect();
  if (!companies.length) {
    status.textContent = '입력된 기업이 없습니다.';
    status.style.color = '#dc2626';
    return;
  }
  btn.disabled = true;
  status.style.color = '#111';
  status.textContent = 'draft 저장 중…';
  try {
    const res = await API.devCreateDrafts(date, companies);
    status.style.color = '#7ba500';
    status.textContent = 'draft ' + res.count + '건 저장 — 검수·배포 탭에서 배포하세요 (라이브 미반영)';
    toast('draft ' + res.count + '건 저장 (라이브 미반영)', true);
    showTab('review');
  } catch (e) {
    if (e.status === 403) {
      // PIN 무효화 → 게이트 재노출
      adminPin = '';
      sessionStorage.removeItem('adminPin');
      localStorage.removeItem('devPin');
      showGate(true);
      return;
    }
    status.style.color = '#dc2626';
    status.textContent = '저장 실패: ' + (e.data && e.data.error ? e.data.error : e.status || e.message);
    toast('저장 실패', false);
  } finally {
    btn.disabled = false;
  }
}

/* ===== 게이트 / 초기화 ===== */
function showGate(err) {
  document.getElementById('editor').classList.add('hidden');
  document.getElementById('gate').classList.remove('hidden');
  document.getElementById('gateErr').classList.toggle('hidden', !err);
  document.getElementById('pinInput').value = '';
  document.getElementById('pinInput').focus();
}

function showEditor() {
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('editor').classList.remove('hidden');
  const dateInput = document.getElementById('reportDate');
  if (!dateInput.value) dateInput.value = todayYmd();
  const wrap = document.getElementById('companies');
  if (!wrap.children.length) wrap.appendChild(companyBlock());
  showTab('imp'); // 기본 탭 = 가져오기(흐름 시작점). 검수 대기 수는 배지로 표시.
  loadReview(); // 탭 배지(미배포 건수) 갱신
}

function init() {
  // 게이트: 입력 → 메모리/세션 보관 후 에디터 노출 (검증은 저장 시 서버에서)
  document.getElementById('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('pinInput').value.trim();
    if (!pin) return;
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    // PIN 즉시 검증(PIN 보호 엔드포인트 호출) — 403이면 게이트 유지
    try {
      await API.companyMetaList(pin);
    } catch (err) {
      if (btn) btn.disabled = false;
      if (err.status === 403) { showGate(true); return; }
      // 기타(일시 오류 등)는 막지 않고 통과
    }
    if (btn) btn.disabled = false;
    adminPin = pin;
    sessionStorage.setItem('adminPin', pin);
    localStorage.setItem('devPin', pin); // 검수·배포(draft API)·/preview 공용
    showEditor();
  });

  document.getElementById('addCompany').addEventListener('click', () =>
    document.getElementById('companies').appendChild(companyBlock())
  );
  document.getElementById('loadBtn').addEventListener('click', loadExisting);
  document.getElementById('saveBtn').addEventListener('click', save);

  // 탭: 검수·배포 / 가져오기 / DART / 의견함 / 수동 입력 / 설정
  document.getElementById('tabReviewBtn').addEventListener('click', () => showTab('review'));
  document.getElementById('tabImportBtn').addEventListener('click', () => showTab('imp'));
  document.getElementById('tabReportBtn').addEventListener('click', () => showTab('report'));
  document.getElementById('tabSuggBtn').addEventListener('click', () => showTab('sugg'));
  document.getElementById('tabDartBtn').addEventListener('click', () => showTab('dart'));
  document.getElementById('tabWeeklyBtn').addEventListener('click', () => showTab('weekly'));
  document.getElementById('tabSetBtn').addEventListener('click', () => showTab('set'));
  document.getElementById('wkLoad').addEventListener('click', loadWeekly);
  document.getElementById('tabGuideBtn').addEventListener('click', () => showTab('guide'));
  // 가져오기 (데일리/히스토리)
  document.querySelectorAll('#impToggle button').forEach((b) => b.addEventListener('click', () => { impMode = b.dataset.imp; renderImpToggle(); }));
  document.getElementById('impRun').addEventListener('click', runImport);
  // 검수·배포
  document.getElementById('rvPublishAll').addEventListener('click', () => confirmPublishRv({ all: true }, '검수 목록 전체를'));
  document.getElementById('rvClearSame').addEventListener('click', clearSameRv);
  document.getElementById('suggRefresh').addEventListener('click', loadSuggestions);
  document.getElementById('dartRefresh').addEventListener('click', loadDartMappings);
  document.getElementById('pinSave').addEventListener('click', savePinned);
  document.getElementById('tagCo').addEventListener('change', renderTagChips);
  document.getElementById('tagSave').addEventListener('click', saveCompanyTags);
  document.getElementById('tagGlobalBtn').addEventListener('click', deleteTagsGlobal);

  // 세션에 PIN이 있으면 바로 에디터로 (편의용; 서버 검증은 저장 시)
  const saved = sessionStorage.getItem('adminPin');
  if (saved) {
    adminPin = saved;
    localStorage.setItem('devPin', saved); // draft API·/preview 공용
    showEditor();
  } else {
    showGate(false);
  }
}

/* ===== 탭 전환 ===== */
function showTab(which) {
  const tabs = { review: 'tab-review', imp: 'tab-import', report: 'tab-report', sugg: 'tab-suggestions', dart: 'tab-dart', weekly: 'tab-weekly', set: 'tab-settings', guide: 'tab-guide' };
  const btns = { review: 'tabReviewBtn', imp: 'tabImportBtn', report: 'tabReportBtn', sugg: 'tabSuggBtn', dart: 'tabDartBtn', weekly: 'tabWeeklyBtn', set: 'tabSetBtn', guide: 'tabGuideBtn' };
  for (const k in tabs) {
    document.getElementById(tabs[k]).classList.toggle('hidden', k !== which);
    document.getElementById(btns[k]).className = 'btn px-4 py-2 ' + (k === which ? 'bg-ink text-white' : 'border border-ink/15 hover:bg-ink hover:text-white');
  }
  if (which === 'review') loadReview();
  if (which === 'imp') renderImpToggle();
  if (which === 'sugg') loadSuggestions();
  if (which === 'dart') loadDartMappings();
  if (which === 'weekly') openWeeklyTab();
  if (which === 'set') { loadPinned(); loadTagManager(); }
}

async function loadSuggestions() {
  const list = document.getElementById('suggList');
  list.innerHTML = '<div class="text-sm opacity-50">불러오는 중…</div>';
  try {
    const rows = await API.suggestions(adminPin);
    if (!rows.length) { list.innerHTML = '<div class="text-sm opacity-50">접수된 의견이 없습니다.</div>'; return; }
    list.innerHTML = rows.map((s) =>
      '<div class="bg-white rounded-2xl border border-ink/5 shadow p-4">' +
      '<div class="flex items-center gap-2 mb-1.5"><span class="text-[11px] bg-beige border border-ink/5 rounded-full px-2 py-0.5">' + escapeHtml(s.type) + '</span>' +
      (s.company ? '<span class="text-[11px] opacity-60">' + escapeHtml(s.company) + '</span>' : '') +
      '<span class="text-[11px] opacity-40 ml-auto">' + escapeHtml(s.created_at) + '</span></div>' +
      '<div class="text-sm whitespace-pre-wrap">' + escapeHtml(s.content) + '</div>' +
      '<div class="text-xs opacity-50 mt-1.5">' + escapeHtml([s.team, s.name].filter(Boolean).join(' · ')) + '</div></div>'
    ).join('');
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    list.innerHTML = '<div class="text-sm text-red-500">불러오기 실패: ' + (e.status || e.message) + '</div>';
  }
}

/* ===== DART 연결 탭 ===== */
let DART_CORPS = null; // [{code,name,stock}]
async function loadCorps() {
  if (DART_CORPS) return DART_CORPS;
  const txt = await (await fetch('/assets/dart-corps.txt')).text();
  DART_CORPS = txt.split('\n').filter(Boolean).map((l) => {
    const i = l.indexOf('\t'), j = l.indexOf('\t', i + 1);
    return { code: l.slice(0, i), name: l.slice(i + 1, j), stock: l.slice(j + 1) };
  });
  return DART_CORPS;
}
// DART 에는 이름이 같은 법인이 여럿 있다('케이티' 상장 030200 / 비상장, '카카오' 6건).
// 이름 완전일치를 상장 여부와 무관하게 맨 위에 두면 비상장 동명 법인이 먼저 선택돼
// 재무·종목코드가 비어 보인다 — 모든 버킷에 상장 우선 정렬을 적용한다.
const listedFirst = (arr) => arr.sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.name.length - b.name.length);

function searchCorps(q) {
  q = (q || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const exact = [], starts = [], contains = [];
  for (const c of DART_CORPS) {
    const n = c.name.toLowerCase();
    if (n === q) exact.push(c);
    else if (n.startsWith(q)) starts.push(c);
    else if (n.includes(q) || (c.stock && c.stock === q)) contains.push(c);
  }
  return listedFirst(exact).concat(listedFirst(starts), listedFirst(contains)).slice(0, 12);
}

async function loadDartMappings() {
  const list = document.getElementById('dartList');
  list.innerHTML = '<div class="text-sm opacity-50">불러오는 중…</div>';
  try {
    await loadCorps();
    const [reports, metaRows] = await Promise.all([API.all().catch(() => []), API.companyMetaList(adminPin)]);
    const metaMap = {};
    (metaRows || []).forEach((m) => (metaMap[m.name] = m));
    // 미연결(corp_code 없음) 업체를 위로, 그다음 가나다순
    const connected = (n) => (metaMap[n] && metaMap[n].corp_code ? 1 : 0);
    const names = [...new Set(reports.flatMap((r) => (r.companies || []).map((c) => c.name)))]
      .sort((a, b) => connected(a) - connected(b) || a.localeCompare(b));
    if (!names.length) { list.innerHTML = '<div class="text-sm opacity-50">등록된 기업이 없습니다.</div>'; return; }
    list.innerHTML = '';
    names.forEach((n) => list.appendChild(dartRow(n, metaMap[n])));
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    list.innerHTML = '<div class="text-sm text-red-500">불러오기 실패: ' + (e.status || e.message) + '</div>';
  }
}

function dartRow(name, meta) {
  let ovCeo = '';
  if (meta && meta.overrides) { try { ovCeo = JSON.parse(meta.overrides).ceo || ''; } catch { /* skip */ } }
  // 별칭 — D1 company_meta.aliases. NULL 이면 코드의 시드 사전이 쓰이는 상태라 입력칸은 비워 둔다.
  let aliasList = null;
  if (meta && meta.aliases) { try { const j = JSON.parse(meta.aliases); if (Array.isArray(j)) aliasList = j; } catch { /* skip */ } }
  const search = el('input', { class: 'field dart-search', type: 'text', placeholder: 'DART 기업 검색 (이름/종목코드)…', autocomplete: 'off' });
  const dropdown = el('div', { class: 'dart-dd hidden absolute z-10 left-0 right-0 mt-1 bg-white border border-ink/10 rounded-xl shadow-xl max-h-56 overflow-auto' });
  const current = el('div', { class: 'text-xs mt-1' });
  const ceo = el('input', { class: 'field dart-ceo', type: 'text', placeholder: '대표자 보정(선택)', value: ovCeo });
  const alias = el('input', {
    class: 'field dart-alias', type: 'text', value: (aliasList || []).join(', '),
    placeholder: '검색 별칭, 쉼표로 구분 (예: 엔비디아, NVIDIA코리아)',
  });
  const aliasHint = el('div', {
    class: 'text-[11px] opacity-55 mt-1',
    text: aliasList
      ? '검색 별칭 — 비우고 저장하면 별칭 없음으로 처리됩니다.'
      : '검색 별칭 — 미설정(코드 기본값 사용). 입력해 저장하면 이 값이 기본값을 대체합니다.',
  });
  const status = el('span', { class: 'text-xs ml-1' });
  const saveBtn = el('button', { type: 'button', class: 'btn flex-none bg-ink text-white px-4 py-2 hover:bg-lime hover:text-ink', text: '저장' });

  const row = el('div', { class: 'bg-white rounded-2xl border border-ink/5 shadow p-4' }, [
    el('div', { class: 'font-display font-semibold mb-1', text: name }),
    current,
    el('div', { class: 'relative mt-2' }, [search, dropdown]),
    el('div', { class: 'flex items-center gap-2 mt-2' }, [ceo, saveBtn, status]),
    el('div', { class: 'mt-2 pt-2 border-t border-ink/5' }, [alias, aliasHint]),
  ]);
  row.dataset.corp = meta && meta.corp_code ? meta.corp_code : '';

  function renderCurrent() {
    const c = row.dataset.corp;
    if (c) {
      const hit = DART_CORPS.find((x) => x.code === c);
      const badge = hit && hit.stock
        ? '<span class="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-lime/25 text-lime-700 border border-lime/40">상장 ' + escapeHtml(hit.stock) + '</span>'
        : '<span class="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-ink/5 text-ink/50 border border-ink/10">비상장</span>';
      current.innerHTML = '연결됨: <b>' + escapeHtml(hit ? hit.name : '') + '</b> ' + badge +
        ' <span class="opacity-50">' + escapeHtml(c) + '</span> <button type="button" class="dart-clear text-red-500 ml-1">해제</button>';
      const clr = current.querySelector('.dart-clear');
      if (clr) clr.onclick = () => { row.dataset.corp = ''; renderCurrent(); };
    } else {
      current.innerHTML = '<span class="opacity-50">미연결 — DART 정보 미표시</span>';
    }
  }
  renderCurrent();

  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const res = searchCorps(search.value);
      if (!res.length) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; return; }
      dropdown.innerHTML = '';
      // 같은 이름이 둘 이상이면 상장 여부로 골라야 한다는 것을 먼저 알린다.
      const dupes = res.filter((c) => c.name === res[0].name).length;
      if (dupes > 1) {
        dropdown.appendChild(el('div', {
          class: 'px-3 py-2 text-[11px] bg-amber-50 text-amber-700 border-b border-amber-200',
          text: '이름이 같은 법인 ' + dupes + '건 — 상장 배지와 종목코드로 확인 후 선택하세요.',
        }));
      }
      res.forEach((c) => {
        const item = el('button', { type: 'button', class: 'block w-full text-left px-3 py-2 text-sm hover:bg-beige' });
        const badge = c.stock
          ? '<span class="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-lime/25 text-lime-700 border border-lime/40 ml-1">상장 ' + escapeHtml(c.stock) + '</span>'
          : '<span class="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-ink/5 text-ink/45 border border-ink/10 ml-1">비상장</span>';
        item.innerHTML = escapeHtml(c.name) + badge + ' <span class="opacity-45 text-xs">' + escapeHtml(c.code) + '</span>';
        item.onclick = () => { row.dataset.corp = c.code; search.value = ''; dropdown.classList.add('hidden'); renderCurrent(); };
        dropdown.appendChild(item);
      });
      dropdown.classList.remove('hidden');
    }, 180);
  });
  search.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 200));

  saveBtn.onclick = async () => {
    status.style.color = '#111';
    status.textContent = '저장 중…';
    try {
      const aliases = alias.value.split(',').map((a) => a.trim()).filter(Boolean);
      const r = await API.saveCompanyMeta(
        { name, corpCode: row.dataset.corp || '', overrides: { ceo: ceo.value.trim() }, aliases },
        adminPin
      );
      status.style.color = '#7ba500';
      // 서버가 DART 개황으로 확인한 법인명을 그대로 보여준다 — 정적 목록이 낙후돼도 실체가 드러난다.
      const v = r && r.verified;
      status.textContent = (v
        ? '저장됨 · ' + v.name + (v.stockCode ? ' (' + v.stockCode + ')' : ' (비상장)')
        : '저장됨') + ' · 별칭 ' + aliases.length + '개';
      aliasHint.textContent = '검색 별칭 — 비우고 저장하면 별칭 없음으로 처리됩니다.';
      toast(name + ' 저장' + (v ? ' → ' + v.name : '') + (aliases.length ? ' · 별칭 ' + aliases.length + '개' : ''), true);
    } catch (e) {
      if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
      status.style.color = '#dc2626';
      const code = (e.data && e.data.error) || e.status || e.message;
      status.textContent = '실패: ' + (code === 'CORP_NOT_FOUND' ? 'DART에 없는 코드입니다' : code === 'DART_UNAVAILABLE' ? 'DART 조회 실패 — 잠시 후 재시도' : code);
    }
  };
  return row;
}

/* ===== 설정 탭 (그래프 핀 태그) ===== */
async function loadPinned() {
  const input = document.getElementById('pinTags');
  const status = document.getElementById('pinStatus');
  status.textContent = '';
  try {
    const tags = await API.pinnedTags();
    input.value = (Array.isArray(tags) ? tags : []).join(', ');
  } catch {
    status.textContent = '핀 목록을 불러오지 못했습니다.';
    status.style.color = '#dc2626';
  }
}

async function savePinned() {
  const input = document.getElementById('pinTags');
  const status = document.getElementById('pinStatus');
  const tags = input.value.split(',').map((t) => t.trim()).filter(Boolean);
  status.style.color = '#111';
  status.textContent = '저장 중…';
  try {
    const res = await API.savePinnedTags(tags, adminPin);
    input.value = (res.tags || []).join(', ');
    status.style.color = '#7ba500';
    status.textContent = '저장됨 (' + (res.tags || []).length + '개)';
    toast('핀 태그 저장 — 홈 그래프에 즉시 반영', true);
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    status.style.color = '#dc2626';
    status.textContent = '저장 실패: ' + ((e.data && e.data.error) || e.status || e.message);
  }
}

/* ===== 설정 탭 (기업별/전역 태그 관리) ===== */
let TAG_UNION = {}; // 기업명 -> 태그 배열(전체 항목 합집합)
let tagRemoved = new Set(); // 현재 선택 기업에서 삭제 표시된 태그

async function loadTagManager() {
  const sel = document.getElementById('tagCo');
  try {
    const reports = await API.all();
    TAG_UNION = {};
    reports.forEach((r) => (r.companies || []).forEach((c) => {
      if (!c || !c.name) return;
      const s = (TAG_UNION[c.name] = TAG_UNION[c.name] || new Set());
      (c.tags || []).forEach((t) => s.add(t));
    }));
    const names = Object.keys(TAG_UNION).sort((a, b) => a.localeCompare(b));
    const cur = sel.value;
    sel.innerHTML = names.map((n) => '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>').join('');
    if (cur && names.includes(cur)) sel.value = cur;
    renderTagChips();
  } catch {
    sel.innerHTML = '<option>불러오기 실패</option>';
  }
}

function renderTagChips() {
  tagRemoved = new Set();
  document.getElementById('tagAdd').value = '';
  document.getElementById('tagStatus').textContent = '';
  drawTagChips();
}

function drawTagChips() {
  const name = document.getElementById('tagCo').value;
  const box = document.getElementById('tagChips');
  const tags = TAG_UNION[name] ? [...TAG_UNION[name]].sort((a, b) => a.localeCompare(b)) : [];
  if (!tags.length) { box.innerHTML = '<span class="text-xs opacity-50">태그 없음</span>'; return; }
  box.innerHTML = tags.map((t) => {
    const off = tagRemoved.has(t);
    return '<button type="button" data-t="' + escapeHtml(t) + '" class="tagm text-xs rounded-full px-2.5 py-1 border ' +
      (off ? 'line-through bg-red-50 border-red-300 text-red-500' : 'bg-beige border-ink/5 hover:border-red-300') + '">#' + escapeHtml(t) + (off ? ' ✕' : '') + '</button>';
  }).join('');
  box.querySelectorAll('.tagm').forEach((b) => b.onclick = () => {
    const t = b.dataset.t;
    if (tagRemoved.has(t)) tagRemoved.delete(t); else tagRemoved.add(t);
    drawTagChips();
  });
}

// 변경된 날짜들을 순차 재색인(기존 저장 API 재사용: GET→그대로 POST)
async function reindexDates(dates, statusEl) {
  for (let i = 0; i < dates.length; i++) {
    statusEl.textContent = '재색인 중 ' + (i + 1) + '/' + dates.length + '…';
    try {
      const companies = await API.report(dates[i]);
      await API.save(dates[i], companies, adminPin);
    } catch { /* 한 날짜 실패해도 계속 */ }
  }
}

async function saveCompanyTags() {
  const name = document.getElementById('tagCo').value;
  const status = document.getElementById('tagStatus');
  const add = document.getElementById('tagAdd').value.split(',').map((t) => t.trim()).filter(Boolean);
  const remove = [...tagRemoved];
  if (!name || (!add.length && !remove.length)) { status.textContent = '변경 없음'; return; }
  status.style.color = '#111';
  status.textContent = '저장 중…';
  try {
    const res = await API.manageTags({ name, remove, add }, adminPin);
    await reindexDates(res.affectedDates || [], status);
    const dates = (res.affectedDates || []).length;
    if (!dates) {
      status.style.color = '#dc2626';
      status.textContent = '변경된 항목 없음 — 태그가 정확히 일치하지 않았습니다';
      toast(name + ' 태그 변경 없음', false);
    } else {
      status.style.color = '#7ba500';
      status.textContent = '완료 (삭제 ' + (res.removed || 0) + ' / 추가 ' + (res.added || 0) + ', ' + dates + '개 날짜 반영)';
      toast(name + ' 태그 변경 완료', true);
    }
    await loadTagManager();
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    status.style.color = '#dc2626';
    status.textContent = '실패: ' + ((e.data && e.data.error) || e.status || e.message);
  }
}

async function deleteTagsGlobal() {
  const input = document.getElementById('tagGlobalDel');
  const status = document.getElementById('tagGlobalStatus');
  const remove = input.value.split(',').map((t) => t.trim()).filter(Boolean);
  if (!remove.length) { status.textContent = '태그를 입력하세요'; return; }
  if (!confirm('태그 [' + remove.join(', ') + '] 를 모든 기업·날짜 데이터에서 삭제합니다. 계속할까요?')) return;
  status.style.color = '#111';
  status.textContent = '삭제 중…';
  try {
    const res = await API.manageTags({ remove }, adminPin);
    await reindexDates(res.affectedDates || [], status);
    const dates = (res.affectedDates || []).length;
    if (!dates) {
      status.style.color = '#dc2626';
      status.textContent = '변경된 항목 없음 — 입력한 태그가 데이터의 태그와 정확히 일치하지 않습니다';
      toast('태그 전역 삭제 — 일치 항목 없음', false);
    } else {
      status.style.color = '#7ba500';
      status.textContent = '완료 (' + (res.removed || 0) + '건 삭제, ' + dates + '개 날짜 반영)';
      input.value = '';
      toast('태그 전역 삭제 완료', true);
    }
    await loadTagManager();
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    status.style.color = '#dc2626';
    status.textContent = '실패: ' + ((e.data && e.data.error) || e.status || e.message);
  }
}

/* ===== 가져오기 탭 (데일리/히스토리 → draft) ===== */
let impMode = 'daily';
const IMP_HINT = {
  daily: '데일리: "AX 플랫폼 주요 경쟁사 사업동향 [YYMMDD]" 페이지 — 섹션 A(상위 보고용)를 AI가 기업별로 추출합니다. (1날짜 × N기업, 추출 결과는 검수에서 보정)',
  history: '히스토리: "AX 동향 히스토리 - 기업 (연도)" 페이지 — 타임라인 표를 그대로 파싱합니다. (1기업 × N날짜)',
};
function renderImpToggle() {
  document.querySelectorAll('#impToggle button').forEach((b) => {
    b.className = 'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ' +
      (b.dataset.imp === impMode ? 'bg-ink text-lime' : 'text-ink/60 hover:text-ink');
  });
  document.getElementById('impHint').textContent = IMP_HINT[impMode];
}
async function runImport() {
  const url = document.getElementById('impUrl').value.trim();
  const status = document.getElementById('impStatus');
  const btn = document.getElementById('impRun');
  if (!url) { status.textContent = 'URL을 입력하세요.'; return; }
  btn.disabled = true;
  status.style.color = '#111';
  status.textContent = (impMode === 'daily' ? 'AI 추출 중… (수십 초 걸릴 수 있음)' : '표 파싱 중…');
  try {
    const d = impMode === 'daily' ? await API.devImportDaily(url) : await API.devImport(url);
    status.style.color = '#7ba500';
    status.textContent = '✓ draft ' + d.count + '건 적재' +
      (impMode === 'daily' ? ' (' + escapeHtml(d.date || '') + ' · ' + (d.companies || []).map(escapeHtml).join(', ') + ')' : ' (' + escapeHtml(d.name || '') + ')') +
      ' — 검수·배포 탭에서 확인하세요';
    document.getElementById('impUrl').value = '';
    toast('draft ' + d.count + '건 가져옴 (라이브 미반영)', true);
    showTab('review');
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); localStorage.removeItem('devPin'); showGate(true); return; }
    status.style.color = '#dc2626';
    status.textContent = '실패: ' + ((e.data && (e.data.hint || e.data.error)) || e.status || e.message);
  } finally {
    btn.disabled = false;
  }
}

/* ===== 검수·배포 탭 ===== */
const RV_DIFF = { 'new': ['신규', 'bg-lime/30 text-lime-700'], 'replace': ['교체', 'bg-amber-100 text-amber-700'], 'same': ['동일', 'bg-ink/10 text-ink/45'] };
const RV_CATS = ['대기업', '중견기업', '스타트업·중소'];
let RV_DRAFTS = [];

async function loadReview() {
  try {
    const res = await API.devDrafts();
    RV_DRAFTS = res.drafts || [];
    const n = RV_DRAFTS.length;
    document.getElementById('rvCounts').textContent = 'draft ' + n + '건 · 신규 ' + RV_DRAFTS.filter(d => d.diff === 'new').length +
      ' · 교체 ' + RV_DRAFTS.filter(d => d.diff === 'replace').length + ' · 동일 ' + RV_DRAFTS.filter(d => d.diff === 'same').length;
    const cnt = document.getElementById('tabReviewCnt');
    cnt.classList.toggle('hidden', !n);
    cnt.textContent = n;
    const sameN = RV_DRAFTS.filter(d => d.diff === 'same').length;
    const cs = document.getElementById('rvClearSame');
    if (sameN) { cs.classList.remove('hidden'); cs.textContent = '동일 ' + sameN + '건 정리'; } else cs.classList.add('hidden');
    renderReview();
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); localStorage.removeItem('devPin'); showGate(true); }
  }
}
function rvSect(label, arr) {
  return (arr && arr.length)
    ? '<div><span class="label">' + label + '</span><ul class="list-disc pl-5 opacity-85 text-sm">' + arr.map(t => '<li>' + escapeHtml(t) + '</li>').join('') + '</ul></div>'
    : '';
}
function rvCard(x) {
  const [bt, bc] = RV_DIFF[x.diff] || RV_DIFF['new'];
  const d = x.data || {};
  const dart = !x.dartLinked
    ? '<button type="button" class="rv-dart text-[11px] font-bold rounded-full px-2 py-0.5 bg-red-50 text-red-500 border border-red-200 hover:bg-red-100" title="DART 연결 탭으로 이동 (재무 표시용 1회 매핑)">DART 미연결</button>'
    : '';
  return '<div class="bg-white rounded-2xl border border-ink/5 shadow p-5" data-rvid="' + x.id + '">' +
    '<div class="flex items-center gap-2 flex-wrap mb-2">' +
      '<span class="text-[11px] font-bold rounded-full px-2 py-0.5 ' + bc + '">' + bt + '</span>' +
      '<span class="font-display font-bold">' + escapeHtml(x.company) + '</span>' +
      '<span class="text-[10px] font-semibold bg-beige rounded-full px-2 py-0.5">' + escapeHtml(x.category || '') + '</span>' +
      dart +
      '<span class="text-[10px] opacity-45 ml-auto">' + escapeHtml(x.source === 'daily' ? '데일리' : '히스토리') + ' · ' + escapeHtml(x.date) + '</span></div>' +
    (d.summary ? '<p class="text-sm font-semibold mb-2">' + escapeHtml(d.summary) + '</p>' : '') +
    '<div class="space-y-1.5">' + rvSect('주요 내용', d.keyPoints) + rvSect('시사점', d.implications) + rvSect('한컴 인사이트', d.hancomInsight) + '</div>' +
    '<div class="flex flex-wrap gap-1.5 mt-2">' + (d.tags || []).map(t => '<span class="text-xs bg-beige border border-ink/5 rounded-full px-2.5 py-0.5">#' + escapeHtml(t) + '</span>').join('') + '</div>' +
    '<div class="flex items-center gap-2 mt-4 pt-3 border-t border-ink/5">' +
      '<button class="btn text-xs border border-ink/15 px-3 py-1.5 hover:bg-beige" data-rvact="edit">편집</button>' +
      '<button class="btn text-xs border border-ink/15 px-3 py-1.5 hover:bg-red-500 hover:text-white hover:border-red-500" data-rvact="del">삭제</button>' +
      '<button class="btn text-xs bg-ink text-white px-4 py-1.5 ml-auto hover:bg-lime hover:text-ink" data-rvact="pub">이 건 배포</button>' +
    '</div></div>';
}
function renderReview() {
  const byDate = {};
  RV_DRAFTS.forEach(x => (byDate[x.date] = byDate[x.date] || []).push(x));
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  document.getElementById('rvEmpty').classList.toggle('hidden', RV_DRAFTS.length > 0);
  const list = document.getElementById('rvList');
  list.innerHTML = dates.map(dt =>
    '<div><div class="flex items-center gap-3 mb-2"><div class="font-display font-bold text-lg">' + dt + '</div><div class="h-px flex-1 bg-ink/10"></div>' +
    '<button class="btn text-xs bg-beige px-3 py-1.5 hover:bg-lime" data-rvpubdate="' + dt + '">이 날짜 배포</button></div>' +
    '<div class="space-y-3">' + byDate[dt].map(rvCard).join('') + '</div></div>').join('');
  list.querySelectorAll('[data-rvpubdate]').forEach(b => b.onclick = () => confirmPublishRv({ dates: [b.getAttribute('data-rvpubdate')] }, b.getAttribute('data-rvpubdate') + ' 날짜를'));
  list.querySelectorAll('.rv-dart').forEach(b => b.onclick = () => showTab('dart'));
  list.querySelectorAll('[data-rvid]').forEach(card => {
    const id = +card.getAttribute('data-rvid');
    card.querySelector('[data-rvact="del"]').onclick = async () => { try { await API.devDeleteDraft(id); toast('삭제됨', true); loadReview(); } catch { toast('삭제 실패', false); } };
    card.querySelector('[data-rvact="pub"]').onclick = () => confirmPublishRv({ ids: [id] }, '이 1건을');
    card.querySelector('[data-rvact="edit"]').onclick = () => openEditDraft(card, id);
  });
}
function openEditDraft(card, id) {
  const x = RV_DRAFTS.find(d => d.id === id); if (!x) return; const d = x.data || {};
  const ta = (v) => escapeHtml((v || []).join('\n'));
  card.innerHTML = '<div class="space-y-2">' +
    '<div class="flex items-center gap-2"><b class="font-display">' + escapeHtml(x.company) + '</b><span class="text-xs opacity-55">' + escapeHtml(x.date) + '</span>' +
      '<select class="field !w-auto ml-auto text-xs py-1" data-rvf="category">' + RV_CATS.map(c => '<option ' + (c === x.category ? 'selected' : '') + '>' + c + '</option>').join('') + '</select></div>' +
    '<div><span class="label">한 줄 요약</span><input class="field" data-rvf="summary" value="' + escapeHtml(d.summary || '') + '"></div>' +
    '<div><span class="label">주요 내용 (줄당 1개)</span><textarea class="field" rows="3" data-rvf="keyPoints">' + ta(d.keyPoints) + '</textarea></div>' +
    '<div><span class="label">시사점</span><textarea class="field" rows="2" data-rvf="implications">' + ta(d.implications) + '</textarea></div>' +
    '<div><span class="label">한컴 인사이트</span><textarea class="field" rows="2" data-rvf="hancomInsight">' + ta(d.hancomInsight) + '</textarea></div>' +
    '<div><span class="label">태그 (쉼표)</span><input class="field" data-rvf="tags" value="' + escapeHtml((d.tags || []).join(', ')) + '"></div>' +
    '<div class="flex gap-2 pt-1"><button class="btn text-xs bg-ink text-white px-4 py-1.5" data-rvsave>저장</button><button class="btn text-xs border border-ink/15 px-3 py-1.5 hover:bg-beige" data-rvcancel>취소</button></div>' +
  '</div>';
  const g = (f) => card.querySelector('[data-rvf="' + f + '"]').value;
  const lines = (f) => g(f).split('\n').map(s => s.trim()).filter(Boolean);
  card.querySelector('[data-rvcancel]').onclick = () => renderReview();
  card.querySelector('[data-rvsave]').onclick = async () => {
    try {
      await API.devUpdateDraft(id, { summary: g('summary'), category: g('category'), keyPoints: lines('keyPoints'), implications: lines('implications'), hancomInsight: lines('hancomInsight'), tags: g('tags').split(',').map(s => s.trim()).filter(Boolean) });
      toast('저장됨', true); loadReview();
    } catch { toast('저장 실패', false); }
  };
}
function confirmPublishRv(payload, label) {
  if (!confirm(label + ' 라이브에 배포할까요?\n배포하면 본 사이트에 즉시 반영되고 같은 (날짜·기업) 항목은 교체됩니다.')) return;
  API.devPublish(payload).then(r => { toast((r.publishedIds ? r.publishedIds.length : 0) + '건 배포됨 → 라이브 반영', true); loadReview(); })
    .catch(e => toast('배포 실패: ' + (e.status || e.message), false));
}
async function clearSameRv() {
  const ids = RV_DRAFTS.filter(d => d.diff === 'same').map(d => d.id);
  if (!ids.length) return;
  if (!confirm('동일(변경 없음) ' + ids.length + '건을 검수 목록에서 삭제할까요?\n라이브엔 영향이 없습니다(draft만 정리).')) return;
  for (const id of ids) { try { await API.devDeleteDraft(id); } catch { /* 계속 */ } }
  toast(ids.length + '건 정리됨', true); loadReview();
}

/* ===== 위클리 픽 탭 =====
   그 주 동향에서 3~5건을 골라 「주목(Pick) 이유」를 쓰고 발행한다.
   선별과 이유는 사람이 쓴다(AI 초안은 빈 칸을 메우는 보조). 수치는 서버가 집계한다.
   발행하면 그 시점 내용이 payload 에 고정되므로 이미 공유한 링크의 내용은 바뀌지 않는다. */
// 픽 수는 제한하지 않는다(2026-08-24 사용자 지시) — 그 주에 주목할 것이 많으면 많이 싣는다.
// 서버 MAX_PICKS(50)는 폭주 방지용 상한이며 편집 기준이 아니다.
let WK = null;      // 서버 초안 상태 {week,start,end,label,status,issueNo,stats,candidates,payload}
let WK_PICKS = [];  // 선택 항목(순서 유지) [{key,title,why}]

const wkStatusLabel = (s) => (s === 'published' ? '발행됨' : s === 'draft' ? '초안 저장됨' : '아직 만들지 않음');

// 서버가 두 번 받아 봐도 「축」 표현이 남은 경우. 무엇으로 바꿀지는 문맥마다 달라
// 기계가 정할 수 없으므로 사람에게 넘긴다(CLAUDE.md 금지 표현).
function wkWarnAxis(warn) {
  if (warn === 'AXIS_WORD') toast('AI 초안에 금지 표현 「축」이 남아 있습니다. 경쟁 지점·비교 기준·차별화 요소로 직접 고쳐 주세요', false);
}
const wkCand = (key) => (WK && WK.candidates ? WK.candidates.find((c) => c.key === key) : null);

function openWeeklyTab() {
  const inp = document.getElementById('wkDate');
  if (!inp.value) inp.value = todayYmd();
  if (!WK) loadWeekly();
}

async function loadWeekly() {
  const box = document.getElementById('wkEditor');
  const meta = document.getElementById('wkMeta');
  const picked = document.getElementById('wkDate').value || todayYmd();
  box.innerHTML = '<div class="text-sm opacity-50">불러오는 중…</div>';
  try {
    WK = await API.weeklyDraft(picked, adminPin);
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    WK = null;
    box.innerHTML = '<div class="text-sm text-red-500">불러오기 실패: ' + (e.status || e.message) + '</div>';
    return;
  }
  // 저장된 선택 복원. 원본이 지워졌거나 출처 URL 이 바뀌면 후보와 짝이 맞지 않으므로 알리고 뺀다.
  const saved = (WK.payload && WK.payload.picks) || [];
  WK_PICKS = saved.filter((p) => wkCand(p.key)).map((p) => ({ key: p.key, title: p.title || '', why: p.why || '', image: p.image || null }));
  if (saved.length !== WK_PICKS.length) toast('원본이 바뀐 ' + (saved.length - WK_PICKS.length) + '건은 선택에서 빠졌습니다. 다시 골라 주세요', false);
  meta.textContent = WK.label + ' · ' + WK.start + ' ~ ' + WK.end + ' · 동향 ' + (WK.stats.total || 0) + '건 · ' + wkStatusLabel(WK.status);
  renderWeekly();
}

/* --- 렌더 --- */
function wkNumbersHTML(s) {
  const kw = (s.topTags || []).map((t) => '#' + t.tag + (t.isNew ? '(NEW)' : '')).join(' ');
  return '<div class="text-sm">동향 <b>' + (s.total || 0) + '</b>건 · 기업 <b>' + (s.companies || 0) + '</b>곳 · 신규 기업 <b>' +
    (s.newCompanies || []).length + '</b>곳 · 데이터 있는 날 <b>' + (s.daysWithData || 0) + '</b>일</div>' +
    (kw ? '<div class="text-xs opacity-60 mt-1.5">키워드 ' + escapeHtml(kw) + '</div>' : '') +
    ((s.newCompanies || []).length ? '<div class="text-xs opacity-60 mt-1">신규 편입 기업 ' + escapeHtml(s.newCompanies.join(', ')) + '</div>' : '');
}

/* 신호 칩 — 숫자 하나로는 왜 위에 올라왔는지 알 수 없어 신호 이름을 그대로 보여 준다.
   선별은 사람이 하고 이 칩은 「먼저 볼 만한 것」 표시일 뿐이다. 뜻은 title 로 붙인다. */
const WK_SIGNAL_HINT = {
  신규기업: '이번에 처음 레이더에 들어온 기업',
  새영역: '추적 중인 기업이 지금까지 다루지 않던 주제로 움직임',
  공통주제: '이 주에 3곳 이상이 같은 주제로 움직임',
  신규주제: '이력에 없던 주제가 이 주에 2건 이상 등장',
};
// 기업 축(신규기업·새영역)은 라임으로 띄우고 주제 축은 회색으로 둔다 — 정렬 가중치와 같은 위계.
const wkSignalChip = (s) =>
  '<span class="text-[10px] font-bold rounded-full px-2 py-0.5 ' +
  (s === '신규기업' || s === '새영역' ? 'bg-lime text-ink' : 'bg-ink/8 text-ink/55') +
  '" title="' + escapeHtml(WK_SIGNAL_HINT[s] || '') + '">' + escapeHtml(s) + '</span>';

function wkRowHTML(c) {
  const on = WK_PICKS.some((p) => p.key === c.key);
  return '<label class="flex items-start gap-3 py-2.5 cursor-pointer hover:bg-beige/60 px-1 rounded-lg">' +
    '<input type="checkbox" class="wk-cb mt-1 flex-none accent-lime-600 w-4 h-4" data-key="' + escapeHtml(c.key) + '"' + (on ? ' checked' : '') + ' />' +
    '<span class="min-w-0 flex-1">' +
    '<span class="flex items-baseline flex-wrap gap-x-2 gap-y-1">' +
    '<b class="text-sm">' + escapeHtml(c.company) + '</b>' +
    '<span class="text-[11px] opacity-45">' + escapeHtml(c.date) + '</span>' +
    (c.signals || []).map(wkSignalChip).join('') +
    '</span>' +
    '<span class="block text-xs opacity-65 truncate">' + escapeHtml(c.title || (c.keyPoints || [])[0] || '') + '</span>' +
    '</span></label>';
}

/* 픽 이미지 — 선택 입력이다. 올리면 사진이 실리고, 안 올리면 활자 판으로 나간다.
   매주 올려야 하는 의무로 만들지 않기 위한 것이다(2026-08-24 사용자 지시).
   기사 사진을 내려받아 올리는 것은 링크가 아니라 복제라 위험이 더 크다. 그래서 출처·권리
   근거를 필수로 받고, 비면 서버가 이미지를 버린다(functions/api/weekly.js sanitizeImage). */
const WK_IMG_POS = [['top', '위'], ['center', '가운데'], ['bottom', '아래']];

function wkImageHTML(p) {
  const img = p.image || null;
  const pos = (img && img.pos) || 'center';

  let h = '<div class="mt-4 pt-4 border-t border-ink/8">' +
    '<div class="flex items-center justify-between mb-2">' +
    '<div class="label normal-case">이미지 <span class="font-normal opacity-45">선택 · 안 올리면 활자 판으로 나갑니다</span></div>' +
    (img ? '<button type="button" class="wk-img-del text-xs font-semibold text-red-600 hover:text-ink">이미지 빼기</button>' : '') +
    '</div>';

  if (img) {
    h += '<div class="flex flex-wrap gap-3">' +
      // 미리보기는 실제 판 비율(620×260)을 줄인 것이다. 여기서 잘려 보이는 대로 페이지에서도 잘린다.
      '<div class="w-[248px] h-[104px] flex-none overflow-hidden bg-beige border border-ink/10">' +
      '<img class="wk-img-prev w-full h-full object-cover" style="object-position:' + pos + '" ' +
      'src="/api/pick-image?k=' + encodeURIComponent(img.key) + '" alt="" /></div>' +
      '<div class="min-w-0 flex-1 basis-[260px]">' +
      '<div class="label normal-case mb-1">출처·권리 근거 <span class="text-red-500">필수</span></div>' +
      '<input class="field wk-img-credit" maxlength="200" value="' + escapeHtml(img.credit || '') + '" ' +
      'placeholder="예: 한컴 제공 / 과기정통부 보도자료(공공누리 1유형) / 직접 작성" />' +
      '<div class="flex items-center gap-1.5 mt-2">' +
      '<span class="text-[11px] opacity-45 mr-1">잘리는 기준</span>' +
      WK_IMG_POS.map(([v, label]) =>
        '<button type="button" class="wk-img-pos text-[11px] font-semibold rounded-full px-2.5 py-1 ' +
        (v === pos ? 'bg-lime text-ink' : 'bg-ink/8 hover:bg-ink/15') + '" data-pos="' + v + '">' + label + '</button>').join('') +
      '</div>' +
      '<div class="wk-img-warn text-[11px] mt-1.5"></div>' +
      '</div></div>';
  }

  h += '<div class="' + (img ? 'mt-3' : '') + ' flex flex-wrap items-center gap-2">' +
    '<label class="btn border border-ink/15 px-4 py-2 text-xs hover:bg-ink hover:text-white cursor-pointer">' +
    (img ? '다른 파일로 교체' : '파일 선택') +
    '<input type="file" class="wk-img-file hidden" accept="image/jpeg,image/png,image/webp" /></label>' +
    '<span class="wk-img-msg text-[11px] opacity-45">JPG·PNG·WebP · 5MB 이하 · 1240×520 이상 권장</span>' +
    '</div></div>';
  return h;
}

function wkPickHTML(p, i) {
  const c = wkCand(p.key) || {};
  const why = p.why || '';
  return '<div class="bg-white rounded-2xl border border-ink/5 shadow p-5" data-wk-pick="' + i + '">' +
    '<div class="flex items-center gap-2 mb-3">' +
    '<span class="font-display font-bold text-lime-600">' + (i + 1) + '</span>' +
    '<b class="text-sm">' + escapeHtml(c.company || '') + '</b>' +
    '<span class="text-[11px] opacity-45">' + escapeHtml(c.date || '') + '</span>' +
    '<span class="ml-auto flex gap-1">' +
    '<button type="button" class="wk-up btn border border-ink/15 px-2.5 py-1 text-xs hover:bg-ink hover:text-white" aria-label="위로">▲</button>' +
    '<button type="button" class="wk-down btn border border-ink/15 px-2.5 py-1 text-xs hover:bg-ink hover:text-white" aria-label="아래로">▼</button>' +
    '<button type="button" class="wk-del btn border border-red-300 text-red-600 px-2.5 py-1 text-xs hover:bg-red-500 hover:text-white hover:border-red-500">빼기</button>' +
    '</span></div>' +
    '<div class="label mb-1.5">제목 (한 줄)</div>' +
    '<input class="field wk-title" maxlength="300" value="' + escapeHtml(p.title || '') + '" />' +
    '<div class="flex items-center justify-between mt-3 mb-1.5">' +
    '<div class="label normal-case">주목(Pick) 이유 <span class="text-red-500">필수</span> · 60~140자</div>' +
    '<button type="button" class="wk-ai text-xs font-semibold text-lime-600 hover:text-ink">AI 초안</button></div>' +
    '<textarea class="field wk-why" rows="2" maxlength="300">' + escapeHtml(why) + '</textarea>' +
    '<div class="text-[11px] opacity-45 mt-1"><span class="wk-len">' + why.length + '</span>자</div>' +
    wkImageHTML(p) +
    '</div>';
}

function renderWeekly() {
  const box = document.getElementById('wkEditor');
  if (!WK) { box.innerHTML = ''; return; }
  const s = WK.stats || {}, p = WK.payload || {};
  const pub = WK.status === 'published';

  let h = '<div class="bg-white rounded-2xl border border-ink/5 shadow p-5 mb-5">' +
    '<div class="flex flex-wrap items-end gap-5">' +
    '<div><div class="label mb-1.5">회차</div><div class="flex items-baseline gap-1">' +
    '<input id="wkIssue" type="number" min="1" class="field max-w-[90px]" value="' + (WK.issueNo || '') + '" /><span class="text-sm">호</span></div></div>' +
    '<div class="flex-1 min-w-[240px]">' + wkNumbersHTML(s) + '</div>' +
    '<span class="text-xs font-bold rounded-full px-3 py-1 ' + (pub ? 'bg-lime text-ink' : 'bg-beige border border-ink/10') + '">' + wkStatusLabel(WK.status) + '</span>' +
    '</div></div>';

  h += '<div class="bg-white rounded-2xl border border-ink/5 shadow p-5 mb-5">' +
    '<div class="flex items-baseline justify-between mb-3">' +
    '<div class="label">이 주 동향 ' + (WK.candidates || []).length + '건 — 주목할 것 선택 (건별)</div>' +
    '<span id="wkSelCnt" class="text-xs font-semibold">' + WK_PICKS.length + '건 선택</span></div>' +
    ((WK.candidates || []).length
      ? '<div class="divide-y divide-ink/5 max-h-[420px] overflow-y-auto">' + WK.candidates.map(wkRowHTML).join('') + '</div>'
      : '<div class="text-sm opacity-50 py-6 text-center">이 주에는 발행된 동향이 없습니다</div>') +
    '</div>';

  if (WK_PICKS.length) {
    h += '<div class="label mb-2">선택한 ' + WK_PICKS.length + '건</div>' +
      '<div class="space-y-3 mb-5">' + WK_PICKS.map(wkPickHTML).join('') + '</div>';
  }

  h += '<div class="bg-white rounded-2xl border border-ink/5 shadow p-5">' +
    '<div class="flex items-center justify-between mb-1.5"><div class="label">금주 한 줄 요약</div>' +
    '<button type="button" id="wkAiOverview" class="text-xs font-semibold text-lime-600 hover:text-ink">AI 초안</button></div>' +
    '<textarea id="wkOverview" class="field" rows="2" maxlength="400">' + escapeHtml(p.overview || '') + '</textarea>' +
    '<div class="flex items-center justify-between mt-4 mb-1.5"><div class="label">한컴 관점 · 한 줄 = 불릿 1개 (2~3개)</div>' +
    '<button type="button" id="wkAiConclusion" class="text-xs font-semibold text-lime-600 hover:text-ink">AI 초안</button></div>' +
    '<textarea id="wkConclusion" class="field" rows="4" placeholder="한 줄에 하나씩">' + escapeHtml((p.hancomConclusion || []).join('\n')) + '</textarea>' +
    '</div>';

  h += '<div class="flex flex-wrap items-center gap-3 mt-5 pt-5 border-t border-ink/10">' +
    '<button type="button" id="wkSave" class="btn bg-ink text-white px-6 py-2.5 hover:bg-lime hover:text-ink">저장</button>' +
    '<button type="button" id="wkPreviewBtn" class="btn border border-ink/15 px-5 py-2.5 hover:bg-ink hover:text-white">미리보기 ↗</button>' +
    // 같은 초안을 슬라이드로 넘겨 보는 별개 페이지. 사진을 올렸으면 여기서 사진 판이 보인다.
    '<button type="button" id="wkPreviewNews" class="btn border border-ink/15 px-5 py-2.5 hover:bg-ink hover:text-white">뉴스레터 미리보기 ↗</button>' +
    '<button type="button" id="wkPublish" class="btn bg-lime text-ink px-6 py-2.5 hover:bg-ink hover:text-lime">' + (pub ? '다시 발행' : '발행') + '</button>' +
    // 공유 텍스트 복사는 없앴다(2026-08-24 사용자 지시) — 공유는 웹훅 메시지 하나로 한다.
    (pub ? '<button type="button" id="wkNotify" class="btn border border-ink/15 px-5 py-2.5 hover:bg-ink hover:text-white">메시지 보내기</button>' +
           '<button type="button" id="wkUnpublish" class="btn border border-red-300 text-red-600 px-4 py-2.5 hover:bg-red-500 hover:text-white hover:border-red-500">발행 회수</button>' : '') +
    '<span id="wkStatus" class="text-sm"></span></div>';

  box.innerHTML = h;
  wkBind();
}

/* --- DOM → 상태 (다시 그리기 전에 입력값을 잃지 않게) --- */
function wkSync() {
  document.querySelectorAll('[data-wk-pick]').forEach((node) => {
    const i = +node.getAttribute('data-wk-pick');
    if (!WK_PICKS[i]) return;
    WK_PICKS[i].title = node.querySelector('.wk-title').value;
    WK_PICKS[i].why = node.querySelector('.wk-why').value;
    // 출처 칸은 이미지가 있을 때만 그려진다. 잘리는 기준은 칩을 누를 때 이미 상태에 반영된다.
    const cr = node.querySelector('.wk-img-credit');
    if (cr && WK_PICKS[i].image) WK_PICKS[i].image.credit = cr.value;
  });
  const iss = document.getElementById('wkIssue');
  if (iss && WK) WK.issueNo = iss.value ? +iss.value : null;
  const ov = document.getElementById('wkOverview'), cc = document.getElementById('wkConclusion');
  if (WK) {
    WK.payload = WK.payload || {};
    if (ov) WK.payload.overview = ov.value;
    if (cc) WK.payload.hancomConclusion = cc.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 3);
  }
}

// 서버로 보낼 payload. 본문(주요내용·시사점·한컴 인사이트·태그·링크)은 후보에서 그대로 승계한다.
function wkPayload() {
  wkSync();
  const picks = WK_PICKS.map((p) => {
    const c = wkCand(p.key);
    if (!c) return null;
    return Object.assign({}, c, { title: p.title, why: p.why, image: p.image || null, score: undefined });
  }).filter(Boolean);
  return {
    overview: (WK.payload && WK.payload.overview) || '',
    hancomConclusion: (WK.payload && WK.payload.hancomConclusion) || [],
    picks,
  };
}

/* --- 이벤트 --- */
function wkBind() {
  const box = document.getElementById('wkEditor');

  box.querySelectorAll('.wk-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      wkSync();
      const key = cb.dataset.key;
      if (cb.checked) {
        const c = wkCand(key);
        WK_PICKS.push({ key, title: (c && c.title) || '', why: '' });
      } else {
        WK_PICKS = WK_PICKS.filter((p) => p.key !== key);
      }
      renderWeekly();
    });
  });

  box.querySelectorAll('[data-wk-pick]').forEach((node) => {
    const i = +node.getAttribute('data-wk-pick');
    const why = node.querySelector('.wk-why'), len = node.querySelector('.wk-len');
    why.addEventListener('input', () => { len.textContent = why.value.length; });
    node.querySelector('.wk-del').addEventListener('click', () => { wkSync(); WK_PICKS.splice(i, 1); renderWeekly(); });
    node.querySelector('.wk-up').addEventListener('click', () => {
      if (i === 0) return;
      wkSync(); const t = WK_PICKS[i - 1]; WK_PICKS[i - 1] = WK_PICKS[i]; WK_PICKS[i] = t; renderWeekly();
    });
    node.querySelector('.wk-down').addEventListener('click', () => {
      if (i >= WK_PICKS.length - 1) return;
      wkSync(); const t = WK_PICKS[i + 1]; WK_PICKS[i + 1] = WK_PICKS[i]; WK_PICKS[i] = t; renderWeekly();
    });
    node.querySelector('.wk-ai').addEventListener('click', async () => {
      wkSync();
      const c = wkCand(WK_PICKS[i].key);
      if (!c) return;
      if (why.value.trim() && !confirm('이미 쓴 내용을 AI 초안으로 덮어쓸까요?')) return;
      const btn = node.querySelector('.wk-ai');
      btn.textContent = '생성 중…'; btn.disabled = true;
      try {
        const r = await API.weeklyAction({ action: 'assist', kind: 'why', week: WK.week, item: Object.assign({}, c, { title: WK_PICKS[i].title }) }, adminPin);
        if (r.text) { why.value = r.text; len.textContent = r.text.length; WK_PICKS[i].why = r.text; wkWarnAxis(r.warn); }
        else toast('AI 초안을 받지 못했습니다. 직접 써 주세요', false);
      } catch (e) { toast('AI 초안 실패: ' + (e.status || e.message), false); }
      btn.textContent = 'AI 초안'; btn.disabled = false;
    });

    /* --- 이미지 --- 올리면 즉시 R2 에 올라가고 픽에는 키만 남는다. */
    const imgFile = node.querySelector('.wk-img-file');
    const imgMsg = node.querySelector('.wk-img-msg');
    const imgHint = 'JPG·PNG·WebP · 5MB 이하 · 1240×520 이상 권장';
    if (imgFile) imgFile.addEventListener('change', async () => {
      const f = imgFile.files && imgFile.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) {
        toast('5MB 이하만 올릴 수 있습니다 (' + (Math.round(f.size / 1024 / 1024 * 10) / 10) + 'MB)', false);
        imgFile.value = ''; return;
      }
      wkSync();                       // 올리면 다시 그리므로 입력 중이던 값을 먼저 거둔다
      if (imgMsg) imgMsg.textContent = '올리는 중…';
      try {
        const r = await API.uploadPickImage(f, adminPin);
        const old = WK_PICKS[i].image || {};
        WK_PICKS[i].image = { key: r.key, credit: old.credit || '', pos: old.pos || 'center' };
        renderWeekly();
        toast('이미지를 올렸습니다. 출처·권리 근거를 적어 주세요', true);
      } catch (e) {
        if (imgMsg) imgMsg.textContent = imgHint;
        toast('업로드 실패: ' + (e.message || e.status), false);
      }
    });

    const imgDel = node.querySelector('.wk-img-del');
    if (imgDel) imgDel.addEventListener('click', () => { wkSync(); WK_PICKS[i].image = null; renderWeekly(); });

    node.querySelectorAll('.wk-img-pos').forEach((b) => b.addEventListener('click', () => {
      wkSync();
      if (WK_PICKS[i].image) WK_PICKS[i].image.pos = b.dataset.pos;
      renderWeekly();
    }));

    // 실제 픽셀 크기는 브라우저가 받아 봐야 안다 — Workers 에 이미지 처리가 없어 서버가 못 재 준다.
    const imgPrev = node.querySelector('.wk-img-prev'), imgWarn = node.querySelector('.wk-img-warn');
    if (imgPrev && imgWarn) {
      const measure = () => {
        const w = imgPrev.naturalWidth, hgt = imgPrev.naturalHeight;
        if (!w) return;
        const ok = w >= 1240;
        imgWarn.textContent = w + '×' + hgt + (ok ? ' · 판을 채우기에 충분합니다' : ' · 1240px 보다 작아 화면에서 뭉개집니다');
        imgWarn.className = 'wk-img-warn text-[11px] mt-1.5 font-semibold ' + (ok ? 'text-lime-600' : 'text-red-600');
      };
      imgPrev.addEventListener('load', measure);
      if (imgPrev.complete) measure();   // 캐시에서 바로 온 경우엔 load 가 이미 지나갔다
    }
  });

  const aiText = async (kind, btnId, targetId, join) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const payload = wkPayload();
      if (!payload.picks.length) { toast('먼저 주목 동향을 고르세요', false); return; }
      const el2 = document.getElementById(targetId);
      if (el2.value.trim() && !confirm('이미 쓴 내용을 AI 초안으로 덮어쓸까요?')) return;
      btn.textContent = '생성 중…'; btn.disabled = true;
      try {
        const r = await API.weeklyAction({ action: 'assist', kind, week: WK.week, picks: payload.picks }, adminPin);
        const v = join ? (r.items || []).join('\n') : r.text;
        if (v) { el2.value = v; wkWarnAxis(r.warn); }
        else toast('AI 초안을 받지 못했습니다. 직접 써 주세요', false);
      } catch (e) { toast('AI 초안 실패: ' + (e.status || e.message), false); }
      btn.textContent = 'AI 초안'; btn.disabled = false;
    });
  };
  aiText('overview', 'wkAiOverview', 'wkOverview', false);
  aiText('conclusion', 'wkAiConclusion', 'wkConclusion', true);

  document.getElementById('wkSave').addEventListener('click', () => wkSaveDraft(true));
  document.getElementById('wkPublish').addEventListener('click', wkPublish);
  document.getElementById('wkPreviewBtn').addEventListener('click', async () => {
    if (!(await wkSaveDraft(false))) return;
    window.open('/weekly?w=' + encodeURIComponent(WK.week) + '&draft=1', '_blank');
  });
  document.getElementById('wkPreviewNews').addEventListener('click', async () => {
    if (!(await wkSaveDraft(false))) return;
    window.open('/news?w=' + encodeURIComponent(WK.week) + '&draft=1', '_blank');
  });
  const unp = document.getElementById('wkUnpublish');
  if (unp) unp.addEventListener('click', async () => {
    if (!confirm('발행을 회수하면 공유한 링크가 빈 화면이 됩니다. 계속할까요?')) return;
    try { await API.weeklyAction({ action: 'unpublish', week: WK.week }, adminPin); toast('발행을 회수했습니다', true); loadWeekly(); }
    catch (e) { toast('회수 실패: ' + (e.status || e.message), false); }
  });
  /* 메시지 보내기 — 나갈 문구를 먼저 받아 그대로 보여 주고 확인받는다.
     문구는 서버가 만든다(보낸 것과 본 것이 갈라지지 않게). 이미 보낸 회차면 그 시각을 알려
     한 번 더 묻는다 — 같은 방에 두 번 나가는 사고가 이 화면에서 가장 흔할 일이다. */
  const nf = document.getElementById('wkNotify');
  if (nf) nf.addEventListener('click', async () => {
    nf.disabled = true;
    try {
      const dry = await API.weeklyAction({ action: 'notify', week: WK.week, dryRun: true }, adminPin);
      const sent = dry.notifiedAt
        ? '⚠ 이미 보낸 회차입니다 (' + String(dry.notifiedAt).slice(0, 16).replace('T', ' ') + ')\n\n'
        : '';
      if (!confirm(sent + '아래 내용으로 보냅니다.\n\n' + dry.text)) return;
      await API.weeklyAction({ action: 'notify', week: WK.week }, adminPin);
      toast('메시지를 보냈습니다', true);
      loadWeekly();
    } catch (e) {
      const m = {
        NOT_PUBLISHED: '발행된 회차가 아닙니다',
        NO_WEBHOOK: '웹훅 주소가 설정되지 않았습니다 (Pages 환경변수 WEEKLY_WEBHOOK_URL)',
        WEBHOOK_UNREACHABLE: '웹훅 주소에 연결하지 못했습니다',
        WEBHOOK_FAILED: '메신저가 거절했습니다' + (e.data && e.data.status ? ' (' + e.data.status + ')' : ''),
      }[e.message];
      toast(m || ('발송 실패: ' + (e.status || e.message)), false);
    } finally { nf.disabled = false; }
  });
}

async function wkSaveDraft(notify) {
  const st = document.getElementById('wkStatus');
  const payload = wkPayload();
  try {
    await API.weeklyAction({ action: 'save', week: WK.week, payload, issueNo: WK.issueNo || null }, adminPin);
    if (notify) toast('초안을 저장했습니다', true);
    if (st) { st.textContent = '저장됨'; st.className = 'text-sm text-lime-600 font-semibold'; }
    return true;
  } catch (e) {
    toast('저장 실패: ' + (e.status || e.message), false);
    return false;
  }
}

async function wkPublish() {
  const payload = wkPayload();
  if (!payload.picks.length) { toast('주목 동향을 최소 1건 고르세요', false); return; }
  const missing = payload.picks.filter((p) => !String(p.why || '').trim()).map((p) => p.company);
  if (missing.length) {
    toast('「주목(Pick) 이유」가 빈 항목: ' + missing.join(', ') + ' — 이 한 줄이 없으면 대시보드와 같은 화면이 됩니다', false);
    return;
  }
  // 이미지를 올렸는데 출처가 비면 서버가 이미지를 버린다. 발행 후에 사진이 사라진 것을
  // 발견하게 되므로 여기서 막는다.
  const noCredit = payload.picks.filter((p) => p.image && !String(p.image.credit || '').trim()).map((p) => p.company);
  if (noCredit.length) {
    toast('이미지 출처·권리 근거가 빈 항목: ' + noCredit.join(', ') + ' — 비워 두면 이미지가 실리지 않습니다', false);
    return;
  }
  if (!(await wkSaveDraft(false))) return;
  try {
    const r = await API.weeklyAction({ action: 'publish', week: WK.week }, adminPin);
    toast(r.issueNo + '호 발행 완료 (금주 ' + r.total + '건 중 ' + r.picks + '건 선정)', true);
    loadWeekly();
  } catch (e) {
    if (e.message === 'WHY_REQUIRED') { toast('「주목(Pick) 이유」가 빈 항목이 있습니다: ' + ((e.data && e.data.companies) || []).join(', '), false); return; }
    toast('발행 실패: ' + (e.status || e.message), false);
  }
}

document.addEventListener('DOMContentLoaded', init);
