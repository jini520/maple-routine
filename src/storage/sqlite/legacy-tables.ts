/**
 * DB 버전 23 이 지우는 옛 표 여섯의 정의. 버전 23 전 DB 에서 앞 버전 이관이 읽을 모양을 만들 때만 쓴다.
 *
 * 이관 전용이라 고치지 않는다. v1.0.13 을 건너뛰고 올라오는 기기와 새 기기가 버전 1 부터 이 모양을 읽는다.
 */
import { BOSS_DROP_RECORDS_BODY, BOSS_PARTY_SETTINGS_BODY, BOSS_PROFIT_RECORDS_BODY } from './boss-tables'

/**
 * `income_records` 의 **본문 한 벌**. `CREATE TABLE` 이 두 자리에서 같은 것을 쓴다. 아래 정의
 * 배열(옛 표 만들기)과 `db.ts` 의 `rebuildIncomeRecords`(재작성). 두 벌로 두면 재작성이 **옛 스키마를 다시
 * 만드는** 날이 오고, 그것이 정확히 이 파일이 겪은 결함의 모양이다.
 */
export const INCOME_RECORDS_BODY = `(
    id TEXT NOT NULL,
    -- NULL = 계정 단위가 기본이다. 통화가 귀속을 강제하지 않는다.
    ocid TEXT,
    earned_on TEXT NOT NULL, -- 'YYYY-MM-DD' KST
    category TEXT NOT NULL, -- 그때의 분류 이름. 아이템 판매 · 사냥 · 기타
    category_key TEXT, -- 분류 key. 버전 이관이 옛 행까지 채운다
    item TEXT, -- 그때의 이름. 판 것 / 사냥터 / 자유
    item_key TEXT, -- 사냥 기록의 사냥터 key. 다른 분류는 NULL
    -- **수수료를 뗀 값**이다. 캘린더도 합계도 이 칸 하나를 더한다.
    -- **NULL 이 될 수 있다**(이슈 #265): **기타**는 통화가 갈려서 **메소로 번 것이
    -- 아니다** 가 성립한다. 0 으로 채우면 **메소를 0 벌었다** 와 같아져 수정
    -- 시트가 찬 칸으로 통화를 되짚던 자리를 잃는다(지출이 먼저 같은 자리를 지났다.
    --). 처음엔 NOT NULL 이었고(수입이 메소뿐이던 시절)
    -- 그 제약이 메포·캐시 **기타**의 저장을 통째로 막았다. 이미 만들어진 테이블은 rebuildIncomeRecords 가 옮긴다.
    meso_amount INTEGER,
    -- 경매장 수수료(3·5. 의 FeePercent). NULL = 없음(직거래이거나 정정 9 이전 행).
    sale_fee_percent INTEGER,
    -- 뗀 몫. **판매 대금 = meso_amount + sale_fee_meso** 로 정확히 되짚는다. 내림이 섞여 있어
    -- 요율만으로는 역산이 안 된다.
    sale_fee_meso INTEGER,
    -- 1 이면 수수료가 등급을 따라간다(자동). 등급 기록이 바뀔 때 위 세 칸과 meso_amount 가 다시 적힌다.
    -- NULL 은 손으로 고른 값이거나 이 칸이 생기기 전 행이다.
    sale_fee_auto INTEGER,
    -- 통화 칸 셋. **기타**는 메포·캐시로도 들어오고, **지출과 같은 이름**을
    -- 써야 집계가 한 모양으로 접힌다(incomeMesoOf = spendMesoOf). 뜻과 단위는 spend_records 의
    -- 같은 이름 칸들과 같다. 시세는 1억 메소당 메포이고, 캐시는 환산하지 않는다.
    -- 이 셋은 정정 15 가 **ensureColumn 으로만** 붙여 CREATE 문에 없었다. 그 상태로는 재작성이
    -- 만드는 테이블에 칸이 모자라 이관이 그 자리에서 던진다. DDL 이 곧 **지금의 스키마** 여야 한다.
    point_amount INTEGER,
    point_per_100m_meso INTEGER,
    cash_amount INTEGER,
    -- 몇 회인가. **기타**만 쓰고 위 세 칸에는 **곱한 총액**이 들어간다.
    -- 수량을 안 남기면 수정 시트가 되짚을 길이 없어 수량 1 · 금액 = 총액 으로 열린다.
    -- NULL = 이 칸이 없던 시절의 행이고, 그 행도 같은 이유로 수량 1 로 연다.
    quantity INTEGER,
    -- **아이템 판매**의 종류 key(장비 · 소비 · 기타). 소비 · 기타면 quantity 가 곱한 수량이다.
    -- 다른 분류는 NULL 이다. NULL 인 판매 행은 이 칸 이전의 행이고 장비로 연다.
    item_kind_key TEXT,
    -- **사냥** 분류의 **계산 입력**. 합계만 남기면 수정 시트가 빈 계산기로
    -- 열려 만지는 순간 금액이 덮인다. 사냥터는 item 칸에 이름으로 들어간다
    -- (전역 유일이라 지역이 따라온다). **다른 분류에서는 전부 NULL** 이다.
    -- 캐릭터 레벨을 박는 이유는 캐릭터가 레벨업하기 때문이다. 지금 레벨로 다시 재면 한 달 전
    -- 기록의 금액이 열 때마다 달라진다.
    hunt_character_level INTEGER,
    hunt_missed_mobs INTEGER, -- 젠 한 번에 놓치는 마릿수(0~4). 효율 %는 맵이 정한다
    hunt_boosts TEXT, -- 켠 아이템 id 를 쉼표로. '' = 없음
    hunt_sojae INTEGER, -- 소재 수(하나가 30분)
    hunt_fragments INTEGER, -- 솔 에르다 조각 개수(사용자가 직접 넣는다. 결정 8)
    hunt_fragment_price INTEGER, -- 조각 개당 메소. NULL = 가격을 안 적었다 → 그 조각이 캐릭터 보관에 든다. 0 은 0 메소에 판 것
    hunt_meso_rate INTEGER, -- 그때의 캐릭터 메소 획득량(%). NULL = 이전 행 → 0 으로 읽는다
    -- 수동으로 적힌 사냥에서 사용자가 친 획득 메소. NULL 이 아니면 수동으로
    -- 적힌 행이고, 그때 위 계산기 칸 넷은 전부 NULL 이다. 0 과 NULL 이 갈린다. 조각만 먹은
    -- 사냥은 친 메소가 0 이면서 수동이다.
    hunt_typed_meso INTEGER,
    -- 안 쓰는 칸. 조각 보관은 hunt_fragment_price 의 NULL 이 가른다.
    -- 지우지 않는다. OTA 를 되돌린 옛 번들의 INSERT 가 이 칸을 적어서, 없으면 수입이 하나도 안 적힌다.
    hunt_fragments_deferred INTEGER,
    -- 유니온의 부 단계(1 · 2 · 3). NULL = 이 칸 이전의 계산기 행 → 3단계로 읽는다
    hunt_union_tier INTEGER,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
  )`

