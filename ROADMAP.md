# AX Biz Radar — 고도화 로드맵

> 고도화 항목을 여기서 추적한다. 새 아이디어가 나오면 **예정**에 추가하고,
> 작업을 시작하면 **진행 중**, 끝나면 **완료**로 옮기고 완료일을 적는다.
>
> 상태 표기: `⬜ 예정` · `🟡 진행 중` · `✅ 완료`
> 체크박스: `- [ ]` 미완료 / `- [x]` 완료. 세부 작업은 항목 아래 하위 체크리스트로.

---

## 🟡 진행 중
_(없음)_

---

## ⬜ 예정

### E1. 탐색(Explore) 페이지 — 검색 + 태그 상세  ⬜
홈(날짜별 대시보드)과 별개로 전체 기간 데이터를 태그·키워드로 탐색하는 페이지.
- [ ] `public/explore.html` 신규(검색창 + 태그 필터 + 결과 리스트)
- [ ] `public/assets/js/explore.js` — `/api/reports/all` 재사용, 전체 필드 검색, `?tag=` 처리
- [ ] 홈 그래프 태그 노드 클릭 → `explore.html?tag=<태그>` (dashboard.js)
- [ ] 홈 nav에 "탐색" 링크(index.html) — `/admin` 링크는 계속 미노출
- 결정 완료: 별도 페이지 1개 / 클라이언트 `/api/reports/all` 재사용 / 전체 필드 검색
- 서버 코드 변경 없음. (상세: `.omc/plans/ax-biz-radar-explore-plan.md` — 로컬 전용)

### E2. Hancom CI 적용  ⬜
한컴 브랜드 아이덴티티 반영.
- [ ] nav 브랜드에 한컴 로고 이미지 적용(현재 텍스트 "HANCOM AX Biz Radar")
- [ ] 파비콘(favicon) 추가
- [ ] (선택) 푸터/로딩 등 브랜드 요소
- ⚠️ 필요: **한컴 로고 에셋(SVG 권장 또는 고해상도 PNG)** — 제공 필요
- 적용 위치: `public/index.html`, `public/admin/index.html`(공통 nav), `public/assets/`(로고 파일)

### E3. 의견 제출 폼  ⬜
조회자가 "이 업체 추가해달라 / 이런 내용 추가해달라" 등 의견을 남기는 폼.
- [ ] 입력 폼 UI(유형 선택 + 내용 + 선택 연락처) — 진입점/위치 결정
- [ ] 제출 저장 방식 결정 → 백엔드 구성
- [ ] 관리자(`/admin`)에서 접수된 의견 열람
- [ ] 스팸 방지(공개 폼이므로)
- ⚠️ **결정 필요 — 저장/전달 방식**:
  - (A) 신규 D1 테이블 `suggestions` + `POST /api/suggestions`(공개) + `/admin`에서 검토(현 스택과 일관) — **추천**
  - (B) 외부(Google Form / 이메일 등) 임베드 — 백엔드 없음, 데이터가 외부에 분리
- ⚠️ 공개 POST이므로 스팸 방지 필요: 허니팟 + 길이 제한 + (권장) Cloudflare Turnstile

### (이후 아이디어 적재용)
- [ ] …

---

## ✅ 완료

### B0. 베이스라인 (대시보드 + 관리자 + 배포)  ✅  _(2026-06-02)_
- [x] 메인 대시보드: 전체 누적 지식 그래프, 분류별 세로 스윔레인 카드, 월 캘린더 + 선택일 브리핑, 자동 반응형
- [x] 관리자(`/admin`): PIN 게이트, 동적 기업/불릿 입력, 기존일 로드, upsert 저장
- [x] REST(Pages Functions): `/api/health` `/api/dates` `/api/reports`(GET/POST) `/api/reports/all`
- [x] Cloudflare D1 연결 + 원격 스키마
- [x] 보안: PIN 상수시간 검증, escapeHtml/safeUrl, `_headers`(CSP·X-Frame-Options), 입력 상한
- [x] 배포 분리: 정적은 `public/`, 내부 문서 비서빙
- [x] GitHub(Private) `jykim-code/AXBiz` + Cloudflare Pages 배포(`https://ax-biz-radar.pages.dev`)
- [x] GitHub Actions 자동배포 워크플로 추가(secret 등록 시 활성)
