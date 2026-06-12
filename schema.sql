-- AX Biz Radar — Cloudflare D1 (SQLite) schema
-- 적용: npx wrangler d1 execute ax-biz-radar --local  --file=./schema.sql
--       npx wrangler d1 execute ax-biz-radar --remote --file=./schema.sql

-- date 가 PRIMARY KEY 이므로 ORDER BY date DESC 는 PK 인덱스 역방향 스캔으로 처리됨.
-- 별도 인덱스 불필요.
CREATE TABLE IF NOT EXISTS reports (
  date       TEXT PRIMARY KEY,                 -- 'YYYY-MM-DD'
  companies  TEXT NOT NULL DEFAULT '[]',       -- JSON 직렬화된 companies 배열
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 조회자 의견(제안) 접수함. 공개 POST 로 적재, 관리자(PIN)가 GET 으로 열람.
CREATE TABLE IF NOT EXISTS suggestions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type       TEXT NOT NULL,                    -- 기업 추가 요청 / 내용 추가·수정 / 오류 제보 / 기타
  company    TEXT,                             -- 관련 기업명(선택)
  content    TEXT NOT NULL,                    -- 의견 내용
  team       TEXT,                             -- 소속 팀(선택)
  name       TEXT,                             -- 작성자 이름(선택)
  status     TEXT NOT NULL DEFAULT 'new'       -- new / handled
);

-- 기업 ↔ DART corp_code 매핑(수동 진실원). 표시 기업명 기준.
--  - corp_code 없으면(해외/미지정) 회사정보·재무 미제공.
CREATE TABLE IF NOT EXISTS company_meta (
  name       TEXT PRIMARY KEY,                 -- reports.companies[].name 과 매칭
  corp_code  TEXT,                             -- DART corp_code (8자리), NULL=미지정
  overrides  TEXT,                             -- 회사정보 보정 JSON(예: {"ceo":"..."}) — DART 오류·관리자 수정용
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 전역 설정 (key-value). 예: pinned_tags = 지식그래프 고정 핀 태그 JSON 배열
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 기업별 타임라인 파생 테이블 (Phase 2: 타임라인 인지 RAG).
--   reports(원본)에서 파생 — 기업 한 곳의 dated 항목을 인덱스로 빠르게 조회.
--   동기화: reports 저장(/api/reports POST)·컨플 가져오기 시. 재구축: scripts 백필.
CREATE TABLE IF NOT EXISTS company_entries (
  company  TEXT NOT NULL,                      -- 기업 표시명
  date     TEXT NOT NULL,                      -- 'YYYY-MM-DD'
  category TEXT,
  data     TEXT NOT NULL,                      -- 그 (기업×날짜) 항목 JSON
  PRIMARY KEY (company, date)
);
CREATE INDEX IF NOT EXISTS idx_company_entries_company_date ON company_entries(company, date DESC);

-- 기업별 AI 요약 캐시(핵심 흐름 + 종합 한컴 인사이트). source_hash 로 데이터 변경 감지 → lazy 재생성.
CREATE TABLE IF NOT EXISTS company_summary (
  name        TEXT PRIMARY KEY,                -- 기업 표시명
  flow        TEXT,                            -- JSON [{period,text}]
  insight     TEXT,                            -- JSON [text]
  source_hash TEXT,                            -- hash(프롬프트버전 + 그 기업 전체 항목)
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 기간(주/월) 종합 캐시. 홈 대시보드 카드 펼침 시 LLM 1~2문장 종합.
--  ck = 기업명|시작|끝|항목sig (항목 변경 시 자동 갱신)
CREATE TABLE IF NOT EXISTS period_summary (
  ck         TEXT PRIMARY KEY,
  summary    TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- dev 검수 드래프트. 컨플 가져오기 → draft 적재 → /dev 프리뷰 검수 → 배포 시 reports 로 승격.
--   라이브(reports)는 published 만 노출. 프리뷰는 published+draft 합본(PIN).
CREATE TABLE IF NOT EXISTS draft_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,                 -- 'YYYY-MM-DD'
  company     TEXT NOT NULL,
  category    TEXT,
  data        TEXT NOT NULL,                 -- JSON: 기업 항목(name,category,summary,sourceUrl,confluenceUrl,keyPoints[],implications[],hancomInsight[],tags[])
  source      TEXT,                          -- 'confluence' | 'manual'
  source_ref  TEXT,                          -- 컨플 pageId/URL
  status      TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_dcs ON draft_entries(date, company, source) WHERE status='draft';
CREATE INDEX IF NOT EXISTS idx_draft_status_date ON draft_entries(status, date DESC);

-- DART 응답 캐시(회사개황+재무). corp_code 기준. 재무는 분기 갱신이라 공격적 캐시.
CREATE TABLE IF NOT EXISTS company_profile (
  corp_code  TEXT PRIMARY KEY,
  profile    TEXT,                             -- JSON: 회사개황
  financials TEXT,                             -- JSON: 주요 재무
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
