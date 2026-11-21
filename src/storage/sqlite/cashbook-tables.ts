/**
 * 가계부 손입력 기록의 표 여섯과 인벤토리 표의 본문. 두 무리다.
 *
 * 1. 1.0.15 기기 변환 전의 표(`UNCONVERTED_…`). 버전 15 가 옛 `spend_records` · `income_records` 를 이 모양으로 옮겼다. 변환 전
 *    DB 를 열 때와 앞 버전 이관이 쓴다. 변환이 2 로 옮긴 뒤 지운다.
 * 2. 1.0.15 기기 변환이 만드는 표. 지금 읽고 쓰는 표이고, 칸 이름이 서버 표와 같다. 분류 · 품목의 대상 · 아이템 · 월드를 게임
 *    데이터의 줄 id 로 가리킨다. 서버는 캐릭터와 메이플 ID 를 줄 id 로 가리키고 기기는 `ocid` 와 `account_id` 로 가리킨다.
 *
 * 기록 하나가 품목 여럿(에픽던전의 추가 리워드 종류 둘)을 지고, 금액 · 수수료 · 관세는 품목마다 있다. 기록의 금액은 품목 금액의
 * 합이다. 두 곳에 두면 합과 기록 금액이 어긋날 수 있어서 기록 행에는 금액 칸이 없다.
 */

export const UNCONVERTED_CASHBOOK_ENTRIES_BODY = `(
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
    -- 분류 key. 기타가 수입 · 지출 양쪽에 있어 entry_type 과 함께 읽는다.
    category_key TEXT NOT NULL,
    -- 돈이 오간 날(KST YYYY-MM-DD). 사용자가 고르고 고칠 수 있다.
    entry_date TEXT NOT NULL,
    -- 아이템 구매 · 판매의 메모. 앞뒤 공백을 걷은 값이고 없으면 NULL 이다.
    memo TEXT,
    -- 저장한 시각. 같은 날 안의 차례가 이것이고 고쳐도 안 바뀐다.
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`

export const UNCONVERTED_CASHBOOK_ENTRY_ITEMS_BODY = `(
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
    -- 단위는 참조표가 안다(항목 · 분류 · 아이템 종류).
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
    -- 헥사 강화의 필요 조각 · 교환 불가 조각 · 조각 개당 가격. 다른 분류는 NULL 이다.
    fragment_count INTEGER,
    untradable_fragment_count INTEGER,
    fragment_price_meso INTEGER,
    -- 헥사 스탯의 활성화 포함(1 · 0). 헥사 스킬과 다른 분류는 NULL 이다.
    hexa_activation INTEGER,
    -- 헥사 기록의 두 체크(1 · 0). 보관 중인 조각 사용과, 보관에서 가져온 몫을 지출로 셀지다. 다른 분류는 NULL 이다.
    hexa_use_storage INTEGER,
    hexa_storage_as_spend INTEGER,
    -- 이 품목이 가리키는 인벤토리 줄. 인벤토리에서 판 아이템 판매는 그 줄의 남은 개수에서 빼고, 인벤토리에 보관한 아이템 구매는 더한다.
    inventory_item_id TEXT REFERENCES inventory_items(id),
    -- 아이템 구매 · 판매에서 고른 특수스킬 반지의 레벨. 같은 반지도 레벨마다 다른 물건이다. 다른 품목은 NULL 이다.
    ring_level INTEGER,
    UNIQUE (entry_id, sort_order)
  )`

