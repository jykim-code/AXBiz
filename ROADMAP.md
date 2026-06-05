# AX Biz Radar — 고도화 로드맵

> 고도화 항목을 여기서 추적한다. 새 아이디어가 나오면 **예정**에 추가하고,
> 작업을 시작하면 **진행 중**, 끝나면 **완료**로 옮기고 완료일을 적는다.
>
> 상태 표기: `⬜ 예정` · `🟡 진행 중` · `✅ 완료`
> 체크박스: `- [ ]` 미완료 / `- [x]` 완료. 세부 작업은 항목 아래 하위 체크리스트로.

---

## 🟡 진행 중

### 🕒 에픽: 1년치 데이터 + 최신/히스토리 정확성 (Phase 2)  🟡
> 플랜: `.omc/plans/company-page-and-temporal-data-plan.md` (로컬 전용)
> 증분(뉴스) 모델에서 기업의 "현재 상태"를 정확히 — **타임라인 인지(timeline-aware) RAG** + 파생 테이블.
- [x] `company_entries(company,date,category,data)` 파생 테이블 + 인덱스 — 원격 D1 생성 + 전체 백필(36개 날짜 재저장 → 50행)
- [x] `reports` POST·컨플 가져오기에서 `company_entries` 동기화(`_entries.js`, 날짜별 delete→insert, best-effort)
- [x] `/api/ask` 타임라인 인지로 재작성 — 벡터 매치는 **기업 식별용**(점수순 상위 3곳), 컨텍스트는 `company_entries`에서 기업당 최근 6건 연대기 조회. 시스템 프롬프트에 "최신=현재 상태·과거는 변화 이력" 규칙 + 오늘 날짜 주입, 인용 필터링·폴백(미구축 시 기존 방식) 유지, max_tokens 800→1200(잘림 해결)
- [x] 실데이터 모순 검증 — "LG CNS AX 플랫폼 있어?" → 최신(5/25 에이전틱웍스) 기준 "있음"[5/25·5/27 인용] / "삼성SDS 패브릭스 최신 동향" → 5/29 패브릭스 2.0 중심 + 1월 자료는 "과거 OpenAI 리셀러 → 멀티LLM 플랫폼 진화" **변화 이력으로 구분 서술** ✓
- [ ] (선택) `GET /api/companies`로 그리드 데이터 서버화
- [x] **히스토리 데이터 본삽입** — 컨플 "AX 동향 히스토리(기업별·2026)" 국내 10곳 **42건(2026-01~05, 32개 날짜)** 자동 ingest 완료(이름 한글 통일·날짜 정규화·병합 업서트, RAG 색인 자동). 해외 5곳(Anthropic·MS·OpenAI·Salesforce·Cohere)은 보류. Vectorize ~52/4,880 여유
- [x] **컨플 동기화 자동화 2단계** — admin **"컨플 가져오기" 탭**: 링크 붙여넣기→미리보기(기업명·분류 수정 가능)→실행. `POST /api/import-confluence`(PIN, Confluence REST + API 토큰 시크릿), 단축링크 해석·엔티티 디코드·한글명 매핑·유형태그 제외·병합 업서트·재색인·AI요약 재생성. 삼성SDS로 끝단 검증
- [ ] (선택) 전체 페이지 일괄 동기화 버튼 / GitHub Actions cron — 필요 시

---

## ⬜ 예정

### 소개(About) 페이지  ⬜
- [ ] 서비스 소개·데이터 출처·갱신 주기 안내 (사이드바 "소개" 항목 + 페이지). **보류 — 추후 추가**.

### 지식그래프 LLM 보강 (후속)  ⬜
- [ ] 키포인트→후보 태그/관계 LLM 추출(Workers AI/Claude API) → `/admin` 검증(source/status 필드)

### 의견함 고도화 (후속)  ⬜
- [ ] 의견 상태 변경(handled)·알림 / 공개 폼 Cloudflare Turnstile

### (이후 아이디어 적재용)
- [ ] …

---

## ✅ 완료