export const LEGACY_TABLE_DEFINITIONS = [
  {
    name: 'boss_profit_records',
    createSql: `CREATE TABLE IF NOT EXISTS boss_profit_records ${BOSS_PROFIT_RECORDS_BODY}`,
  },
  {
    name: 'boss_party_settings',
    createSql: `CREATE TABLE IF NOT EXISTS boss_party_settings ${BOSS_PARTY_SETTINGS_BODY}`,
  },
  // 미완료 보스 행에서 고친 그 기간만의 파티 인원·비율. 줄이 있으면 그 조합은 파티 관리 설정을
  // 안 따라간다. 기록 표에 못 넣는 이유는 그쪽에 줄이 생기면 그 조합이 완료로 읽혀서다.
  {
    name: 'boss_party_period_overrides',
    createSql: `CREATE TABLE IF NOT EXISTS boss_party_period_overrides (
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    -- 주간이면 주차, 월간이면 달. 이 칸이 주기를 겸해서 가른다.
    period_key TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    -- 결정석 분배 비율. NULL 은 '파티 인원으로 균등'이라 boss_party_settings 와 같은 뜻이다.
    crystal_my_share INTEGER,
    crystal_shares_total INTEGER,
    split_fee_percent INTEGER,
    -- 1 이면 송금 수수료가 등급을 따라간다(자동).
    split_fee_auto INTEGER,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (ocid, boss_key, difficulty, period_key)
)`,
  },
  // 보스별/기간별 드롭 기록. 한 보스가 여러 드롭을 가지므로 drop_index로 다중 행.
  // 금액도 여기 담는다. 기록 한 건에 붙는 실판매가다(반전). 같은 행에 두면
  // 난이도 확정 이관·prune 삭제가 가격까지 함께 옮기고 지운다.
  {
    name: 'boss_drop_records',
    createSql: `CREATE TABLE IF NOT EXISTS boss_drop_records ${BOSS_DROP_RECORDS_BODY}`,
  },
  // 가계부가 **손으로 적는** 둘. 앞의 넷과 갈리는 성질이 셋이다:
  //  ① **대리키다.** 앞의 넷은 자연키 복합 PK 인데 손입력은 **같은 날 같은 것을 두 번** 이 정상이라
  //     자연키가 성립하지 않는다.
  //  ② **날짜가 참이다.** 사용자가 직접 고르므로 `period_key`(주·월)가 아니라 날짜를 든다.
  //     그래서 캘린더 칸에 바로 설 수 있다(보스 기록은 #239 를 기다린다).
  //  ③ **API 가 없다.** 되살릴 길이 0% 라 데이터 삭제가 지우지 않는다.
  {
    name: 'income_records',
    createSql: `CREATE TABLE IF NOT EXISTS income_records ${INCOME_RECORDS_BODY}`,
  },
  {
    name: 'spend_records',
    createSql: `CREATE TABLE IF NOT EXISTS spend_records (
    id TEXT NOT NULL,
    ocid TEXT,
    spent_on TEXT NOT NULL, -- 'YYYY-MM-DD' KST
    -- 그때의 분류 이름. 컨텐츠 · 이벤트·BM · 버프 · 주문서 · 심볼 강화 · 아이템 구매 · 기타
    category TEXT NOT NULL,
    -- 분류 key. 버전 이관이 옛 행까지 채운다.
    category_key TEXT,
    -- 그때의 이름. key 로 카탈로그를 못 찾을 때 서는 글자다.
    item TEXT,
    -- 목록에서 고른 항목 key. 직접 친 기록과 에픽던전 리워드는 NULL.
    item_key TEXT,
    -- 같은 값을 두 형태로 받는 항목이 있다. 에픽던전 리워드는 **경험치** 와 **솔 에르다** 중 하나다
    -- (카탈로그의 **forms**). **가격이 같아서** 금액으로는 구분이 안 되므로 따로 적는다:
    -- 안 적으면 **솔 에르다를 몇 번 받았나** 를 나중에 되물을 수 없다. 형태가 없는 항목은 NULL.
    form TEXT,
    -- 에픽던전 리워드의 형태별 항목 key JSON. 새 기록은 form 대신 이 칸을 쓴다.
    form_item_keys TEXT,
    -- **아이템 구매**의 **종류**(장비·소비·기타). 이 값 하나가 수량과 관세를
    -- 함께 가른다: 소비·기타는 **월드 간 거래가 안 되어** 관세가 없다. NULL 은 다른 분류이거나
    -- **정정 1 이전 행**이고, 그 행은 장비로 연다(그때가 실제로 그 모양이었다).
    item_kind TEXT,
    -- 종류 key.
    item_kind_key TEXT,
    -- 심볼 강화의 강화 전 · 강화 후 레벨. 다른 분류는 NULL.
    level_from INTEGER,
    level_to INTEGER,
    -- 금액 = 카탈로그의 **unitPrice** × 이 값. 단위 이름은 안 적는다.
    -- 지출 카탈로그(서버 게임 데이터의 spendCatalog 칸)가 항목별로 알고 있어 베끼면 두 벌이 어긋난다.
    quantity INTEGER,
    -- 통화별 칸 셋. 안 쓴 칸은 NULL 이다.
    -- **관세를 포함한 총액**이라 집계는 이 한 칸만 보면 된다(정정 2 ②).
    meso_amount INTEGER,
    -- 그중 관세분. **집계에 더하지 말 것**. 이미 meso_amount 안에 있다. 요율을 안 박고 읽을 때
    -- 나누면 요율이 바뀌는 날 지난달 관세가 소급해 달라진다( 과 같은 이유).
    tariff_meso INTEGER,
    point_amount INTEGER,
    -- 메소마켓 시세. 단위가 **1억 메소당 메포**다(정정 2 ④). **meso_per_point** 라는 이름이었는데
    -- **거짓이었다**: 이 값으로 하는 것은 곱셈이 아니라 **나눗셈**이다(메포 × 1억 ÷ 시세).
    -- point_amount 가 있으면 NOT NULL 이어야 하고(정정 2 ③) 0 이면 안 된다.
    point_per_100m_meso INTEGER,
    -- **환산하지 않는다**(정정 2 ①). 그래서 짝이 되는 환율 칸이 없다. 현금과 게임 재화의 교환비가
    -- 실제로 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 그 경로에 값을 매기는
    -- 것처럼 읽힌다.
    cash_amount INTEGER,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
)`,
  },
] as const

/** 버전 23 이 지우는 옛 표 이름. */
export const LEGACY_TABLE_NAMES: readonly string[] = LEGACY_TABLE_DEFINITIONS.map((table) => table.name)