export const UNCONVERTED_CASHBOOK_ENTRY_HUNT_INPUTS_BODY = `(
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

/** `주간 보스 수입 이전` 시트의 입력. 이 줄이 있는 `기타` 지출은 그 시트로 연다. */
export const UNCONVERTED_CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY = `(
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL UNIQUE REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    -- 메소를 받은 캐릭터. 수수료율은 이 캐릭터의 MVP 등급에서 나온다.
    receiver_ocid TEXT NOT NULL,
    transfer_meso INTEGER NOT NULL,
    fee_percent INTEGER NOT NULL,
    -- 1 이면 받는 캐릭터의 등급을 따라간다. NULL 은 손으로 고른 요율이다.
    fee_auto INTEGER
  )`

/** `메소마켓 환전 수수료` 시트의 입력. 이 줄이 있는 `기타` 지출 · 수입은 그 시트로 연다. */
export const UNCONVERTED_CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY = `(
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL UNIQUE REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    sold_meso INTEGER NOT NULL,
    sell_point_per_100m_meso INTEGER NOT NULL,
    -- 판매만 적은 기록은 구매 두 칸이 NULL 이다. 나중에 수정 시트에서 채운다.
    bought_meso INTEGER,
    buy_point_per_100m_meso INTEGER,
    meso_market_fee_percent INTEGER NOT NULL
  )`

/**
 * 기록이 보관에서 가져온 조각을 보관마다 한 줄. 저장할 때 굳힌다. 다시 계산하면 옛 사냥 기록을 고칠 때 지난 헥사
 * 기록이 가져간 캐릭터가 바뀐다. 사냥 조각 보관(`getFragmentStorage`)은 `hunt` 줄을, 인벤토리의 기타 조각은 `other` 줄을 뺀다.
 */
export const UNCONVERTED_CASHBOOK_ENTRY_FRAGMENT_USES_BODY = `(
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
export const UNCONVERTED_INVENTORY_ITEMS_BODY = `(
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

/**
 * 장비가 아닌 아이템은 메이플 ID · 월드마다 한 줄이다. 다시 넣으면 그 줄의 개수를 늘린다. 장비는 겹치지 않아 줄이 하나씩 선다.
 * 변환 전 표에만 건다. 변환한 표는 종류를 줄 id 로 들어 저장 코드가 이 기준을 지킨다.
 */
export const INVENTORY_ITEMS_OWNER_INDEX = `CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_owner_item
  ON inventory_items (account_id, world_key, item_key) WHERE item_kind_key <> 'equipment'`

/** 하루 목록 · 기간 합계가 날짜 범위로 읽는다. 변환 전 표에만 건다. */
export const UNCONVERTED_CASHBOOK_ENTRIES_DATE_INDEX =
  'CREATE INDEX IF NOT EXISTS cashbook_entries_entry_date ON cashbook_entries (entry_date)'

/** 기록 하나의 주인. 캐릭터 기록은 `ocid`, 메이플 ID 기록은 `account_id` 를 든다. 주인을 모르는 기록은 변환이 지운다. */
export const CASHBOOK_ENTRIES_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    -- 기록이 붙은 캐릭터. 메이플 ID 기록은 NULL 이다.
    ocid TEXT,
    -- 기록이 붙은 메이플 ID(character_accounts.account_id). 캐릭터 기록은 NULL 이고 메이플 ID 를 ocid 로 찾는다.
    account_id TEXT,
    -- 캐릭터 기록을 적을 때 그 캐릭터 월드의 줄 id. 리프로 기록을 새 ocid 로 옮겨도 그때의 월드에 남는다. 메이플 ID 기록은
    -- NULL 이고, 인벤토리에서 판 기타 조각 기록만 판 조각의 월드다.
    world_id TEXT,
    -- 가계부 분류의 줄 id. 수입인지 지출인지는 분류 줄이 안다.
    category_id TEXT NOT NULL,
    -- 돈이 오간 날(KST YYYY-MM-DD). 사용자가 고르고 고칠 수 있다.
    date TEXT NOT NULL,
    -- 아이템 구매 · 판매의 메모. 앞뒤 공백을 걷은 값이고 없으면 NULL 이다.
    memo TEXT,
    -- 저장한 시각. 같은 날 안의 차례가 이것이고 고쳐도 안 바뀐다.
    recorded_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (ocid IS NOT NULL OR account_id IS NOT NULL)
  )`

/** 품목이 가리키는 표의 종류. 서버 `cashbook_item_target_type` 과 같다. */
const TARGET_TYPES = "('hunting_ground', 'item', 'spend_item', 'symbol', 'hexa_core', 'hexa_stat')"

/**
 * 기록의 품목 한 줄. 에픽던전 추가 리워드는 종류마다 한 줄이고, 종류가 없는 기록은 품목이 하나다. 대상은 종류와 줄 id 로 가리킨다.
 * 직접 친 품목은 대상 없이 이름만 있다. SQLite 에 참 · 거짓 형이 없어 참 · 거짓 칸은 1 · 0 이다.
 */
export const CASHBOOK_ENTRY_ITEMS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    -- 기록의 분류가 정한 표와 그 줄 id. 반지는 레벨 줄이다. 대상이 없는 분류와 직접 친 품목은 NULL 이다.
    target_type TEXT CHECK (target_type IN ${TARGET_TYPES}),
    target_id TEXT,
    -- 직접 친 품목 이름. 대상과 함께 적지 않는다. 표에서 못 찾은 헥사 코어는 코어 이름이 여기 든다.
    item_name TEXT,
    -- 에픽던전 추가 리워드 종류의 줄 id. 종류 하나에 품목 하나다.
    spend_reward_type_id TEXT,
    -- 아이템 구매 · 판매의 종류 줄 id. 단위는 참조표가 안다.
    item_type_id TEXT,
    quantity INTEGER,
    from_level INTEGER,
    to_level INTEGER,
    -- 관세를 포함하고 판매 수수료를 뺀 값. 합계는 이 칸만 더한다.
    amount_meso INTEGER,
    -- 그중 관세분. 합계에 더하지 않는다.
    tariff_meso INTEGER,
    sale_fee_percent INTEGER,
    sale_fee_meso INTEGER,
    -- 1 이면 판매 수수료가 등급을 따라간다.
    sale_fee_follows_mvp_grade INTEGER CHECK (sale_fee_follows_mvp_grade IN (0, 1)),
    amount_maple_point INTEGER,
    -- 1억 메소당 메이플포인트. amount_maple_point 가 있으면 함께 있다.
    maple_point_per_100m_meso INTEGER,
    -- 메포 지출의 메소마켓 수수료율(%). 수입과 메소 · 캐시 품목은 NULL 이다.
    meso_market_fee_percent INTEGER,
    -- 환산하지 않는다.
    amount_cash INTEGER,
    -- 헥사 강화의 필요 조각 · 교환 불가 조각 · 조각 개당 가격. 다른 분류는 NULL 이다.
    fragment_quantity INTEGER,
    untradable_fragment_quantity INTEGER,
    fragment_price_meso INTEGER,
    -- 헥사 스탯의 활성화 포함. 헥사 스킬과 다른 분류는 NULL 이다.
    includes_hexa_activation INTEGER,
    -- 헥사 기록의 두 체크. 보관 중인 조각 사용과, 보관에서 가져온 몫을 지출로 셀지다. 다른 분류는 NULL 이다.
    uses_stored_fragments INTEGER,
    counts_stored_fragments_as_spend INTEGER,
    -- 이 품목이 가리키는 인벤토리 줄. 인벤토리에서 판 아이템 판매는 그 줄의 남은 개수에서 빼고, 인벤토리에 보관한 아이템 구매는 더한다.
    inventory_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
    CHECK ((target_type IS NULL) = (target_id IS NULL)),
    CHECK (item_name IS NULL OR target_id IS NULL),
    UNIQUE (entry_id, spend_reward_type_id)
  )`

export const CASHBOOK_ENTRY_HUNT_INPUTS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    entry_id TEXT NOT NULL UNIQUE REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    -- 계산기로 적은 사냥의 입력. 그때 레벨 · 메획을 박아야 나중에 다시 재도 금액이 안 바뀐다.
    character_level INTEGER,
    -- NULL 이면 직접 입력 사냥이다. 그때 계산기 칸은 전부 NULL 이다.
    missed_mob_quantity INTEGER,
    -- 켠 효과. 소형 재물 획득의 비약 · 유니온의 부를 켰는지 1 · 0 이고 직접 입력 사냥은 NULL 이다.
    uses_wealth_potion INTEGER,
    uses_union_wealth INTEGER,
    -- 유니온의 부 단계 1 ~ 3.
    union_wealth_tier INTEGER,
    fragment_quantity INTEGER,
    -- NULL 은 가격을 안 적은 조각이라 캐릭터 보관에 든다. 0 은 0 메소에 판 것이다.
    fragment_price_meso INTEGER,
    -- 그때의 캐릭터 메소 획득량(%).
    meso_acquisition_percent INTEGER,
    -- NULL 이 아니면 직접 입력 사냥의 친 메소다.
    typed_meso INTEGER
  )`

