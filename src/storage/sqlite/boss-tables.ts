/**
 * 보스 기록 표의 본문. 세 무리다.
 *
 * 1. 버전 14 전의 옛 표 셋(`BOSS_PROFIT_RECORDS_BODY` 등). 버전 4 · 12 가 이 본문으로 표를 다시 만들어서 그 모양 그대로 둔다.
 *    버전 23 이 지운다.
 * 2. 버전 14 가 만든 표 셋(`BOSS_PARTIES_BODY` · `BOSS_PARTY_PERIODS_BODY` · `PERIOD_BOSS_DROPS_BODY`). 1.0.15 기기 변환 전의 DB 가
 *    이 모양이고, 변환 전 DB 를 열 때와 앞 버전 이관이 쓴다. 변환이 3 으로 옮긴 뒤 지운다.
 * 3. 1.0.15 기기 변환이 만드는 표 셋(`BOSS_SPLIT_SETTINGS_BODY` · `BOSS_PROFIT_ENTRIES_BODY` · `BOSS_DROPS_BODY`). 지금 읽고 쓰는
 *    표이고, 칸 이름이 서버 표와 같다. 서버는 캐릭터를 줄 id 로 가리키고 기기는 `ocid` 로 가리킨다.
 */

export const BOSS_PROFIT_RECORDS_BODY = `(
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    cycle TEXT NOT NULL,
    period_key TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    price_meso INTEGER NOT NULL,
    payout_meso INTEGER NOT NULL,
    -- 그 건의 분배 비율과 수수료율 스냅샷. NULL 은 균등이라 옛 행이 그대로 맞는다.
    crystal_my_share INTEGER,
    crystal_shares_total INTEGER,
    split_fee_percent INTEGER,
    -- 1 이면 송금 수수료가 등급을 따라간다(자동). 등급 기록이 바뀔 때 split_fee_percent 와 payout_meso 가 다시 적힌다.
    split_fee_auto INTEGER,
    recorded_at TEXT NOT NULL,
    -- 기록 시점의 월드 스냅샷. NULL이면 "월드 모름"이고 월드별 결정석 집계에서
    -- 제외된다. 월드를 파생값(캐시된 character/basic)으로 두면 월드 리프가 모든 과거 주의 귀속을
    -- 소급 이동시킨다. 분모(90 x 월드 수)까지 바뀐다.
    world TEXT,
    -- 월드 key. 결정석 집계가 이 값으로 가른다. world 가 NULL 이면 함께 NULL 이다.
    world_key TEXT,
    -- 처치 **날짜**(KST YYYY-MM-DD). period_key 는 주(목요일)·달이라 "며칟날" 을 못 든다.
    -- NULL 은 "모름" 이고 가계부의 월간 칸 집계에서 조용히 빠진다(world 와 같은 모양). 키가
    -- 아니므로 나중에 채워 넣어도 옛 행이 움직이지 않는다.
    defeated_on TEXT,
    -- 누가 썼나. 'auto' 는 동기화가 쓴 기록이고 'manual' 은 사용자가 직접 적은 완료다.
    -- NULL 은 칸이 생기기 전의 기록이라 'auto' 로 읽는다.
    source TEXT,
    PRIMARY KEY (ocid, boss_key, difficulty, period_key)
  )`

export const BOSS_PARTY_SETTINGS_BODY = `(
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    -- 결정석 분배 비율. 셋 다 nullable 이고 NULL 은 '파티 인원으로 균등'이다. 그래서 칸이 붙기
    -- 전의 행이 그대로 맞고 이관이 없다. 아이템 비율은 이 표에 없다 - 아이템은 건마다 값이 달라
    -- 드롭 기록이 자기 몫을 든다.
    crystal_my_share INTEGER,
    crystal_shares_total INTEGER,
    -- 차액 송금의 경매장 수수료율(3 또는 5). NULL 은 3 이다.
    split_fee_percent INTEGER,
    -- 1 이면 송금 수수료가 등급을 따라간다(자동). 새 결정석 기록이 그 날의 등급 요율로 적힌다.
    split_fee_auto INTEGER,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (ocid, boss_key, difficulty)
  )`

