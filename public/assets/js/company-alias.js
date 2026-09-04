/* 기업 검색 별칭 — 사용자가 실제로 입력하는 표기(한글 음차·영문·약칭·옛 사명)를 정식 사명에 연결한다.
   화면에는 노출하지 않고 검색에만 쓴다. 태그로 넣으면 카드·지식그래프에 그대로 드러나 목록이 지저분해진다.

   진실원은 D1 company_meta.aliases 이고, 관리자 페이지(DART 매핑 탭)에서 편집한다.
   아래 사전은 그 초기값(시드)이자 폴백이다 — /api/company-aliases 가 실패해도 검색이 죽지 않는다.
   D1 에 그 기업 행이 있으면 D1 값이 이긴다(빈 배열이면 별칭 없음). applyCompanyAliases() 참고.

   규칙
   - 키는 보고서 데이터의 companies[].name 과 정확히 같아야 한다(다르면 그 줄은 그냥 무시된다).
   - 대소문자·공백·중점·하이픈 차이는 검색 쪽에서 흡수하므로(tagNormKey), 여기서는 읽기 쉬운 형태로 적는다.
   - 정식명에 이미 들어 있는 문자열은 넣을 필요가 없다('삼성전자'에 '삼성', 'SK AX'에 'SK').
   - 제품·모델명은 그 이름으로 기업을 찾는 사람이 많은 것만 넣는다(엑사원, 솔라, 챗GPT). */
const COMPANY_ALIAS = {
  /* 해외 */
  'NVIDIA': ['엔비디아'],
  'Microsoft': ['마이크로소프트', 'MS', '마소', '애저', 'Azure'],
  'Google': ['구글', '알파벳', 'Alphabet', '딥마인드', 'DeepMind', '제미나이', 'Gemini'],
  'OpenAI': ['오픈AI', '오픈에이아이', '챗GPT', 'ChatGPT'],
  'Anthropic': ['앤스로픽', '앤트로픽', '안트로픽', '클로드', 'Claude'],
  'AWS': ['아마존웹서비스', '아마존', 'Amazon', '에이더블유에스'],
  'IBM': ['아이비엠'],
  '일본IBM': ['IBM Japan', 'IBM재팬', '일본아이비엠'],
  '한국IBM': ['IBM Korea', 'IBM코리아', '한국아이비엠'],
  'Cloudflare': ['클라우드플레어', '클플'],
  'Cohere': ['코히어'],
  'Mistral AI': ['미스트랄', 'Mistral'],
  'DeepSeek': ['딥시크', '딥식'],
  'OpenClaw': ['오픈클로'],  // 개인 오픈소스 프로젝트(제작자 피터 스타인버거), 분류는 스타트업·중소
  'ServiceNow': ['서비스나우', '서비스노우'],
  'EDB': ['EnterpriseDB', '엔터프라이즈DB', '이디비', '포스트그레', 'Postgres'],
  '문샷 AI': ['문샷', 'Moonshot', '키미', 'Kimi'],
  '메타': ['Meta', '페이스북', 'Facebook', '인스타그램', '라마', 'Llama'],
  '세일즈포스': ['Salesforce'],
  '퍼플렉시티': ['Perplexity'],
  '일레븐랩스': ['ElevenLabs', '11Labs'],
  '알리바바': ['Alibaba', '알리', '큐원', 'Qwen'],
  '샤오미': ['Xiaomi'],

  /* 국내 대기업·계열 */
  '삼성전자': ['Samsung', 'Samsung Electronics'],
  '삼성SDS': ['삼성에스디에스', 'Samsung SDS'],
  'LG': ['엘지'],
  'LG전자': ['엘지전자', 'LG Electronics'],
  'LG CNS': ['엘지CNS', '엘지씨엔에스'],
  'LG유플러스': ['엘지유플러스', 'LGU+', 'LG U+', '유플러스', 'LG Uplus'],
  'LG AI연구원': ['엘지AI연구원', '엑사원', 'EXAONE'],
  'SK그룹': ['에스케이그룹'],
  'SK텔레콤': ['SKT', '에스케이텔레콤', 'SK Telecom', '에이닷'],
  'SK AX': ['에스케이AX', 'SK C&C', '에스케이씨앤씨'],  // 옛 사명 SK C&C
  'KT': ['케이티'],
  'KT DS': ['케이티디에스', 'KT디에스'],
  '네이버': ['Naver'],
  '네이버클라우드': ['Naver Cloud', 'NCP'],
  '카카오': ['Kakao'],
  '다음': ['Daum'],
  '현대차그룹': ['현대자동차', '현대차', '현대자동차그룹', 'Hyundai'],
  '현대오토에버': ['오토에버', 'Hyundai Autoever', 'Autoever'],
  '포스코DX': ['포스코디엑스', 'POSCO DX', '포스코ICT'],  // 옛 사명 포스코ICT
  '롯데': ['Lotte'],
  'GS건설': ['지에스건설', 'GS E&C'],
  '우리은행': ['우리금융', 'Woori'],
  '폴라리스그룹': ['폴라리스', '폴라리스오피스', 'Polaris'],
  '삼성생명': ['삼성생명보험', 'Samsung Life'],
  'KB증권': ['케이비증권', 'KB Securities', '깨비AI'],
  'NC AI': ['엔씨AI', '엔씨소프트', 'NCSOFT', '바르코', 'VARCO'],
  'NC AX': ['엔씨AX', '엔씨에이엑스', 'NC IDS', '엔씨아이디에스'],  // 옛 사명 NC IDS
  '파수 AI': ['파수', 'Fasoo'],

  /* 스타트업·중소 */
  '업스테이지': ['Upstage', '솔라', 'Solar'],
  '리벨리온': ['Rebellions'],
  '퓨리오사AI': ['퓨리오사', 'FuriosaAI', 'Furiosa'],
  '뤼튼테크놀로지스': ['뤼튼', 'Wrtn'],
  '코난테크놀로지': ['코난', 'Konan'],
  '이스트소프트': ['ESTsoft', 'EST소프트'],
  '야놀자': ['Yanolja'],
  '포티투마루': ['42Maru', '포티투 마루'],
  '올거나이즈': ['Allganize'],
  '라이너': ['Liner'],
  '메가존클라우드': ['메가존', 'Megazone'],
  '마키나락스': ['MakinaRocks'],
  '노타': ['Nota', '노타AI'],
  '마인드로직': ['Mindlogic'],
  '셀렉트스타': ['Selectstar', '다투모', 'DATUMO'],
  '아크릴': ['Acryl'],
  '인이지': ['INEEJI'],
  '허드슨에이아이': ['허드슨', 'HudsonAI', 'Hudson AI'],
  '와이즈에이아이': ['와이즈AI', 'WiseAI', 'Wise AI'],
  '위세아이텍': ['위세', 'WISEiTECH'],
  '지오영': ['GeoYoung'],
  '플래티어': ['Plateer'],
  '피씨엔': ['PCN'],
  '플리토': ['Flitto'],
  '한국딥러닝': ['딥옵스', 'DEEP Ops'],  // 확인된 영문 사명 표기가 없어 제품명만 둔다
  'BHSN': ['비에이치에스엔'],
  // '클라이온' — 확인된 영문·약칭 표기가 없어 비워 둔다. 확인되면 여기에 추가.
};

