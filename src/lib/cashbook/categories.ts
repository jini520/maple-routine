/**
 * 가계부의 고정 목록 넷(지출 갈래 · 수익 갈래 · 아이템 구매 종류 · 에픽던전 리워드 형태)의 표.
 *
 * 기록은 key 를 저장하고 화면은 이 표에서 이름과 그림을 찾는다. 이름을 바꿔도 옛 기록이 따라온다.
 * 코드가 이 값으로 폼을 가르는 목록이라 JSON 이 아니라 여기 둔다. key 가 타입이 되어 없는 갈래를
 * 적으면 타입 검사가 잡는다.
 */

/**
 * 지출의 갈래. **차례가 곧 화면**이다. 앞의 넷은 선택 목록이고, 심볼 강화는 비용 표로 금액을 내며,
 * 뒤의 둘은 직접 입력이다.
 *
 * 앞의 넷의 key 는 `src/data/spend-catalog.json` 의 `categories` 와 같아야 한다. 그 파일의 항목이
 * 이 key 로 갈래를 가리킨다.
 */
export const SPEND_CATEGORIES = [
  { key: 'content', name: '컨텐츠', icon: 'monster_park_ticket.webp' },
  { key: 'event_bm', name: '이벤트·BM', icon: 'vip_sauna_ticket.webp' },
  { key: 'buff', name: '버프', icon: 'seiram_elixir.webp' },
  { key: 'scroll', name: '주문서', icon: 'amazing_positive_chaos_scroll.webp' },
  { key: 'symbol', name: '심볼 강화', icon: 'authentic_symbol_selection_coupon.webp' },
  { key: 'item_purchase', name: '아이템 구매', icon: 'dark_boss_pendant.png' },
  { key: 'etc', name: '기타', icon: 'meso.webp' },
] as const

export type SpendCategoryKey = (typeof SPEND_CATEGORIES)[number]['key']

/**
 * 수익의 갈래. **차례가 곧 화면**이고 `[0]` 이 기본 갈래다.
 *
 * 사냥이 앞인 것은 계산기라 손이 가장 많이 가서이고, 기타는 안전망이라 끝이다. 기타가 없으면 나머지로
 * 안 잡히는 수입이 기록 자체를 못 남긴다.
 *
 * 솔 에르다 조각은 사냥에서 가격을 나중에 입력으로 보관한 조각을 판 날에 정산하는 갈래라 사냥 바로
 * 뒤다. 이름이 기록의 `category` 칸에 글자로 박히므로 바꾸면 기존 기록을 옮겨야 한다.
 *
 * `description` 은 갈래 카드에만 선다. 이름만으로는 `사냥` 과 `솔 에르다 조각` 이 무엇을 가르는지
 * 안 읽힌다(사용자 지정 2026-09-21). 저장되는 값이 아니라 화면 글자뿐이라 바꿔도 기록이 안 움직인다.
 */
export const INCOME_CATEGORIES = [
  {
    key: 'hunting',
    name: '사냥',
    icon: 'wealth_acquisition_potion_small.webp',
    description: '사냥 메소 · 솔 에르다 조각 기록',
  },
  {
    key: 'sol_erda_fragment',
    name: '솔 에르다 조각',
    icon: 'sol_erda_fragment.webp',
    description: '사냥 수익 조각 정산',
  },
  {
    key: 'item_sale',
    name: '아이템 판매',
    icon: 'dark_boss_pendant.png',
    description: '판매한 아이템 수익 기록',
  },
  { key: 'etc', name: '기타', icon: 'meso.webp', description: '이벤트 등 기타 수익 기록' },
] as const

export type IncomeCategoryKey = (typeof INCOME_CATEGORIES)[number]['key']

/**
 * 아이템 구매의 종류. **게임의 인벤토리 탭 이름**이다. 이 값 하나가 수량과 관세를 함께 가른다.
 *
 * 기타가 지출 갈래의 기타와 이름이 겹치지만 사용자가 아는 말이 그것이라 바꾸지 않는다.
 */
export const SPEND_ITEM_KINDS = [
  { key: 'equipment', name: '장비' },
  { key: 'consumable', name: '소비' },
  { key: 'etc', name: '기타' },
] as const

export type SpendItemKindKey = (typeof SPEND_ITEM_KINDS)[number]['key']

/** 에픽던전 추가 리워드가 값을 받는 형태. 짧은 이름은 하루 목록의 줄 이름에 들어간다(사용자 지정). */
export const SPEND_FORMS = [
  { key: 'exp', name: '경험치', shortName: 'EXP' },
  { key: 'sol_erda', name: '솔 에르다', shortName: '솔' },
] as const

export type SpendForm = (typeof SPEND_FORMS)[number]
export type SpendFormKey = SpendForm['key']

export function spendCategoryNameOf(key: SpendCategoryKey): string {
  return SPEND_CATEGORIES.find((each) => each.key === key)!.name
}

export function incomeCategoryNameOf(key: IncomeCategoryKey): string {
  return INCOME_CATEGORIES.find((each) => each.key === key)!.name
}

export function spendItemKindNameOf(key: SpendItemKindKey): string {
  return SPEND_ITEM_KINDS.find((each) => each.key === key)!.name
}

/** 형태 하나. 모르는 key 는 `null` 이다. 카탈로그가 적은 형태가 이 표에 없을 수 있다. */
export function spendFormOf(key: string): SpendForm | null {
  return SPEND_FORMS.find((each) => each.key === key) ?? null
}

/** 이름에서 key. 이름만 저장된 옛 기록을 옮기는 이관이 쓴다. */
export function spendCategoryKeyOfName(name: string): SpendCategoryKey | null {
  return SPEND_CATEGORIES.find((each) => each.name === name)?.key ?? null
}

export function incomeCategoryKeyOfName(name: string): IncomeCategoryKey | null {
  return INCOME_CATEGORIES.find((each) => each.name === name)?.key ?? null
}

export function spendItemKindKeyOfName(name: string): SpendItemKindKey | null {
  return SPEND_ITEM_KINDS.find((each) => each.name === name)?.key ?? null
}

/** 수량과 관세가 서는 것은 **장비가 아닐 때**다. 판정이 한 자리에 산다. */
export function countsQuantity(kind: SpendItemKindKey): boolean {
  return kind !== 'equipment'
}