export const BOSS_DROP_RECORDS_BODY = `(
    -- 이 기록을 다시 가리키는 값. SQLite 가 만든다(sqlite/uuid.ts 의 NEW_UUID_SQL).
    -- 아래 다섯 칸을 기본키로 쓰면 그중 둘이 설계상 바뀌어 행을 가리킬 방법이 사라진다 -
    -- difficulty 는 처치 난이도가 확정될 때 옮겨지고, drop_index 는 그룹을 저장할 때마다
    -- 배열 자리로 다시 매겨진다. 서버로 가격을 보낼 때 이 값이 멱등 열쇠가 된다.
    drop_record_id TEXT NOT NULL,
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    period_key TEXT NOT NULL,
    drop_index INTEGER NOT NULL,
    category TEXT NOT NULL,
    item_key TEXT,
    item_name TEXT NOT NULL,
    -- 죽은 칸. 2026-10-16 부터 안 적고 안 읽는다. 표를 다시 만들지 않으려고 남긴다.
    slot TEXT,
    box_origin_key TEXT,
    box_origin TEXT,
    ring_level INTEGER,
    quantity INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    -- 기록 시점의 월드 스냅샷. 모르면 NULL 이고, 0 이나 빈 문자열로 채우면 '모름' 이 값으로 둔갑한다.
    -- 짝인 수익 행에서 물려받지 않는다 - 결정석 가격을 모르는 보스는 수익 행이 없어 물려받을 짝이 없다.
    world TEXT,
    -- 월드 key. world 가 NULL 이면 함께 NULL 이다.
    world_key TEXT,
    -- 가격. 셋 다 nullable 이고 NULL 은 '미입력'이다. 0 을 쓰면
    -- '0메소에 팔았다'가 되어 스킵·미입력과 구분이 사라진다.
    price_state TEXT,
    price_meso INTEGER,
    -- 어떻게 나눴나. 'even'(기본) · 'ratio'(비율). **아래 두 칸의 뜻을 이 칸이 정한다.**
    -- 비율 1:3 과 균등 3인은 두 수가 같아 숫자로는 되짚을 수 없다. NULL 은 방식을 모르는 옛 행이다.
    price_split_mode TEXT,
    -- 'even' 의 분배 인원. 비율은 이 칸을 안 본다.
    price_party_size INTEGER,
    -- 'ratio' 의 비율 합. 기본은 이 칸을 안 본다.
    price_share INTEGER,
    -- 내 비율. 'even' 은 이 칸을 안 본다.
    price_my_share INTEGER,
    -- 판매 · 분배 수수료(%). 둘 다 NULL 이면 수수료를 안 센 옛 행이라 옛 식 그대로 센다.
    sale_fee_percent INTEGER,
    split_fee_percent INTEGER,
    -- 1 이면 자동. 등급 기록이 바뀔 때 새 요율로 다시 적힌다. NULL 은 손으로 고른 값이다.
    sale_fee_auto INTEGER,
    split_fee_auto INTEGER,
    PRIMARY KEY (drop_record_id)
  )`

/** 기본키를 보스 key 로 다시 만드는 표 셋. 버전 4 가 이 차례로 돈다. */
export const BOSS_KEYED_TABLES = [
  { name: 'boss_profit_records', body: BOSS_PROFIT_RECORDS_BODY },
  { name: 'boss_party_settings', body: BOSS_PARTY_SETTINGS_BODY },
  { name: 'boss_drop_records', body: BOSS_DROP_RECORDS_BODY },
] as const

/**
 * 분배 조건 여섯 칸. 세 표가 같은 칸을 쓴다.
 *
 * `split_mode` 가 `NULL` 이면 여섯 칸이 다 비어 있고, 조합 행에서는 보스 관리에서 정한 적이 없다는 뜻이다.
 * 기간 행에서는 조합 행을 따른다는 뜻이다.
 */
