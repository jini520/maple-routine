/**
 * 가계부 손입력 기록의 표 셋. 버전 15 가 옛 `spend_records` · `income_records` 를 이리로 옮긴다.
 *
 * 기록 하나가 품목 여럿(에픽던전의 형태 둘)을 지고, 금액 · 수수료 · 관세는 품목마다 있다. 기록의 금액은 품목 금액의
 * 합이다. 두 곳에 두면 합과 기록 금액이 어긋날 수 있어서 기록 행에는 금액 칸이 없다.
 */

export const CASHBOOK_ENTRIES_BODY = `(
    id TEXT PRIMARY KEY,
    -- 기록이 붙은 캐릭터. 새 기록은 이것과 account_id 중 하나만 채운다.
    ocid TEXT,
    -- 기록이 붙은 메이플 ID(character_accounts.account_id). 캐릭터 기록과 주인을 모르는 옛 기록은 NULL 이다.
    account_id TEXT,
    -- 주인을 모르는 옛 기록이 어느 넥슨 계정의 것인지. 새 기록은 적지 않는다. 계정은 ocid · account_id 에서 찾는다.
    nexon_account_id TEXT,
    -- 캐릭터 기록을 적을 때 그 캐릭터의 월드 key. 리프로 기록을 새 ocid 로 옮겨도 그때의 월드에 남는다. 메이플 ID 기록은 NULL 이다.
    world_key TEXT,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'spend')),
    -- 갈래 key. 기타가 수입 · 지출 양쪽에 있어 entry_type 과 함께 읽는다.
    category_key TEXT NOT NULL,
    -- 돈이 오간 날(KST YYYY-MM-DD). 사용자가 고르고 고칠 수 있다.
    entry_date TEXT NOT NULL,
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
    -- 메포 지출의 메소마켓 수수료율(%). 수입과 메소 · 캐시 품목은 NULL 이다.
    meso_market_fee_percent INTEGER,
    -- 환산하지 않는다.
    amount_cash INTEGER,
    -- 헥사 강화의 필요 조각 · 교환 불가 조각 · 조각 개당 가격. 다른 갈래는 NULL 이다.
    fragment_count INTEGER,
    untradable_fragment_count INTEGER,
    fragment_price_meso INTEGER,
    -- 헥사 스탯의 활성화 포함(1 · 0). 헥사 스킬과 다른 갈래는 NULL 이다.
    hexa_activation INTEGER,
    -- 헥사 기록의 두 체크(1 · 0). 보관 중인 조각 사용과, 보관에서 가져온 몫을 지출로 셀지다. 다른 갈래는 NULL 이다.
    hexa_use_storage INTEGER,
    hexa_storage_as_spend INTEGER,
    -- 인벤토리에서 판 아이템 판매가 가리키는 인벤토리 줄. 그 줄의 남은 개수가 이 수량을 뺀다. 가계부에서 적은 판매는 NULL 이다.
    inventory_item_id TEXT REFERENCES inventory_items(id),
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

/**
 * 기록이 보관에서 가져온 조각을 보관마다 한 줄. 저장할 때 굳힌다. 다시 계산하면 옛 사냥 기록을 고칠 때 지난 헥사
 * 기록이 가져간 캐릭터가 바뀐다. 사냥 조각 보관(`getFragmentStorage`)은 `hunt` 줄을, 인벤토리의 기타 조각은 `other` 줄을 뺀다.
 */
export const CASHBOOK_ENTRY_FRAGMENT_USES_BODY = `(
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    -- 조각을 가져온 보관. 사냥 조각(hunt)은 캐릭터의 것이고, 인벤토리에 넣은 기타 조각(other)은 메이플 ID · 월드의 것이다.
    fragment_source TEXT NOT NULL DEFAULT 'hunt' CHECK (fragment_source IN ('hunt', 'other')),
    -- 사냥 조각을 가져온 캐릭터. 기록의 캐릭터와 다를 수 있다. other 줄은 NULL 이다.
    ocid TEXT,
    -- 기타 조각을 가져온 메이플 ID · 월드. hunt 줄은 NULL 이다.
    account_id TEXT,
    world_key TEXT,
    fragments INTEGER NOT NULL,
    CHECK (
      (fragment_source = 'hunt' AND ocid IS NOT NULL AND account_id IS NULL AND world_key IS NULL)
      OR (fragment_source = 'other' AND ocid IS NULL AND account_id IS NOT NULL AND world_key IS NOT NULL)
    )
  )`

/**
 * 보스 · 사냥이 아닌 다른 경로로 얻어 인벤토리에 넣은 아이템. 메이플 ID · 월드 하나의 아이템 하나가 한 줄이고, 장비는 하나가
 * 한 줄이다. 날짜는 없다. 언제 얻었는지는 쓰지 않는다. 남은 개수는 저장하지 않고 이 줄을 가리키는 판매 · 조각 사용을 빼서 센다.
 */
export const INVENTORY_ITEMS_BODY = `(
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    world_key TEXT NOT NULL,
    item_key TEXT NOT NULL,
    item_kind_key TEXT NOT NULL,
    -- 넣은 개수. 판 · 쓴 수를 포함한다. 수정은 판 · 쓴 수 + 남길 개수로 바꾼다.
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    -- 특수스킬 반지의 레벨. 같은 반지도 레벨마다 다른 물건이다. 다른 아이템은 NULL 이다.
    ring_level INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`

/** 장비가 아닌 아이템은 메이플 ID · 월드마다 한 줄이다. 다시 넣으면 그 줄의 개수를 늘린다. 장비는 겹치지 않아 줄이 하나씩 선다. */
export const INVENTORY_ITEMS_OWNER_INDEX = `CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_owner_item
  ON inventory_items (account_id, world_key, item_key) WHERE item_kind_key <> 'equipment'`

/** 하루 목록 · 기간 합계가 날짜 범위로 읽는다. */
export const CASHBOOK_ENTRIES_DATE_INDEX =
  'CREATE INDEX IF NOT EXISTS cashbook_entries_entry_date ON cashbook_entries (entry_date)'
