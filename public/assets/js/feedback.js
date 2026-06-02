/* 의견 보내기 — POST /api/suggestions (공개). 허니팟 + 최소 검증. */
function init() {
  const form = document.getElementById('fbForm');
  const status = document.getElementById('fbStatus');
  const btn = document.getElementById('fbSubmit');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('f-content').value.trim();
    if (!content) { status.style.color = '#dc2626'; status.textContent = '내용을 입력해 주세요.'; return; }
    const payload = {
      type: document.getElementById('f-type').value,
      company: document.getElementById('f-company').value.trim(),
      content,
      team: document.getElementById('f-team').value.trim(),
      name: document.getElementById('f-name').value.trim(),
      hp: document.getElementById('f-hp').value, // 허니팟(비어 있어야 함)
    };
    btn.disabled = true; status.style.color = '#111'; status.textContent = '제출 중…';
    try {
      await API.sendSuggestion(payload);
      form.reset();
      status.style.color = '#7ba500'; status.textContent = '의견이 접수되었습니다. 감사합니다!';
      toastMsg('의견이 접수되었습니다');
    } catch (err) {
      status.style.color = '#dc2626';
      status.textContent = '제출 실패: ' + (err && err.status ? err.status : (err && err.message) || 'ERROR');
    } finally {
      btn.disabled = false;
    }
  });
}
function toastMsg(m) {
  const t = document.getElementById('toast');
  t.textContent = m; t.style.opacity = '1';
  setTimeout(() => (t.style.opacity = '0'), 2400);
}
document.addEventListener('DOMContentLoaded', init);
