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

-- DART 응답 캐시(회사개황+재무). corp_code 기준. 재무는 분기 갱신이라 공격적 캐시.
CREATE TABLE IF NOT EXISTS company_profile (
  corp_code  TEXT PRIMARY KEY,
  profile    TEXT,                             -- JSON: 회사개황
  financials TEXT,                             -- JSON: 주요 재무
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
