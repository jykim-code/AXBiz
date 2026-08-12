// scripts/refresh-dart-corps.mjs
//   DART 전체 법인 목록(corpCode.xml)을 내려받아 public/assets/dart-corps.txt 를 갱신한다.
//   관리자 'DART 연결' 탭의 자동완성이 이 정적 파일을 읽으므로, 신규 등록·사명 변경 법인을
//   검색하려면 주기적으로 돌려야 한다(예: 분기 1회).
//
//   실행:  node scripts/refresh-dart-corps.mjs
//          node scripts/refresh-dart-corps.mjs --check    (내려받아 비교만, 파일은 쓰지 않음)
//
//   키는 DART_API_KEY 환경변수 또는 .dev.vars 에서 읽는다(값은 출력하지 않는다).
//   사내 프록시에서 TLS 검사에 걸리면 NODE_TLS_REJECT_UNAUTHORIZED=0 을 붙여 실행한다.
//
//   출력 형식: `corp_code \t corp_name \t stock_code` (종목코드 없으면 빈 값), UTF-8.
//   corpCode.xml 의 corp_name 은 company.json 의 법인명보다 짧은 통용명이다
//   (예: corpCode 'LG씨엔에스' vs company '(주)엘지씨엔에스'). 검색 편의를 위해 그대로 쓴다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets', 'dart-corps.txt');
const DART_URL = 'https://opendart.fss.or.kr/api/corpCode.xml';
const checkOnly = process.argv.includes('--check');

function readKey() {
  if (process.env.DART_API_KEY) return process.env.DART_API_KEY.trim();
  const devVars = join(ROOT, '.dev.vars');
  if (existsSync(devVars)) {
    for (const line of readFileSync(devVars, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*DART_API_KEY\s*=\s*(.*)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

// ZIP 한 개 엔트리를 꺼낸다. 중앙 디렉터리를 먼저 읽어야 압축 크기를 확실히 알 수 있다
// (로컬 헤더는 스트리밍 저장 시 크기가 0으로 남는 경우가 있다).
function unzipSingle(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP_EOCD_NOT_FOUND');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error('ZIP_CD_BAD_SIGNATURE');
  const method = buf.readUInt16LE(cdOffset + 10);
  const compSize = buf.readUInt32LE(cdOffset + 20);
  const nameLen = buf.readUInt16LE(cdOffset + 28);
  const extraLen = buf.readUInt16LE(cdOffset + 30);
  const commentLen = buf.readUInt16LE(cdOffset + 32);
  const localOffset = buf.readUInt32LE(cdOffset + 42);
  const entryName = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);
  void extraLen; void commentLen;

  if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('ZIP_LOCAL_BAD_SIGNATURE');
  const lNameLen = buf.readUInt16LE(localOffset + 26);
  const lExtraLen = buf.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + lNameLen + lExtraLen;
  const data = buf.subarray(dataStart, dataStart + compSize);
  if (method === 0) return { entryName, xml: data.toString('utf8') };
  if (method === 8) return { entryName, xml: inflateRawSync(data).toString('utf8') };
  throw new Error('ZIP_UNSUPPORTED_METHOD ' + method);
}

// XML 엔티티를 되돌린다. 안 하면 '삼천리M&C' 가 '삼천리M&amp;C' 로 저장돼
// 관리자 검색에서 안 잡히고, 이전 스냅샷과 비교할 때 전부 사명변경으로 오탐된다.
function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&'); // 이중 디코드를 막으려 마지막에 처리
}

function parseCorps(xml) {
  const out = [];
  const re = /<list>([\s\S]*?)<\/list>/g;
  const pick = (block, tag) => {
    const m = block.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'));
    return m ? decodeXml(m[1]).trim() : '';
  };
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const code = pick(b, 'corp_code');
    const name = pick(b, 'corp_name').replace(/[\t\r\n]+/g, ' ').trim();
    const stock = pick(b, 'stock_code').replace(/\s+/g, '');
    if (code && name) out.push({ code, name, stock });
  }
  return out;
}

function loadExisting() {
  if (!existsSync(OUT)) return new Map();
  const map = new Map();
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const p = line.split('\t');
    map.set(p[0], { name: p[1] || '', stock: (p[2] || '').trim() });
  }
  return map;
}

const key = readKey();
if (!key) {
  console.error('DART_API_KEY 를 찾을 수 없습니다. 환경변수로 넘기거나 .dev.vars 에 넣어 주세요.');
  process.exit(1);
}

console.log('DART corpCode.xml 내려받는 중…');
const res = await fetch(`${DART_URL}?crtfc_key=${encodeURIComponent(key)}`, {
  headers: { 'User-Agent': 'AXBizRadar/1.0' }, // UA 없으면 DART 가 비-JSON/차단 응답을 준다
});
if (!res.ok) {
  console.error('내려받기 실패: HTTP', res.status);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
// 키 오류 등은 ZIP 대신 XML 로 온다.
if (buf.subarray(0, 2).toString('latin1') !== 'PK') {
  const head = buf.toString('utf8', 0, 300);
  const status = head.match(/<status>(\d+)<\/status>/);
  const msg = head.match(/<message>([\s\S]*?)<\/message>/);
  console.error('ZIP 이 아닌 응답입니다. status=' + (status ? status[1] : '?') + ' message=' + (msg ? msg[1] : head.slice(0, 120)));
  process.exit(1);
}

const { entryName, xml } = unzipSingle(buf);
const corps = parseCorps(xml);
console.log(`압축 해제: ${entryName} (${(xml.length / 1e6).toFixed(1)}MB) → 법인 ${corps.length.toLocaleString()}건, 상장 ${corps.filter((c) => c.stock).length.toLocaleString()}건`);
if (corps.length < 100000) {
  console.error('법인 수가 비정상적으로 적습니다(' + corps.length + '). 파싱을 확인하세요.');
  process.exit(1);
}

// 이전 스냅샷과 비교 — 무엇이 바뀌는지 눈으로 확인하고 커밋한다.
const before = loadExisting();
const added = [], renamed = [], listedChanged = [];
for (const c of corps) {
  const old = before.get(c.code);
  if (!old) { added.push(c); continue; }
  if (old.name !== c.name) renamed.push({ code: c.code, from: old.name, to: c.name });
  if (old.stock !== c.stock) listedChanged.push({ code: c.code, name: c.name, from: old.stock || '(없음)', to: c.stock || '(없음)' });
}
const removed = [...before.keys()].filter((code) => !corps.some((c) => c.code === code));
console.log(`\n이전 ${before.size.toLocaleString()}건 대비: 신규 ${added.length} / 사명변경 ${renamed.length} / 종목코드변경 ${listedChanged.length} / 사라짐 ${removed.length}`);
const show = (label, arr, fmt) => {
  if (!arr.length) return;
  console.log(`\n[${label}] 앞 15건`);
  arr.slice(0, 15).forEach((x) => console.log('   ' + fmt(x)));
};
show('신규', added, (c) => `${c.code} ${c.stock || '------'} ${c.name}`);
show('사명변경', renamed, (r) => `${r.code} ${r.from} → ${r.to}`);
show('종목코드변경', listedChanged, (r) => `${r.code} ${r.name}: ${r.from} → ${r.to}`);

if (checkOnly) { console.log('\n--check 이므로 파일은 쓰지 않았습니다.'); process.exit(0); }

writeFileSync(OUT, corps.map((c) => `${c.code}\t${c.name}\t${c.stock}`).join('\n') + '\n', 'utf8');
console.log(`\n${OUT} 갱신 완료 (${corps.length.toLocaleString()}건). git diff 로 확인 후 커밋하세요.`);
