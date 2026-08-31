# AX Biz Radar

사내 AX 사업 활성화를 위한 **경쟁사 동향 대시보드**. 관리자가 Confluence에서 회차 보고서를 가져오면
모든 조회자가 동일 데이터를 즉시 확인한다.

## 주요 화면

| 경로 | 설명 |
|---|---|
| `/` | 메인 대시보드 — 지식 그래프 + 스윔레인 카드 + 캘린더 |
| `/weekly` | 위클리 픽 목록 — 회차 썸네일 그리드 |
| `/weekly?w=N` | 위클리 픽 상세 — 해당 회차 동향 카드 |
| `/news` | 뉴스레터 조판 — 슬라이드 형식으로 회차 읽기 |
| `/explore` | 전체 동향 탐색 — 기간·기업·태그 필터 |
| `/company?name=` | 기업 프로필 — 동향 타임라인 + AI 요약 |
| `/admin` | 관리자 — 메인에 비노출, URL 직접 접근 + 숫자 PIN |

### 메인 대시보드 (`/`)
- 좌측(~42%): 누적 **지식 그래프** (기업↔태그 관계망) + 통계
- 우측(~58%): 분류별 **세로 스윔레인** (대기업 → 중견기업 → 스타트업·중소), 카드 클릭 시 상세 펼침
- 하단: 월 **캘린더** (데이터 있는 날 라임 하이라이트, 기본=최신일)
- 기업 카드: 주요 내용 / 시사점 / 한컴 인사이트(라임 박스) / 출처·Confluence 링크 / 태그 칩

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트 | 바닐라 HTML/CSS/JS + Tailwind CDN (빌드 단계 없음) |
| 데이터베이스 | Cloudflare D1 (서버리스 SQLite) |
| 벡터 검색 | Cloudflare Vectorize (RAG — `/api/ask` 의미검색) |
| 이미지 저장 | Cloudflare R2 (`ax-biz-radar-img`) |
| 백엔드 | Cloudflare Pages Functions (`functions/api/*`) |
| LLM | Cloudflare AI Workers AI (기업 요약·AI 질의응답) |
| 배포 | Cloudflare Pages + GitHub Actions (stg → main) |

## 파일 구조

```
public/
  index.html              # 메인 대시보드
  weekly.html             # 위클리 픽 목록·상세
  news.html               # 뉴스레터 조판
  explore.html            # 전체 탐색
  company.html            # 기업 프로필
  feedback.html           # 피드백
  preview.html            # draft 합본 미리보기 (관리자용)
  admin/index.html        # 관리자 입력 페이지 (/admin)
  assets/js/
    util.js               # escapeHtml / safeUrl 등 출력 안전 유틸
    api.js                # /api/* fetch 래퍼
    dashboard.js          # 그래프·스윔레인·캘린더 렌더
    graph.js              # 지식 그래프 (D3 기반)
    weekly.js             # 위클리 픽 목록·상세 렌더
    news.js               # 뉴스레터 슬라이드 렌더
    explore.js            # 탐색 필터·목록 렌더
    company.js            # 기업 프로필 렌더
    sidebar.js            # 사이드바 (동향 상세)
    nav.js                # 상단 네비게이션
    ask-fab.js            # AI 질의응답 플로팅 버튼
    admin.js              # PIN 게이트·동적 폼·저장
    entry.js              # 동향 항목 공통 렌더
    ontology.js           # 태그 온톨로지
    company-alias.js      # 기업 이름 정규화
functions/
  _auth.js                # PIN 인증 공통 모듈
  _entries.js             # 동향 항목 CRUD 헬퍼
  _publish.js             # draft → live 발행 로직
  _rag.js                 # Vectorize 색인·검색
  _style.js               # 문체 후처리 (명사형 종결 등)
  _summary.js             # LLM 기업 요약 생성
  _confluence.js          # Confluence API 연동
  _dart.js                # DART 공시 연동
  _weekly-message.js      # 위클리 픽 메시지 생성
  api/
    health.js             # GET  /api/health
    dates.js              # GET  /api/dates
    reports.js            # GET  /api/reports?date= · POST upsert
    reports/all.js        # GET  /api/reports/all
    weekly.js             # GET  /api/weekly · POST (픽 저장)
    ask.js                # POST /api/ask (RAG 질의응답)
    tags.js               # GET  /api/tags
    pinned-tags.js        # GET/POST /api/pinned-tags
    suggest-tags.js       # GET  /api/suggest-tags
    suggestions.js        # GET  /api/suggestions
    company-profile.js    # GET  /api/company-profile
    company-summary.js    # GET  /api/company-summary
    company-meta.js       # GET  /api/company-meta
    company-aliases.js    # GET  /api/company-aliases
    period-summary.js     # GET  /api/period-summary
    import-confluence.js  # POST /api/import-confluence
    pick-image.js         # POST /api/pick-image (R2 업로드)
    reindex.js            # POST /api/reindex (Vectorize 재색인)
    backfill-summaries.js # POST /api/backfill-summaries
    dev/                  # 개발·관리용 엔드포인트
schema.sql                # D1 테이블 정의
wrangler.toml             # Pages + D1/R2/Vectorize 바인딩
.dev.vars.example         # 로컬 환경변수 샘플
```