/** `주간 보스 수입 이전` 시트의 입력. 이 줄이 있는 `기타` 지출은 그 시트로 연다. */
export const CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    entry_id TEXT NOT NULL UNIQUE REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    -- 메소를 받은 캐릭터. 수수료율은 이 캐릭터의 MVP 등급에서 나온다.
    receiver_ocid TEXT NOT NULL,
    transfer_meso INTEGER NOT NULL,
    fee_percent INTEGER NOT NULL,
    -- 1 이면 받는 캐릭터의 등급을 따라간다. 0 은 손으로 고른 요율이다.
    fee_follows_mvp_grade INTEGER NOT NULL CHECK (fee_follows_mvp_grade IN (0, 1))
  )`

/** `메소마켓 환전 수수료` 시트의 입력. 이 줄이 있는 `기타` 지출 · 수입은 그 시트로 연다. */
export const CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    entry_id TEXT NOT NULL UNIQUE REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    sold_meso INTEGER NOT NULL,
    sell_maple_point_per_100m_meso INTEGER NOT NULL,
    -- 판매만 적은 기록은 구매 두 칸이 NULL 이다. 나중에 수정 시트에서 채운다.
    bought_meso INTEGER,
    buy_maple_point_per_100m_meso INTEGER,
    meso_market_fee_percent INTEGER NOT NULL
  )`