const SPLIT_COLUMNS = `
    -- 'even'(균등) · 'ratio'(비율). 비율 1:3 과 균등 3인은 두 수가 같아 이 칸 없이는 못 가른다.
    split_mode TEXT CHECK (split_mode IN ('even', 'ratio')),
    -- 파티 인원. 비율이어도 채운다.
    party_size INTEGER,
    -- 'ratio' 의 내 비율과 비율 합.
    my_share INTEGER,
    shares_total INTEGER,
    -- 분배 수수료(%). NULL 은 3 이다.
    split_fee_percent INTEGER,
    -- 1 이면 분배 수수료가 등급을 따라간다.
    split_fee_auto INTEGER`

const SPLIT_CHECKS = `
    CHECK ((split_mode IS NULL) = (party_size IS NULL)),
    CHECK ((split_mode = 'ratio') = (my_share IS NOT NULL AND shares_total IS NOT NULL))`

/**
 * 분배 방식 `제외`. 조합 행과 기간 행에만 있고 드롭에는 없다. `split_mode` 에 세 번째 값을 넣지 않는 것은 그 `CHECK` 를
 * 고치려면 표를 다시 만들어야 하고, `boss_parties` 를 지우면 외래키를 타고 기간 행과 드롭까지 지워지기 때문이다.
 */
const CRYSTAL_EXCLUDED_COLUMN = `
    -- 1 이면 결정석을 팔지 않은 처치(제외)다. 분배 칸에는 숨겨 둔 분배가 그대로 남는다.
    crystal_excluded INTEGER`

const TIME_COLUMNS = `
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL`

/** 캐릭터 · 보스 · 난이도 조합. 보스 관리의 파티 설정이 여기 있다. */
export const BOSS_PARTIES_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
    difficulty TEXT NOT NULL,${SPLIT_COLUMNS},${CRYSTAL_EXCLUDED_COLUMN},${TIME_COLUMNS},${SPLIT_CHECKS},
    UNIQUE (ocid, boss_key, difficulty)
  )`

/**
 * 조합 하나의 한 기간. 처치 기록과 그 기간만 고친 값이 한 행이다.
 *
 * `clear_status` 가 'cleared' 면 처치한 기간이고 결정석 칸과 분배 칸이 다 차 있다. 'open' 이면 그 기간 값이나
 * 드롭만 있다.
 */
export const BOSS_PARTY_PERIODS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES boss_parties(id) ON DELETE CASCADE,
    -- 주간 YYYY-MM-DD(목요일) · 월간 YYYY-MM.
    period_key TEXT NOT NULL,
    cycle TEXT NOT NULL CHECK (cycle IN ('weekly', 'monthly')),
    -- 그 기간의 월드 스냅샷. 모르면 NULL 이다. 지금 캐시의 월드로 채우면 리프한 캐릭터의 과거가 옮겨간다.
    world_key TEXT,
    clear_status TEXT NOT NULL CHECK (clear_status IN ('open', 'cleared')),
    price_meso INTEGER,
    payout_meso INTEGER,
    -- 처치 날짜(KST YYYY-MM-DD). 모르면 NULL 이다.
    defeated_date TEXT,
    -- 'auto'(동기화) · 'manual'(사용자가 직접 적은 완료).
    source TEXT CHECK (source IN ('auto', 'manual')),${SPLIT_COLUMNS},${CRYSTAL_EXCLUDED_COLUMN},
    -- 1 이면 주간 결정석 판매 한도를 넘긴 처치다. payout_meso 는 그대로 두고 읽을 때 0 으로 읽는다.
    over_crystal_limit INTEGER,${TIME_COLUMNS},${SPLIT_CHECKS},
    CHECK ((clear_status = 'cleared') = (price_meso IS NOT NULL AND payout_meso IS NOT NULL AND source IS NOT NULL AND split_mode IS NOT NULL)),
    CHECK (clear_status = 'cleared' OR defeated_date IS NULL),
    UNIQUE (party_id, period_key)
  )`

/**
 * 드롭 한 개와 판매가. 칸 이름과 상태 값이 서버 `drop_prices` 와 같다.
 *
 * 가격 · 분배 · 수수료는 'completed' 일 때만 있다. 0메소는 저장하지 않는다. 앱은 매긴 것으로, 서버는
 * 미입력으로 봐서 상태가 갈렸다.
 */