## REST API

### 공개 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | DB 바인딩 / 환경변수 점검 |
| GET | `/api/dates` | 데이터 있는 날짜 배열 (desc) |
| GET | `/api/reports?date=YYYY-MM-DD` | 해당 날짜 동향 항목 |
| GET | `/api/reports/all` | 전체 보고서 누적 (그래프·통계용) |
| GET | `/api/weekly?list=1` | 위클리 픽 회차 목록 |
| GET | `/api/weekly?w=N` | N회차 위클리 픽 상세 |
| GET | `/api/tags` | 전체 태그 목록 |
| GET | `/api/company-profile?name=` | 기업 동향 타임라인 |
| GET | `/api/company-summary?name=` | 기업 AI 요약 |
| POST | `/api/ask` | RAG 기반 자연어 질의응답 |

### 관리자 엔드포인트 (`x-admin-pin` 헤더 필요)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/reports` | 동향 항목 upsert (draft) |
| POST | `/api/import-confluence` | Confluence 회차 가져오기 |
| POST | `/api/weekly` | 위클리 픽 저장·발행 |
| POST | `/api/pick-image` | 위클리 픽 이미지 R2 업로드 |
| POST | `/api/reindex` | Vectorize 전체 재색인 |

### 동향 항목 스키마

```json
{
  "name": "",
  "category": "대기업|중견기업|스타트업·중소",
  "sourceUrl": "",
  "confluenceUrl": "",
  "keyPoints": [],
  "implications": [],
  "hancomInsight": [],
  "tags": []
}
```

## 로컬 개발

로컬 실행은 Cloudflare 로그인이 필요 없다 (로컬 D1은 `.wrangler/`에 시뮬레이션됨).

```bash
npm install

# 1) 로컬 D1 에 스키마 적용
npm run d1:local

# 2) 환경변수 설정
cp .dev.vars.example .dev.vars   # ADMIN_PIN 등 값 수정

# 3) 로컬 실행 (http://localhost:8788)
npm run dev
```

> **wrangler v4 이상 필수.** v3 에서는 `d1:local` 과 `pages dev` 의 로컬 D1 저장 경로가
> 달라 "no such table: reports" 가 발생한다. `package.json` 은 v4 로 고정돼 있다.

로컬에서 사용 불가한 기능: Vectorize(`/api/ask`), R2 이미지 업로드, Workers AI 요약.
해당 기능은 stg 환경에서 검증한다.

검증 체크리스트:
- `GET /api/health` → `{ok:true, db:true, adminPin:true}`
- `/admin` PIN 입력 → 항목 추가/불릿 입력 → 저장 200, 틀린 PIN → 403
- `/` 최신일 자동 로드, 카드 펼침/접힘, 캘린더 날짜 전환, 그래프·통계 표시
- `/weekly` 회차 그리드 표시, 썸네일 클릭 → 상세 이동
- 같은 날짜 재입력 → 덮어쓰기 반영

## 배포 워크플로

코드 변경은 **stg 브랜치 선배포 → 확인 후 main 반영** 순서로 진행한다.

- PR 생성 또는 브랜치 푸시 → `preview.yml`이 `stg.ax-biz-radar.pages.dev`에 자동 배포
- PR 댓글로 스테이징 URL 공유 → 검수
- main 머지 → `deploy.yml`이 운영(`ax-biz-radar.pages.dev`)에 자동 배포

> **협업자는 main 직접 푸시 금지.** 반드시 새 브랜치 → PR 경로를 사용한다. 자세한 규칙은 `ONBOARDING.md` 참고.

### 최초 배포 (신규 환경)

```bash
npx wrangler login

# D1 생성 → database_id 를 wrangler.toml 에 기입
npm run d1:create

# 원격 D1 스키마 적용
npm run d1:remote
```

Pages 프로젝트 Settings에서 추가 설정:
- **Functions → D1 database bindings**: `DB` → `ax-biz-radar`
- **Functions → R2 bucket bindings**: `IMAGES` → `ax-biz-radar-img`
- **Functions → Vectorize index bindings**: `VECTORIZE` → `ax-biz-radar`
- **Environment variables**: `ADMIN_PIN`, `CONFLUENCE_TOKEN`, `AI_GATEWAY_TOKEN` 등 (`ONBOARDING.md` 참고)

## 보안 메모

- 쓰기(`POST`)는 서버에서 `ADMIN_PIN` 상수시간 비교로 검증 → 클라이언트 우회 불가.
- 출력은 `escapeHtml`(XSS) + `safeUrl`(http/https 절대 URL만)로 방어. `_headers`로 CSP·`X-Frame-Options: DENY`·`nosniff` 등 보안 헤더 적용.
- 입력 상한: 본문 1MB / 기업 200개 / 불릿·태그 50개 / 문자열 길이 제한 (이상 시 413).
- **[배포 필수] PIN 무차별 대입 방어**: 코드의 500ms 지연만으로는 병렬 공격을 못 막는다.
  Cloudflare 대시보드에서 **`POST /api/reports` 경로에 Rate Limiting 규칙** (예: IP당 분당 5회)을 반드시 추가하고,
  `ADMIN_PIN`은 **최소 6자리 이상**으로 설정할 것.
