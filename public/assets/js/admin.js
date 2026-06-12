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

/* ===== 저장 ===== */
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
  btn.disabled = true;
  status.style.color = '#111';
  status.textContent = '저장 중…';
  try {
    const res = await API.save(date, companies, adminPin);
    status.style.color = '#7ba500';
    status.textContent = '저장 완료 (' + res.count + '개 기업)';
    toast('저장 완료 — 대시보드에 즉시 반영됩니다', true);
  } catch (e) {
    if (e.status === 403) {
      // PIN 무효화 → 게이트 재노출
      adminPin = '';
      sessionStorage.removeItem('adminPin');
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
  showTab('review'); // 기본 탭 = 검수·배포
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
    sessionStorage.setItem('devPin', pin); // 검수·배포(draft API)·/preview 공용
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
  document.getElementById('tabSetBtn').addEventListener('click', () => showTab('set'));
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
    sessionStorage.setItem('devPin', saved); // draft API·/preview 공용
    showEditor();
  } else {
    showGate(false);
  }
}

/* ===== 탭 전환 ===== */
function showTab(which) {
  const tabs = { review: 'tab-review', imp: 'tab-import', report: 'tab-report', sugg: 'tab-suggestions', dart: 'tab-dart', set: 'tab-settings' };
  const btns = { review: 'tabReviewBtn', imp: 'tabImportBtn', report: 'tabReportBtn', sugg: 'tabSuggBtn', dart: 'tabDartBtn', set: 'tabSetBtn' };
  for (const k in tabs) {
    document.getElementById(tabs[k]).classList.toggle('hidden', k !== which);
    document.getElementById(btns[k]).className = 'btn px-4 py-2 ' + (k === which ? 'bg-ink text-white' : 'border border-ink/15 hover:bg-ink hover:text-white');
  }
  if (which === 'review') loadReview();
  if (which === 'imp') renderImpToggle();
  if (which === 'sugg') loadSuggestions();
  if (which === 'dart') loadDartMappings();
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
  // 상장(stock 보유) 우선 정렬 보정
  const rank = (arr) => arr.sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0));
  return exact.concat(rank(starts), rank(contains)).slice(0, 12);
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
  const search = el('input', { class: 'field dart-search', type: 'text', placeholder: 'DART 기업 검색 (이름/종목코드)…', autocomplete: 'off' });
  const dropdown = el('div', { class: 'dart-dd hidden absolute z-10 left-0 right-0 mt-1 bg-white border border-ink/10 rounded-xl shadow-xl max-h-56 overflow-auto' });
  const current = el('div', { class: 'text-xs mt-1' });
  const ceo = el('input', { class: 'field dart-ceo', type: 'text', placeholder: '대표자 보정(선택)', value: ovCeo });
  const status = el('span', { class: 'text-xs ml-1' });
  const saveBtn = el('button', { type: 'button', class: 'btn flex-none bg-ink text-white px-4 py-2 hover:bg-lime hover:text-ink', text: '저장' });

  const row = el('div', { class: 'bg-white rounded-2xl border border-ink/5 shadow p-4' }, [
    el('div', { class: 'font-display font-semibold mb-1', text: name }),
    current,
    el('div', { class: 'relative mt-2' }, [search, dropdown]),
    el('div', { class: 'flex items-center gap-2 mt-2' }, [ceo, saveBtn, status]),
  ]);
  row.dataset.corp = meta && meta.corp_code ? meta.corp_code : '';

  function renderCurrent() {
    const c = row.dataset.corp;
    if (c) {
      const hit = DART_CORPS.find((x) => x.code === c);
      current.innerHTML = '연결됨: <b>' + escapeHtml(hit ? hit.name : '') + '</b> <span class="opacity-50">' + escapeHtml(c) + (hit && hit.stock ? ' · ' + escapeHtml(hit.stock) : '') + '</span> <button type="button" class="dart-clear text-red-500 ml-1">해제</button>';
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
      res.forEach((c) => {
        const item = el('button', { type: 'button', class: 'block w-full text-left px-3 py-2 text-sm hover:bg-beige' });
        item.innerHTML = escapeHtml(c.name) + ' <span class="opacity-50 text-xs">' + escapeHtml(c.code) + (c.stock ? ' · ' + escapeHtml(c.stock) : '') + '</span>';
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
      await API.saveCompanyMeta({ name, corpCode: row.dataset.corp || '', overrides: { ceo: ceo.value.trim() } }, adminPin);
      status.style.color = '#7ba500';
      status.textContent = '저장됨';
      toast(name + ' 연결 저장', true);
    } catch (e) {
      if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
      status.style.color = '#dc2626';
      status.textContent = '실패: ' + ((e.data && e.data.error) || e.status || e.message);
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
    status.style.color = '#7ba500';
    status.textContent = '완료 (' + (res.affectedDates || []).length + '개 날짜 반영)';
    toast(name + ' 태그 변경 완료', true);
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
    status.style.color = '#7ba500';
    status.textContent = '완료 (' + (res.affectedDates || []).length + '개 날짜 반영)';
    input.value = '';
    toast('태그 전역 삭제 완료', true);
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
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); sessionStorage.removeItem('devPin'); showGate(true); return; }
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
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); sessionStorage.removeItem('devPin'); showGate(true); }
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

document.addEventListener('DOMContentLoaded', init);
