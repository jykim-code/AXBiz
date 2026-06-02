# AX Biz Radar

사내 AX 사업 활성화를 위한 **경쟁사 동향 대시보드**. 관리자가 일자별 보고서를 입력하면
모든 조회자가 동일 데이터를 즉시 본다.

- 좌측: 전체 기간 누적 **지식 그래프** + 통계(취합 데이터 / 추적 기업 / 분석일 / 태그)
- 우측: 분류별 **세로 스윔레인**(대기업 → 중견기업 → 스타트업·중소) 카드, 클릭 시 상세 펼침
- 하단: 월 **캘린더**(데이터 있는 날 하이라이트, 기본=최신일)
- 관리자: `/admin` (메인에 비노출, URL 직접 접근 + 숫자 PIN)

## 기술 스택
- 프론트: 바닐라 HTML/CSS/JS + Tailwind CDN (빌드 단계 없음)
- 저장소: **Cloudflare D1** (서버리스 SQLite)
- REST: **Cloudflare Pages Functions** (`functions/api/*`)
- 배포: Cloudflare Pages + GitHub 자동 배포

## 파일 구조
```
index.html              # 메인 대시보드
admin/index.html        # 관리자 입력 페이지 (/admin)
assets/js/
  util.js               # escapeHtml / safeUrl 등 출력 안전 유틸
  api.js                # /api/* fetch 래퍼
  dashboard.js          # 그래프·스윔레인·캘린더 렌더
  admin.js              # PIN 게이트·동적 폼·저장
functions/api/
  health.js             # GET /api/health
  dates.js              # GET /api/dates
  reports.js            # GET ?date= / POST upsert(PIN 검증)
  reports/all.js        # GET /api/reports/all (그래프·통계 누적)
schema.sql              # D1 테이블 생성
wrangler.toml           # Pages + D1 바인딩
.dev.vars.example       # 로컬 ADMIN_PIN 샘플
```

## REST API
| 메서드 | 경로 | 설명 | 보호 |
|--------|------|------|------|
| GET | `/api/health` | DB 바인딩 / ADMIN_PIN 점검 | 공개 |
| GET | `/api/dates` | 데이터 있는 날짜 배열(desc) | 공개 |
| GET | `/api/reports?date=YYYY-MM-DD` | 해당 날짜 companies | 공개 |
| GET | `/api/reports/all` | 전체 보고서(누적 집계용) | 공개 |
| POST | `/api/reports` | upsert(덮어쓰기). 본문 `{date, companies}` | `x-admin-pin` 헤더 |

`companies` 항목 스키마:
```json
{ "name": "", "category": "대기업|중견기업|스타트업·중소",
  "sourceUrl": "", "confluenceUrl": "",
  "keyPoints": [], "implications": [], "hancomInsight": [], "tags": [] }
```

## 로컬 개발
로컬 실행은 Cloudflare 로그인이 필요 없다(로컬 D1은 `.wrangler/`에 시뮬레이션됨).
```bash
npm install

# 1) 로컬 D1 에 스키마 적용
npm run d1:local

# 2) 환경변수 설정
cp .dev.vars.example .dev.vars   # ADMIN_PIN 값 수정

# 3) 로컬 실행 (http://localhost:8788)
npm run dev
```
> **wrangler v4 이상 필수.** v3 에서는 `d1:local` 과 `pages dev` 의 로컬 D1 저장 경로가
> 달라 "no such table: reports" 가 발생한다. `package.json` 은 v4 로 고정돼 있다.

검증 체크리스트:
- `GET /api/health` → `{ok:true, db:true, adminPin:true}`
- `/admin` PIN 입력 → 기업 추가/불릿 입력 → 저장 200, 틀린 PIN → 403
- `/` 최신일 자동 로드, 카드 펼침/접힘, 캘린더 날짜 전환, 그래프·통계 누적 표시
- 같은 날짜 재입력 → 덮어쓰기 반영

## 배포 (Cloudflare Pages)
0. (최초 1회) 원격 D1 생성 후 출력된 `database_id` 를 `wrangler.toml` 에 기입:
   ```bash
   npx wrangler login          # Cloudflare 인증
   npm run d1:create           # 반환된 database_id 를 wrangler.toml 에 붙여넣기
   ```
1. GitHub 레포 연결. 빌드 명령 없음, 출력 디렉터리 = 루트(`.`).
2. Pages 프로젝트 **Settings → Functions → D1 database bindings** 에 `DB` → `ax-biz-radar` 연결.
3. **Settings → Environment variables** 에 `ADMIN_PIN` 등록.
4. 원격 D1 에 스키마 적용:
   ```bash
   npm run d1:remote
   ```
5. 운영 URL 에서 위 검증 체크리스트 재확인.

## 보안 메모
- 쓰기(`POST`)는 서버에서 `ADMIN_PIN` 상수시간 비교로 검증 → 클라이언트 우회 불가.
- 출력은 `escapeHtml`(XSS) + `safeUrl`(http/https 절대 URL만)로 방어. `_headers` 로 CSP·`X-Frame-Options: DENY`·`nosniff` 등 보안 헤더 적용.
- 입력 상한: 본문 1MB / 기업 200개 / 불릿·태그 50개 / 문자열 길이 제한(이상 시 413).
- **[배포 필수] PIN 무차별 대입 방어**: 코드의 500ms 지연만으로는 병렬 공격을 못 막는다.
  Cloudflare 대시보드에서 **`POST /api/reports` 경로에 Rate Limiting 규칙**(예: IP당 분당 5회)을 반드시 추가하고,
  `ADMIN_PIN` 은 **최소 6자리 이상**으로 설정할 것.
- 향후 자동화 시 PIN 검증을 토큰 기반으로 교체(엔드포인트는 그대로 재사용).
