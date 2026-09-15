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
    recorded_at TEXT NOT NULL,
    -- 기록 시점의 월드 스냅샷. NULL이면 "월드 모름"이고 월드별 결정석 집계에서
    -- 제외된다. 월드를 파생값(캐시된 character/basic)으로 두면 월드 리프가 모든 과거 주의 귀속을
    -- 소급 이동시킨다. 분모(90 x 월드 수)까지 바뀐다.
    world TEXT,
    -- 처치 **날짜**(KST YYYY-MM-DD). period_key 는 주(목요일)·달이라 "며칟날" 을 못 든다.
    -- NULL 은 "모름" 이고 가계부의 월간 칸 집계에서 조용히 빠진다(world 와 같은 모양). 키가
    -- 아니므로 나중에 채워 넣어도 옛 행이 움직이지 않는다.
    defeated_on TEXT,
    PRIMARY KEY (ocid, boss_key, difficulty, period_key)
  )`

export const BOSS_PARTY_SETTINGS_BODY = `(
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    party_size INTEGER NOT NULL,
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
    price_share INTEGER,
    PRIMARY KEY (ocid, boss_key, difficulty, period_key, drop_index)
  )`

/** 기본키를 보스 key 로 다시 만드는 표 셋. 버전 4 가 이 차례로 돈다. */
export const BOSS_KEYED_TABLES = [
  { name: 'boss_profit_records', body: BOSS_PROFIT_RECORDS_BODY },
  { name: 'boss_party_settings', body: BOSS_PARTY_SETTINGS_BODY },
  { name: 'boss_drop_records', body: BOSS_DROP_RECORDS_BODY },
] as const
