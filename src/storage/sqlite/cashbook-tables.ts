/**
 * 가계부 손입력 기록의 표 셋. 버전 15 가 옛 `spend_records` · `income_records` 를 이리로 옮긴다.
 *
 * 기록 하나가 품목 여럿(에픽던전의 형태 둘)을 지고, 금액 · 수수료 · 관세는 품목마다 있다. 기록의 금액은 품목 금액의
 * 합이다. 두 곳에 두면 합과 기록 금액이 어긋날 수 있어서 기록 행에는 금액 칸이 없다.
 */

export const CASHBOOK_ENTRIES_BODY = `(
    id TEXT PRIMARY KEY,
    -- NULL 은 계정 단위 기록이다.
    ocid TEXT,
    -- 계정 단위 기록이 어느 넥슨 계정의 것인지. 캐릭터가 있는 기록은 ocid 로 계정을 찾아 NULL 이다.
    nexon_account_id TEXT,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'spend')),
    -- 갈래 key. 기타가 수입 · 지출 양쪽에 있어 entry_type 과 함께 읽는다.
    category_key TEXT NOT NULL,
    -- 돈이 오간 날(KST YYYY-MM-DD). 사용자가 고르고 고칠 수 있다.
    entry_date TEXT NOT NULL,
    memo TEXT,
    -- 저장한 시각. 같은 날 안의 차례가 이것이고 고쳐도 안 바뀐다.
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`

export const CASHBOOK_ENTRY_ITEMS_BODY = `(
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    -- 지출 목록 항목 · 심볼 · 사냥터 key. 직접 친 품목은 NULL 이다.
    item_key TEXT,
    -- 직접 친 품목 이름. key 가 있으면 이름은 참조표에서 찾아 여기 안 적는다.
    item_name TEXT,
    -- 에픽던전 형태(exp · sol_erda). 형태 하나에 품목 하나다.
    form_key TEXT,
    item_kind_key TEXT,
    -- 단위는 참조표가 안다(항목 · 갈래 · 아이템 종류).
    quantity INTEGER,
    from_level INTEGER,
    to_level INTEGER,
    -- 관세를 포함하고 판매 수수료를 뺀 값. 합계는 이 칸만 더한다.
    amount_meso INTEGER,
    -- 그중 관세분. 합계에 더하지 않는다.
    tariff_meso INTEGER,
    sale_fee_percent INTEGER,
    sale_fee_meso INTEGER,
    -- 1 이면 판매 수수료가 등급을 따라간다(자동).
    sale_fee_auto INTEGER,
    amount_point INTEGER,
    -- 1억 메소당 메포. amount_point 가 있으면 함께 있다.
    point_per_100m_meso INTEGER,
    -- 환산하지 않는다.
    amount_cash INTEGER,
    UNIQUE (entry_id, sort_order)
  )`

export const CASHBOOK_ENTRY_HUNT_INPUTS_BODY = `(
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL UNIQUE REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    -- 계산기로 적은 사냥의 입력. 그때 레벨 · 메획을 박아야 나중에 다시 재도 금액이 안 바뀐다.
    character_level INTEGER,
    -- NULL 이면 직접 입력 사냥이다. 그때 계산기 칸은 전부 NULL 이다.
    missed_mobs INTEGER,
    boosts TEXT,
    fragments INTEGER,
    -- NULL 은 가격을 안 적은 조각이라 캐릭터 보관에 든다. 0 은 0 메소에 판 것이다.
    fragment_price_meso INTEGER,
    meso_rate INTEGER,
    -- NULL 이 아니면 직접 입력 사냥의 친 메소다.
    typed_meso INTEGER,
    union_tier INTEGER
  )`

/** 하루 목록 · 기간 합계가 날짜 범위로 읽는다. */
export const CASHBOOK_ENTRIES_DATE_INDEX =
  'CREATE INDEX IF NOT EXISTS cashbook_entries_entry_date ON cashbook_entries (entry_date)'
