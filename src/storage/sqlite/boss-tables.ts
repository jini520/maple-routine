/**
 * 보스 기록 표 셋의 **본문 한 벌**. `CREATE TABLE` 이 두 자리에서 같은 것을 쓴다. `db.ts` 의 정의 배열(정상
 * 생성)과 `migrations.ts` 의 버전 4(기본키를 보스 key 로 다시 만들기). 두 벌로 두면 재작성이 옛 스키마를
 * 다시 만드는 날이 온다.
 *
 * 세 표 모두 `boss_key` 가 기본키에 들고 `boss` 는 적을 때의 이름이다. `difficulty` 는 난이도 key 다.
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
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    period_key TEXT NOT NULL,
    drop_index INTEGER NOT NULL,
    category TEXT NOT NULL,
    item_key TEXT,
    item_name TEXT NOT NULL,
    slot TEXT,
    box_origin_key TEXT,
    box_origin TEXT,
    ring_level INTEGER,
    quantity INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    -- 가격. 셋 다 nullable 이고 NULL 은 '미입력'이다. 0 을 쓰면
    -- '0메소에 팔았다'가 되어 스킵·미입력과 구분이 사라진다.
    price_state TEXT,
    price_meso INTEGER,
    -- 분배 인원. 비율을 쓰는 기록에서는 **비율 합**이다. 균등이면 둘이 같은 수라 옛 행의
    -- 금액이 안 움직인다.
    price_share INTEGER,
    price_my_share INTEGER,
    -- 판매 · 분배 수수료(%). 둘 다 NULL 이면 수수료를 안 센 옛 행이라 옛 식 그대로 센다.
    sale_fee_percent INTEGER,
    split_fee_percent INTEGER,
    -- 1 이면 자동. 등급 기록이 바뀔 때 새 요율로 다시 적힌다. NULL 은 손으로 고른 값이다.
    sale_fee_auto INTEGER,
    split_fee_auto INTEGER,
    PRIMARY KEY (ocid, boss_key, difficulty, period_key, drop_index)
  )`

/** 기본키를 보스 key 로 다시 만드는 표 셋. 버전 4 가 이 차례로 돈다. */
export const BOSS_KEYED_TABLES = [
  { name: 'boss_profit_records', body: BOSS_PROFIT_RECORDS_BODY },
  { name: 'boss_party_settings', body: BOSS_PARTY_SETTINGS_BODY },
  { name: 'boss_drop_records', body: BOSS_DROP_RECORDS_BODY },
] as const
