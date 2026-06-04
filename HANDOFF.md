# 이어서 작업 (Handoff) — 갱신 2026-06-04

> 현재 상태·결정·다음 단계 기록. 상세 진행은 `ROADMAP.md` 참고.

## 현재 상태
- **라이브**: https://ax-biz-radar.pages.dev  ·  **레포(Private)**: github.com/jykim-code/AXBiz
- **배포**: Cloudflare Pages(정적 `public/`) + Pages Functions(`functions/api/*`) + D1(`ax-biz-radar`)
- **완료**: 대시보드(날짜별), 관리자(/admin, PIN), 지식그래프(홈 레이더 Cytoscape), 탐색(/explore), 기업상세(/company), 의견(/feedback), Hancom CI, 사이드바
- **완료(신규)**: **RAG 시맨틱 검색** — 구현 + 프리뷰 배포 끝단 검증 완료. (임베딩·검색·생성·인용 정상)
- **남은 1스텝**: **운영(main) 배포** — 코드만 머지하면 라이브 동작(운영 시크릿·인덱스 준비됨).

## RAG — 구현된 형태 (확정)
- **검색**: Cloudflare **Vectorize** `ax-biz-radar-idx` (1024d / cosine). 계정 단일 인덱스(프리뷰·운영 공유).
- **임베딩**: Workers AI **`@cf/baai/bge-m3`** (1024d). `[ai]` 바인딩, 키 불필요.
- **생성**: OpenRouter **`deepseek/deepseek-v4-flash`** (`OPENROUTER_MODEL` env). 크레딧 보유 → 무료모델 제약 없음. 쿼리당 약 $0.0001.
- **벡터 구조**: id=`<date>#<companyIdx>`, metadata 경량(snippet=keyPoints[0]만). LLM 컨텍스트는 검색 후 D1 원본 재조회로 확보.
- **질의 흐름**: 질문 임베딩 → Vectorize 검색(cosine≥0.35, topK 8) → D1 원본 → `[n]` 번호 컨텍스트 → OpenRouter → `{answer, sources[]}`.
- **운영**: 질문 ≤500자 + **KV 고정 윈도우 Rate Limiting**(IP/분 10). ※ Pages는 `ratelimit` 바인딩 미지원이라 KV(`RL`)로 구현.
- **폴백**: `/explore`는 `/api/ask` 실패 시 기존 키워드 검색으로 자동 폴백, 태그 목록 유지.

### 엔드포인트
- `POST /api/ask`(공개) — 자연어 질의. `{question}` → `{answer, sources:[{n,name,date,category,sourceUrl,confluenceUrl}]}`
- `POST /api/reindex`(PIN) — 전체 백필.
- `POST /api/reports`(PIN) — 저장 + 증분 재색인(old delete→new upsert, best-effort).

## 선결 — 모두 해결됨 ✅
1. ~~토큰 권한~~ → `Vectorize Edit`+`Workers AI Read`+`Cloudflare Pages Edit` 추가 완료(토큰 Roll = 보안 rotate 동시 처리).
2. ~~`.dev.vars`~~ → `ADMIN_PIN` / `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`(=deepseek-v4-flash) 설정 완료. (`.env`엔 `CLOUDFLARE_API_TOKEN`만)
3. 운영(Production) Pages env: `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` 등록 완료. Preview env에도 3개(+ADMIN_PIN) 등록.

## 운영 배포 방법 (남은 스텝)
- `main` push → GitHub Actions(`.github/workflows/deploy.yml`)가 `wrangler pages deploy --branch=main`로 자동 배포.
- 또는 로컬에서 `npx wrangler pages deploy --branch=main`(로컬 토큰에 Pages Edit 있음).
- 배포 후 운영에서 한 번 `POST /api/reindex`(PIN) 호출하면 안전(인덱스는 이미 백필됨, 멱등).

## 환경 복구(다른 PC)
```
git clone https://github.com/jykim-code/AXBiz.git && cd AXBiz && npm install
# .env      : CLOUDFLARE_API_TOKEN (D1·Pages·Vectorize Edit + Workers AI Read)
# .dev.vars : ADMIN_PIN / OPENROUTER_API_KEY / OPENROUTER_MODEL=deepseek/deepseek-v4-flash
npm run d1:local   # 로컬 D1 스키마
npm run dev        # http://localhost:8788  (단, Vectorize/Workers AI는 로컬 에뮬레이션 없음 → RAG 검증은 배포에서)
```

## 검증 메모 (재현 시 주의)
- **Windows 터미널에서 curl `-d '{"question":"한글"}'` 금지** — 비-UTF8 코드페이지가 한글을 깨뜨려 모델이 "질문 인식 불가"로 오답. 검증은 **node fetch**(UTF-8) 또는 브라우저로.
- curl 사용 시 사내 프록시 SSL 때문에 `--ssl-no-revoke` 필요. node는 `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Vectorize upsert는 **비동기 색인** — 백필 직후 수십 초간 검색에 안 잡힐 수 있음(`wrangler vectorize info`로 vectorCount 확인).

## 🔐 보안 — 남은 권고
- Cloudflare 토큰은 Roll로 rotate됨 ✅. **OpenRouter API 키는 기존 키 재사용**(노출 이력 있음) → 여유 될 때 rotate 권장. `.env`/`.dev.vars`는 gitignore(커밋 금지).
