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

## 🧱 에픽: 사이드바 IA 개편 + 탐색/기업상세/의견폼
> 상세 기획: `.omc/plans/ax-biz-radar-sidebar-epic-plan.md` (로컬 전용)
> 확정: 멀티페이지 + 공유 사이드바(JS 주입) / 상시 좌측 사이드바 + 모바일 드로어 / 데이터는 `/api/reports/all` 재사용
> 사이드바 항목: 대시보드·탐색·기업·태그·의견 보내기 (+하단 요약통계·About). **관리자(/admin) 미포함(하드 규칙)**

### P1. 사이드바 셸 + 탐색(Explore)  ⬜
- [ ] `public/assets/js/sidebar.js` — 공유 사이드바 주입 + 활성 표시 + 모바일 드로어
- [ ] 로고를 사이드바 상단으로 이동(E2 계승), 각 페이지 레이아웃 래퍼 조정
- [ ] `public/explore.html` + `public/assets/js/explore.js` — 전체 필드 검색 + 태그 필터(`?tag=`)
- [ ] 홈 그래프 태그 노드 클릭 → `explore.html?tag=<태그>` (dashboard.js)

### P2. 기업 상세(Company)  ⬜
- [ ] `public/company.html` + `public/assets/js/company.js` — 기업 목록 + `?name=` 상세(날짜별 타임라인)
- [ ] 홈 그래프 회사 노드 클릭 / 카드 기업명 클릭 → `company.html?name=<기업명>`
- [ ] (선택) 연관 기업(태그 공유) 링크

### P3. 의견 제출 폼  ⬜
- 결정 완료: **D1 테이블 + 관리자 검토** + 진입점 **모달**(사이드바 "의견 보내기")
- [ ] D1 `suggestions` 테이블(schema.sql) + 로컬·원격 적용
- [ ] `functions/api/suggestions.js` — POST(공개, 허니팟·검증·길이상한) / GET(PIN)
- [ ] `public/assets/js/feedback.js` — 의견 모달(유형·내용·기업·연락처)
- [ ] `/admin` "의견함" 탭 — `GET /api/suggestions`(PIN) 목록
- [ ] 스팸 방지: 허니팟 + 길이 제한 + (후속) Cloudflare Turnstile

### (이후 아이디어 적재용)
- [ ] …

---

## ✅ 완료

### E2. Hancom CI 적용  ✅  _(2026-06-02)_
- [x] nav 브랜드에 한컴 로고(`/assets/HANCOM.png`) 적용 — 브랜드 텍스트 앞 + 구분선 (`index.html`, `admin/index.html`)
- [x] 파비콘(`/assets/hancom_favicon.png`) 추가
- [ ] (선택, 보류) 푸터/로딩 등 추가 브랜드 요소

### B0. 베이스라인 (대시보드 + 관리자 + 배포)  ✅  _(2026-06-02)_
- [x] 메인 대시보드: 전체 누적 지식 그래프, 분류별 세로 스윔레인 카드, 월 캘린더 + 선택일 브리핑, 자동 반응형
- [x] 관리자(`/admin`): PIN 게이트, 동적 기업/불릿 입력, 기존일 로드, upsert 저장
- [x] REST(Pages Functions): `/api/health` `/api/dates` `/api/reports`(GET/POST) `/api/reports/all`
- [x] Cloudflare D1 연결 + 원격 스키마
- [x] 보안: PIN 상수시간 검증, escapeHtml/safeUrl, `_headers`(CSP·X-Frame-Options), 입력 상한
- [x] 배포 분리: 정적은 `public/`, 내부 문서 비서빙
- [x] GitHub(Private) `jykim-code/AXBiz` + Cloudflare Pages 배포(`https://ax-biz-radar.pages.dev`)
- [x] GitHub Actions 자동배포 워크플로 추가(secret 등록 시 활성)
