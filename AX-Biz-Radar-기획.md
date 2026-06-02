# AX Biz Radar — 구현 계획

## Context (왜 만드는가)
사내 AX 사업 활성화를 위해 매일 수행하는 "주요 경쟁사 동향 분석"을 채팅방 공유 대신
상시 접근 가능한 **웹 대시보드**로 제공한다. 관리자가 분석 내용을 입력하면 모든 조회자가
동일한 데이터를 즉시 본다(공유 서버 저장소 필수, localStorage 금지). 컨셉은 "레이더(radar)
관제 화면" — 시장 동향을 매일 스캔·탐지하는 느낌을 시각화한다.

향후 외부 자동화(API 자동 입력)와 지식 그래프 확장을 염두에 두고, **입력 경로를 REST
엔드포인트로 분리**하고 좌측 그래프 영역은 자리만 잡아둔다(이번 범위 제외).

## 확정된 기술 스택 (사용자 결정)
- **프론트엔드**: 바닐라 HTML/CSS/JS + Tailwind CDN (빌드 단계 없음). `Template/index.html`의
  디자인 토큰(Space Grotesk 디스플레이 / Inter 본문, 라운드 카드, 소프트 섀도, IntersectionObserver
  reveal)을 레이더 다크 테마로 계승.
- **저장소(DB)**: **Cloudflare D1** (서버리스 SQLite). Pages Functions에 바인딩으로 직접 접근.
- **백엔드/REST**: Cloudflare Pages Functions (서버리스). `env.DB`(D1 바인딩)로 쿼리 →
  외부 서비스·시크릿 키 불필요, 빌드 파이프라인 불필요, 순수 정적 + 함수 배포.
- **배포**: Cloudflare Pages + GitHub 레포 연동 자동 배포.
- **관리자 게이트**: 단순 숫자 PIN 입력. UX는 "숫자만 입력"으로 간단하게, **검증은 서버(Function)에서**
  `ADMIN_PIN` 환경변수와 대조 → 쓰기 보호 유지(클라이언트 우회 불가). 자동화 시 이 검증을 토큰으로 교체 예정.

## 아키텍처 개요
```
브라우저(정적 페이지)  ──fetch──>  Cloudflare Pages Functions(/api/*)  ──env.DB 바인딩──>  Cloudflare D1(SQLite)
  - 읽기: /api/dates, /api/reports?date=...   (공개)
  - 쓰기: POST /api/reports  (헤더 x-admin-pin 필요 → 서버 검증)
```
- D1은 Cloudflare 내부 바인딩이라 연결 시크릿이 없음. 유일한 시크릿은 `ADMIN_PIN`(환경변수).
- 읽기도 Function 경유 → 클라이언트에 DB 접근 정보를 일절 노출하지 않고 단일 REST 표면 유지.

## 데이터 모델 (Cloudflare D1 / SQLite)
단일 테이블. 날짜 PK + `companies` 배열을 JSON 문자열(TEXT)로 저장. `INSERT ... ON CONFLICT`
upsert로 "같은 날짜 재입력 시 덮어쓰기"를 자연스럽게 처리.
`schema.sql`로 제공(`wrangler d1 execute`로 1회 적용):
```sql
CREATE TABLE IF NOT EXISTS reports (
  date TEXT PRIMARY KEY,                 -- 'YYYY-MM-DD'
  companies TEXT NOT NULL DEFAULT '[]',  -- JSON 직렬화된 companies 배열
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
Function에서 `JSON.parse`/`JSON.stringify`로 직렬화. `companies` 항목 스키마(앱 레벨, 검증은 Function에서 최소 수준):
```json
{ "name","category","sourceUrl","confluenceUrl",
  "keyPoints":[],"implications":[],"hancomInsight":[],"tags":[] }