export const PERIOD_BOSS_DROPS_BODY = `(
    -- 서버로 보내는 drop_record_id 다.
    id TEXT NOT NULL PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES boss_party_periods(id) ON DELETE CASCADE,
    -- 드롭 시트의 차례. 저장할 때마다 다시 매겨 잠깐 겹치므로 UNIQUE 를 걸지 않는다.
    sort_order INTEGER NOT NULL,
    category TEXT NOT NULL,
    item_key TEXT NOT NULL,
    -- 상자에서 나왔으면 그 상자의 아이템 key.
    box_origin_key TEXT,
    ring_level INTEGER,
    record_status TEXT NOT NULL CHECK (record_status IN ('pending', 'completed', 'skipped')),
    -- 판매 총액. 내 몫이 아니다.
    price_meso INTEGER CHECK (price_meso IS NULL OR price_meso > 0),
    -- 가격을 처음 적거나 바꾼 시각.
    priced_at TEXT,
    sale_fee_percent INTEGER,
    sale_fee_auto INTEGER,${SPLIT_COLUMNS},${TIME_COLUMNS},${SPLIT_CHECKS},
    CHECK ((record_status = 'completed') = (price_meso IS NOT NULL)),
    CHECK ((record_status = 'completed') = (priced_at IS NOT NULL)),
    CHECK ((record_status = 'completed') = (split_mode IS NOT NULL)),
    CHECK (record_status = 'completed' OR (sale_fee_percent IS NULL AND sale_fee_auto IS NULL))
  )`

/** 기간 하나의 드롭을 찾는 인덱스. 변환 전 표에만 건다. */
export const PERIOD_BOSS_DROPS_INDEX =
  'CREATE INDEX IF NOT EXISTS boss_drops_period ON boss_drops (period_id, sort_order)'

/** 분배 방식 셋. `excluded` 는 결정석을 팔지 않은 처치라 인원과 내 몫이 없다. */
const SPLIT_TYPES = "('even', 'ratio', 'excluded')"

/**
 * 분배 칸 다섯. 세 표가 같은 칸을 쓴다. 내 몫은 % 에 1000 을 곱한 정수(0 ~ 100000)다. SQLite 에 참 · 거짓 형이 없어 등급을
 * 따르는지는 1 · 0 이다.
 */
const SPLIT_FIVE_COLUMNS = (types: string): string => `
    split_type TEXT CHECK (split_type IN ${types}),
    party_size INTEGER,
    split_share_millipercent INTEGER CHECK (split_share_millipercent BETWEEN 0 AND 100000),
    split_fee_percent INTEGER,
    split_fee_follows_mvp_grade INTEGER NOT NULL CHECK (split_fee_follows_mvp_grade IN (0, 1))`

/** 고른 분배만 칸이 찬다. `excluded` 와 고르지 않은 분배는 인원이 없고, 비율일 때만 내 몫이 있다. */
const SPLIT_FIVE_CHECKS = `
    CHECK ((split_type IS NULL OR split_type = 'excluded') = (party_size IS NULL)),
    CHECK ((split_type IS 'ratio') = (split_share_millipercent IS NOT NULL))`