### 기업 AI 요약 (핵심 흐름 + 종합 한컴 인사이트)  ✅  _(2026-06-05)_
- [x] `GET /api/company-summary` — 기업 전체 타임라인(출처 불문)→LLM(JSON 강제) 생성, `company_summary` D1 캐시
- [x] `source_hash` 변경 감지 → 데이터 추가 시 다음 조회 때 자동 재생성 / LLM 실패 시 stale 캐시 폴백 / 2건 미만 미표시
- [x] 기업 상세 헤더 아래 요약 밴드: 흐름(흰 카드+기간 칩) + 인사이트(다크+라임) — 첫 생성 ~15s(스피너), 이후 캐시 0.1s

### 관리자 태그 관리 + 그래프/탐색 태그 큐레이션  ✅  _(2026-06-05)_
- [x] 그래프·탐색 태그 = 핀(관리자) ∪ 공유(2기업↑) ∪ 기업별 대표 3, 중요도순 (`selectCuratedTags` 공용)
- [x] admin 설정 탭: 핀 태그 / 기업별 태그 수정·추가 / 전역 삭제(`POST /api/tags`, 원본 수정+자동 재색인)
- [x] 유형 파생 태그 10종 전역 삭제(31개 날짜 재색인), ingest 의 유형→태그 변환 제거

### 컨플 히스토리 자동 ingest (1단계)  ✅  _(2026-06-05)_
- [x] 컨플 "AX 동향 히스토리(기업별·2026)" 국내 10곳 42건(2026-01~05) 병합 업서트 + RAG 색인 (해외 5곳 보류)
- [x] admin DART 연결 탭 / PIN 게이트 즉시 검증 / 지식그래프 상위태그·main 폭 등 안정화

### 기업 회사정보 + 재무 (DART 연동)  ✅  _(2026-06-04)_
> 출처: Open DART. 기업 상세 2단(좌 주요동향 / 우 위 회사정보 · 우 아래 재무).
- [x] `functions/_dart.js`: 회사개황 + 연도 요약(3개년+전년비 YoY) + 분기 추이(누적 차분 4분기) + D1 7일 캐시 + **User-Agent 필수**(CF Workers fetch 시 DART 비-JSON 방지)
- [x] `GET /api/company-profile?name=` : `company_meta.corp_code` → DART → 캐시. 미매핑/해외/비상장 우아한 폴백
- [x] `company_meta`(이름→corp_code 수동 매핑) + `company_profile` 캐시 테이블 / 시드: 네이버(00266961)·플래티어(01454341)·업스테이지(01786541)
- [x] 기업 상세 UI: 회사 정보 카드 + 재무 카드(연도 요약 행 + 매출·영업이익 묶음 막대그래프, 인라인 SVG)
- [x] **관리자 'DART 연결' 탭** — 검색→선택 자동완성(전체 11.8만 정적목록 `dart-corps.txt` 클라이언트 검색)으로 기업↔corp_code 매핑 + 대표자 등 overrides 보정. `/api/company-meta`(PIN)
- [ ] (유지보수) `dart-corps.txt` 정기 갱신(신규 등록 법인 반영) — 현재 스냅샷
- [ ] (후속) 업계평균 대비, 해외 기업 재무(SEC 등)

### 기업 페이지 카드 그리드 (Phase 1)  ✅  _(2026-06-04)_
> 플랜: `.omc/plans/company-page-and-temporal-data-plan.md` (로컬 전용)
- [x] 첫 화면 버튼 목록 → **카드 그리드**(이름·카테고리·최신 분석일·대표태그·최신 요약·등장N)
- [x] 검색(이름·태그·요약) + 카테고리 필터 + 정렬(최신순 기본/등장순), 클릭→기존 상세 타임라인
- [x] `buildOntology`에 기업별 `latestDate`/최신 요약 집계 추가(기존 그래프·탐색 호환)
- [x] 에디토리얼 카드 디자인(Template 톤): `rounded-[28px]`·라임 eyebrow·대형 기업명·화살표 원·첫 카드 다크 + 대형 헤딩