```
- `category` 허용값: "대기업" | "중견기업" | "스타트업·중소".
- tags는 지금은 저장만(추후 그래프용).
- 향후 태그/그래프 쿼리가 무거워지면 정규화 테이블로 확장 가능(이번엔 TEXT에 JSON 저장).

## REST 엔드포인트 (Pages Functions)
- `GET /api/dates` → 데이터가 있는 날짜 배열(desc). 캘린더 하이라이트 + 최신 기본값 산출용.
- `GET /api/reports?date=YYYY-MM-DD` → 해당 날짜 `companies` 배열(없으면 빈 배열).
- `POST /api/reports` → upsert. 헤더 `x-admin-pin` 검증 후 D1에 `INSERT ... ON CONFLICT(date)
  DO UPDATE`로 머지. 본문 `{ date, companies:[...] }`. **자동화 진입점**.
- (선택) `GET /api/health` → DB 바인딩 / `ADMIN_PIN` 설정 점검용.

## 페이지 / 파일 구조
```
index.html                  # 메인 대시보드
admin/index.html            # 관리자 페이지(/admin 클린 URL)
assets/
  css/radar.css             # 레이더 다크 테마 + 스코프 애니메이션 + 카드/캘린더 스타일
  js/api.js                 # fetch 래퍼(공통)
  js/dashboard.js           # 칸반 렌더, 캘린더, 카드 펼침/접힘, 날짜 로드
  js/admin.js               # PIN 게이트, 동적 기업/불릿 추가·삭제, submit
functions/
  api/
    dates.js                # GET 날짜 목록
    reports.js              # GET(?date) + POST(upsert, PIN 검증)
schema.sql                  # D1 테이블 생성 스크립트(wrangler d1 execute)
wrangler.toml               # pages 프로젝트 + D1 바인딩(binding="DB") 설정
.dev.vars.example           # 로컬 환경변수 샘플(ADMIN_PIN)
package.json                # wrangler devDependency + dev/d1 스크립트
README.md                   # D1·Cloudflare·GitHub 배포·환경변수 셋업 가이드
```

## 메인 대시보드 ( / ) — 레이아웃 (한 화면)
- **상단 헤더(고정)**: 좌측에 레이더 스코프 모티프(동심원 + 회전 스윕 라인, 은은한 오렌지 글로우),
  서비스명 **AX Biz Radar**, 태그라인 "AX 레이더 : 시장의 동향 포착에서 인사이트까지", 우측에 현재 선택 날짜 표시.
- **본문 (뷰포트 채움)**:
  - **좌측(~28%)**: 지식 그래프 자리 — "준비 중" 플레이스홀더 + 레이더 스코프(블립 점들).
    이번엔 그래프 미구현, 영역만 확보.
  - **우측**: 칸반 3컬럼 **대기업 / 중견기업 / 스타트업·중소 (순서 고정)**. 각 컬럼 독립 스크롤.
    - 기업 카드: 기업명 + 분류 배지 / 요약(접힘) → 클릭 시 펼침으로 상세 표시.
    - 상세: 주요 내용(불릿), 시사점(불릿), **한컴 인사이트(불릿, 오렌지 강조)**, 출처 기사 링크,
      상세 모니터링(Confluence) 링크, tags 칩.
- **하단**: 컴팩트 월 캘린더. 데이터 있는 날짜는 오렌지 블립/하이라이트. 날짜 클릭 → 우측 칸반 갱신.
  진입 시 기본값 = 최신 날짜(`/api/dates`의 첫 값).

## 관리자 페이지 ( /admin )
- 진입 시 **숫자 PIN 입력 게이트**. 입력값은 이후 쓰기 요청의 `x-admin-pin` 헤더로 전송,
  서버 Function이 `ADMIN_PIN`과 대조(오답 시 403). PIN은 세션 동안 `sessionStorage` 보관(서버 검증이
  본질이므로 클라 저장은 편의용).
- **폼**: 날짜 선택 + "기업 추가" 반복 블록. 각 기업 블록:
  - 기업명, 분류(셀렉트), 출처 링크, Confluence 링크
  - 주요 내용 / 시사점 / 한컴 인사이트: 각각 **불릿 동적 추가·삭제**
  - tags(쉼표 구분, 선택)
- 기존 날짜 선택 시 해당 데이터를 폼에 로드하여 **수정/덮어쓰기** 가능.
- Submit → `POST /api/reports` → 성공 시 토스트 + 대시보드 즉시 반영(같은 데이터 소스).

## 디자인 디테일 (레이더 컨셉)
- **컬러**: 포인트 한컴 오렌지 `#fc5e20`(강조·액션·스윕·블립), 베이스 그레이 `#efeff0`(카드/라이트 영역),
  관제 다크 베이스(예: `#0b0f14`/`#0e1419` 계열). 레이더 요소에 한해 네온·글로우 허용.