/* 표기 정규화는 ontology.js 의 tagNormKey 를 쓴다. 다만 관리자 페이지는 사전만 읽으려고
   이 파일을 싣고 ontology.js 는 싣지 않으므로, 없을 때를 대비해 같은 규칙을 한 번 더 둔다. */
function aliasNormKey(s) {
  if (typeof tagNormKey === 'function') return tagNormKey(s);
  return String(s == null ? '' : s).toLowerCase().replace(/[\s·・\-_,.，、/()]/g, '');
}

/* D1(/api/company-aliases)에서 받은 별칭. 그 기업 항목이 있으면 시드 사전 대신 이것을 쓴다.
   행이 없는 기업은 시드 사전을 그대로 쓰므로, 관리자가 손대지 않은 기업도 검색이 된다. */
let ALIAS_FROM_DB = null;
function applyCompanyAliases(map) {
  ALIAS_FROM_DB = map && typeof map === 'object' && !Array.isArray(map) ? map : null;
}
function aliasesFor(name) {
  if (ALIAS_FROM_DB && Object.prototype.hasOwnProperty.call(ALIAS_FROM_DB, name)) {
    const list = ALIAS_FROM_DB[name];
    return Array.isArray(list) ? list : [];
  }
  return COMPANY_ALIAS[name] || [];
}

/* 검색어가 기업명 또는 별칭에 걸리는가.

   정식명은 부분 일치를 허용한다 — '유플러스' → LG유플러스, 'IBM' → 한국IBM·일본IBM,
   '삼성' → 삼성전자·삼성SDS 처럼 계열을 함께 보여주는 것이 자연스럽다.

   별칭은 앞부분 일치만 허용한다. 별칭에까지 부분 일치를 허용하면 엉뚱한 기업이 끌려온다.
     'kt' → 'SKT'(SK텔레콤) / 'ms' → 'Samsung'(삼성전자) / 'lg' → 'Allganize'(올거나이즈)
   공백·기호를 지운 형태(tagNormKey)도 같은 이유로 앞부분 일치만 본다 — 'ktds' → 'KT DS' 는 살리고,
   'SK Telecom' → 'sktelecom' 이 'kt' 검색에 걸리는 것은 막는다. */
function matchesCompanyName(name, q) {
  const raw = String(q == null ? '' : q).trim().toLowerCase();
  if (!raw) return false;
  const key = tagNormKey(q);
  if (String(name).toLowerCase().includes(raw)) return true;
  if (key && tagNormKey(name).startsWith(key)) return true;
  return aliasesFor(name).some((a) => {
    const alias = String(a).toLowerCase();
    return alias.startsWith(raw) || (key && tagNormKey(a).startsWith(key));
  });
}