/**
 * 기록이 보관에서 가져온 조각을 보관마다 한 줄. 저장할 때 굳힌다. 다시 계산하면 옛 사냥 기록을 고칠 때 지난 헥사 기록이 가져간
 * 캐릭터가 바뀐다. 사냥 조각 보관(`getFragmentStorage`)은 `hunt` 줄을, 인벤토리의 기타 조각은 `inventory` 줄을 뺀다. 차례 칸이
 * 없어 넣은 차례(rowid)가 보관의 차례다.
 */
export const CASHBOOK_ENTRY_FRAGMENT_USES_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES cashbook_entries(id) ON DELETE CASCADE,
    -- 조각을 가져온 보관. 사냥 조각(hunt)은 캐릭터의 것이고, 인벤토리에 넣은 기타 조각(inventory)은 기록의 메이플 ID · 월드의 것이다.
    fragment_source TEXT NOT NULL CHECK (fragment_source IN ('hunt', 'inventory')),
    -- 사냥 조각을 가져온 캐릭터. 기록의 캐릭터와 다를 수 있다. inventory 줄은 NULL 이다.
    ocid TEXT,
    fragment_quantity INTEGER NOT NULL,
    CHECK ((fragment_source = 'hunt') = (ocid IS NOT NULL)),
    UNIQUE (entry_id, fragment_source, ocid)
  )`

/**
 * 보스 · 사냥이 아닌 다른 경로로 얻어 인벤토리에 넣은 아이템. 장비가 아니면 메이플 ID · 월드 · 아이템마다 한 줄이고, 장비는 하나가
 * 한 줄이다. 장비가 아닌 줄의 기준은 저장 코드(`storage/inventory.ts`)가 지킨다. 남은 개수는 저장하지 않고 이 줄을 가리키는
 * 판매 · 조각 사용을 빼서 센다.
 */
export const INVENTORY_ITEMS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY,
    account_id TEXT NOT NULL,
    world_id TEXT NOT NULL,
    -- 아이템의 줄 id. 레벨이 있는 특수스킬 반지는 레벨 줄이다.
    item_id TEXT NOT NULL,
    cashbook_item_type_id TEXT NOT NULL,
    -- 넣은 개수의 합. 판 · 쓴 수를 포함한다. 수정은 판 · 쓴 수 + 남길 개수로 바꾼다.
    added_quantity INTEGER NOT NULL CHECK (added_quantity >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`

/** 하루 목록 · 기간 합계가 날짜 범위로 읽는다. */
export const CASHBOOK_ENTRIES_DATE_INDEX = 'CREATE INDEX IF NOT EXISTS cashbook_entries_date ON cashbook_entries (date)'