- **가독성 우선**: 카드 본문·텍스트는 차분하게(다크 위 밝은 텍스트 또는 그레이 카드 위 ink 텍스트),
  화려함이 정보 가독성을 해치지 않게.
- **레이더 스코프**: SVG 동심원 그리드 + `conic-gradient` 스윕을 `@keyframes`로 느리게 회전
  (≈8–12s, prefers-reduced-motion 존중), 오렌지 글로우, 임의 위치 블립 점 점멸.
- **모티프 재사용**: 동심원/격자/블립을 헤더·좌측 패널 악센트로. 카드 라운드(24–28px)·소프트 섀도·
  hover lift·reveal 애니메이션은 `Template/index.html`에서 계승.
- Tailwind CDN + 인라인 `tailwind.config`로 `hancom`/`gray-base`/`radar-dark` 컬러와 폰트 등록.

## 환경변수 / 바인딩
- **D1 바인딩** `DB` — `wrangler.toml`의 `[[d1_databases]]`로 연결(시크릿 아님).
- `ADMIN_PIN` — 관리자 숫자 PIN (Cloudflare Pages 환경변수 / 로컬 `.dev.vars`).

## 검증 (Verification)
1. **D1 생성**: `npx wrangler d1 create ax-biz-radar` → 반환된 database_id를 `wrangler.toml`에 기입.
   `npx wrangler d1 execute ax-biz-radar --local --file=./schema.sql`로 테이블 생성.
2. **로컬 실행**: `npm i` 후 `npx wrangler pages dev .` (`.dev.vars`에 `ADMIN_PIN` 설정).
   - `GET http://localhost:8788/api/health` → ok.
   - `/admin` 접속 → PIN 입력 → 샘플 보고서(스키마 예시: 삼성SDS 등) 입력 → Submit 200.
   - 틀린 PIN → 403 확인.
   - `GET /api/dates`에 입력 날짜 포함, `GET /api/reports?date=...`로 데이터 반환 확인.
   - `/` 접속 → 최신 날짜 자동 로드, 3컬럼 칸반에 카드 정상 표시, 카드 펼침/접힘, 캘린더에서
     데이터 날짜 하이라이트 및 다른 날짜 클릭 시 칸반 갱신 확인.
   - 같은 날짜 재입력 → 덮어쓰기 반영 확인.
3. **반응형/모션**: 좁은 화면 레이아웃, prefers-reduced-motion 시 스윕 정지 확인.
4. **배포**: GitHub 레포 push → Cloudflare Pages 자동 빌드(빌드 명령 없음, 출력 디렉터리 루트).
   Pages 프로젝트에 D1 바인딩(`DB`) 연결 + 환경변수 `ADMIN_PIN` 설정 →
   원격 D1에 `wrangler d1 execute ... --remote --file=./schema.sql`로 스키마 적용 →
   운영 URL에서 위 시나리오 재검증.

## 이번 범위 / 제외
- 포함: 메인 대시보드(칸반+캘린더), 관리자 입력 페이지, D1 저장/조회 REST, 레이더 테마, 배포 가이드.
- 제외(추후): 지식 그래프 UI(좌측 자리만), 정식 인증(현재는 PIN), 태그 기반 그래프 쿼리.