/** 캐릭터 · 보스 난이도마다의 기본 분배. 분배를 정한 줄만 있다. 자동이면 요율을 비우고 수동이면 채운다. */
export const BOSS_SPLIT_SETTINGS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    ocid TEXT NOT NULL,
    boss_difficulty_id TEXT NOT NULL,${SPLIT_FIVE_COLUMNS(SPLIT_TYPES)},${TIME_COLUMNS},${SPLIT_FIVE_CHECKS},
    CHECK (split_type IS NOT NULL),
    CHECK (split_fee_follows_mvp_grade = (split_fee_percent IS NULL)),
    UNIQUE (ocid, boss_difficulty_id)
  )`

/**
 * 한 캐릭터가 한 기간에 한 보스 난이도에서 거둔 수익 건. 처치 기록이고, 처치 전이면 그 기간만 고친 분배나 드롭만 있다.
 *
 * 처치했는지는 `clear_recorded_by` 가 찼는지로 안다. 처치한 비율 분배는 그 처치를 계산한 요율이 있어야 하고, 처치 전 줄은
 * 자동이면 요율을 비우고 수동이면 채운다.
 */
export const BOSS_PROFIT_ENTRIES_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    ocid TEXT NOT NULL,
    boss_difficulty_id TEXT NOT NULL,
    -- 주간 W + 년 + ISO 주차(W202647) · 월간 M + 년월(M202611).
    period_code TEXT NOT NULL CHECK (
      period_code GLOB 'W[0-9][0-9][0-9][0-9][0-5][0-9]' OR period_code GLOB 'M[0-9][0-9][0-9][0-9][01][0-9]'
    ),
    -- 그 기간에 캐릭터가 있던 월드의 줄 id. 모르면 NULL 이다. 지금 월드로 채우면 리프한 캐릭터의 과거가 옮겨간다.
    world_id TEXT,
    crystal_price_meso INTEGER,
    crystal_received_meso INTEGER,${SPLIT_FIVE_COLUMNS(SPLIT_TYPES)},
    -- 처치 날짜(KST YYYY-MM-DD). 모르면 NULL 이다.
    cleared_date TEXT,
    clear_recorded_by TEXT CHECK (clear_recorded_by IN ('auto', 'manual')),
    -- 1 이면 주간 결정석 판매 한도를 넘긴 처치다. 받은 메소는 그대로 두고 읽을 때 0 으로 읽는다. 기기에만 있다.
    over_crystal_sale_limit INTEGER,${TIME_COLUMNS},${SPLIT_FIVE_CHECKS},
    CHECK ((clear_recorded_by IS NULL) = (crystal_price_meso IS NULL)),
    CHECK ((clear_recorded_by IS NULL) = (crystal_received_meso IS NULL)),
    CHECK (clear_recorded_by IS NULL OR split_type IS NOT NULL),
    CHECK (clear_recorded_by IS NOT NULL OR cleared_date IS NULL),
    CHECK (CASE WHEN clear_recorded_by IS NOT NULL THEN split_type IS NOT 'ratio' OR split_fee_percent IS NOT NULL
                ELSE split_fee_follows_mvp_grade = (split_fee_percent IS NULL) END),
    UNIQUE (ocid, boss_difficulty_id, period_code)
  )`

/**
 * 한 수익 건에서 나온 드롭 한 개와 판매 기록. 가격을 적은 드롭만 판매가 · 받은 메소 · 분배가 있다. 판매 수수료가 비면 수수료
 * 없음이다. 같은 수익 건에 같은 아이템 줄은 하나다. 직접 떨군 것과 상자에서 나온 것은 아이템 줄이 다르다.
 */
export const BOSS_DROPS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    profit_entry_id TEXT NOT NULL REFERENCES boss_profit_entries(id) ON DELETE CASCADE,
    -- 얻은 아이템의 줄 id. 반지는 레벨 줄이다.
    item_id TEXT NOT NULL,
    category TEXT NOT NULL,
    price_status TEXT NOT NULL CHECK (price_status IN ('pending', 'entered', 'skipped')),
    -- 판매 총액. 내 몫이 아니다.
    sale_price_meso INTEGER CHECK (sale_price_meso IS NULL OR sale_price_meso > 0),
    -- 판매 수수료와 분배를 반영해 내가 받는 메소. 가격 · 분배 · 수수료를 고칠 때만 다시 센다.
    sale_received_meso INTEGER,
    -- 가격을 처음 적거나 바꾼 시각.
    priced_at TEXT,
    sale_fee_percent INTEGER,
    sale_fee_follows_mvp_grade INTEGER NOT NULL CHECK (sale_fee_follows_mvp_grade IN (0, 1)),${SPLIT_FIVE_COLUMNS("('even', 'ratio')")},${TIME_COLUMNS},${SPLIT_FIVE_CHECKS},
    CHECK ((price_status = 'entered') = (sale_price_meso IS NOT NULL)),
    CHECK ((sale_price_meso IS NULL) = (sale_received_meso IS NULL)),
    CHECK ((sale_price_meso IS NULL) = (priced_at IS NULL)),
    CHECK ((price_status = 'entered') = (split_type IS NOT NULL)),
    UNIQUE (profit_entry_id, item_id)
  )`