### UI/UX·내비 다듬기 묶음  ✅  _(2026-06-04)_
- [x] 사이드바 **라임 틴트 글래스모피즘**(`bg-lime/20 backdrop-blur`), 구성 동일·오버레이 블러
- [x] 사이드바 중복 "태그" 메뉴 제거(전용 태그 페이지 폐기) + `?tag=` 진입 시 결과 섹션 자동 스크롤
- [x] 헤더 Hancom 로고 클릭 → 홈(대시보드) 이동 (index/explore/company/feedback)
- [x] `/explore`: 검색 전 결과 숨김 + 질문칸 **Enter 즉시 제출**(Shift+Enter 줄바꿈, 한글 IME 조합 Enter 무시)
- [x] 대시보드·기업·탐색 흐릿한 텍스트 가독성 상향(opacity 40/50→75, 60/70→80; 장식·상태값 보존)
- [x] 기업·탐색·의견 페이지 **에디토리얼 디자인 통일**(eyebrow + 대형 헤딩 + rounded-28 카드), 탐색 질문창 한 줄 검색바(버튼 "검색")
- [x] **한글 웹폰트 Pretendard** 적용(라틴은 Space Grotesk/Inter 유지, 한글만 폴백; CSP에 jsdelivr 허용; 그래프 라벨 포함)
- [x] 사이드바 상단 CI 클릭 시 닫기
- [x] 지식그래프 라벨(텍스트) 클릭도 노드와 동일 선택·이동(`text-events`)
- [x] **플로팅 질의응답(FAB)** 우하단 버튼 — RAG 질의 패널(`ask-fab.js`, feedback·admin 제외)

### 🔎 에픽: RAG 시맨틱 검색 (탐색 고도화)  ✅  _(2026-06-04)_
> 검색=Cloudflare Vectorize(`ax-biz-radar-idx`, 1024d/cosine) / 임베딩=Workers AI `@cf/baai/bge-m3`(1024d) /
> 생성=OpenRouter `deepseek/deepseek-v4-flash` / `/explore` 자연어 질문 + **키워드 폴백·태그 목록 유지**.
> 프리뷰 배포에서 임베딩·검색·생성·인용까지 끝단 검증 완료. Vectorize는 계정 단일 인덱스(프리뷰·운영 공유).
- [x] RAG-1 인프라: Vectorize 인덱스 + `[ai]`·`[[vectorize]]`·`[[kv_namespaces]]`(RL) 바인딩 + `functions/_rag.js`(임베딩/청크/upsert/delete)
- [x] RAG-2 인덱싱: `POST /api/reindex`(PIN 백필) + `POST /api/reports` 증분 재색인(old delete→new upsert, best-effort)
- [x] RAG-3 질의: `POST /api/ask` — 질문 임베딩→Vectorize 검색(cosine≥0.35)→D1 원본 재조회→OpenRouter 생성→`{answer, sources[]}`, `[n]` 인용·인젝션 방지
- [x] RAG-4 프론트: `/explore` 자연어 질문 + 답변/출처 카드(→`/company`·원문), 인용 칩, 로딩/빈/오류, 키워드 폴백, `API.ask()`
- [x] RAG-5 운영: 질문 ≤500자 + KV 고정 윈도우 Rate Limiting(IP/분 10, Pages가 ratelimit 바인딩 미지원이라 KV로 구현)
- [x] 운영(main) 배포 + 라이브 검증 — 운영 시크릿·인덱스 준비, node(UTF-8) 끝단 질의 확인
- [x] (후속 개선) 출처를 **답변에 실제 인용된 `[n]`만** 반환(+순차 재번호) / 출처 카드에 **근거(주요내용) 접이식** 표시

### 사이드바 IA + 탐색/기업상세/의견폼 + 지식그래프  ✅  _(2026-06-02)_
- [x] 공유 사이드바(`sidebar.js`): 기본 닫힘 드로어, 이모지 없음, `/admin` 미노출
- [x] 탐색(`/explore`): 전체 필드 검색 + 태그 필터(`?tag=`)
- [x] 기업 상세(`/company`): 목록 + `?name=` 날짜별 타임라인 + 연관 기업
- [x] 의견(`/feedback`): 별도 페이지(유형/기업/내용/소속팀/이름) + 작성 예시 + 문의 채널(김정연·손아영)
- [x] 백엔드: D1 `suggestions` + `/api/suggestions`(POST 공개·허니팟 / GET PIN) + 관리자 의견함 탭
- [x] 지식그래프: 홈 레이더 **Cytoscape(concentric)** 온톨로지 허브, 노드 클릭→기업/탐색, SVG 폴백, CSP에 jsdelivr 허용
- [x] 내부 링크 확장자 없는 canonical 경로 통일, 라이브 배포·검증

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
