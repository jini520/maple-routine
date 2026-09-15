// 줄 표식을 고르는 열쇠.
//
// **화면 글자로 고르면 안 된다.** 손입력 줄에 적히는 것은 `item ?? category` 라 사용자가 항목
// 이름을 적으면 그것이 뜨고, 갈래 이름은 비었을 때만 선다. 보이는 글자로 그림을 찾으면 이름을
// 적은 줄에서만 그림이 사라진다.
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import { DAILY_QUEST_ICON_ASSETS } from '../../../assets/generated/map-icons'
import { ITEM_ASSETS } from '../../../assets/generated/items'
import type { DayRecord } from '../records'
import { recordIconKeyOf, recordIconOf } from '../row-icon'

const income = (over: Partial<IncomeRecord> = {}): DayRecord => ({
  kind: 'income',
  characterName: '',
  record: {
    id: 'i',
    ocid: null,
    earnedOn: '2026-09-05',
    category: 'hunting',
    item: null,
    ...over,
  } as IncomeRecord,
})

const spend = (over: Partial<SpendRecord> = {}): DayRecord => ({
  kind: 'spend',
  characterName: '',
  record: {
    id: 's',
    ocid: null,
    spentOn: '2026-09-05',
    category: 'buff',
    item: null,
    itemKey: null,
    formItemKeys: null,
    ...over,
  } as SpendRecord,
})

describe('recordIconKeyOf', () => {
  it('보스 결정석 줄', () => {
    expect(
      recordIconKeyOf({
        kind: 'bossCrystal',
        characterName: '낟낟',
        ocid: 'o',
        payoutMeso: 1,
        count: 1,
        bosses: [],
      } as unknown as DayRecord),
    ).toBe('bossCrystal')
  })

  it('강화 줄은 기록 종류와 갈래 key 로 잡는다', () => {
    expect(
      recordIconKeyOf({
        kind: 'enhancement',
        characterName: '낟낟',
        category: 'cube_reset',
        payoutMeso: 1,
        count: 1,
        items: [],
      } as unknown as DayRecord),
    ).toBe('enhancement:cube_reset')
  })

  // 수익 `기타` 와 지출 `기타` 가 겹치지 않게 기록 종류를 앞에 붙인다.
  it('손입력 줄은 이름을 적어도 기록 종류와 갈래 key 로 잡는다', () => {
    expect(recordIconKeyOf(spend({ item: '세이람의 영약 3개' }))).toBe('spend:buff')
    expect(recordIconKeyOf(income({ item: '아무거나' }))).toBe('income:hunting')
    expect(recordIconKeyOf(income({ category: 'etc' }))).not.toBe(recordIconKeyOf(spend({ category: 'etc' })))
  })

  // 그림이 없는 갈래도 열쇠는 낸다. 무엇을 그릴지는 조회표가 정하므로, 나중에 그림을 붙일 때
  // 고치는 것이 표 한 줄이지 이 함수가 아니다.
  it('그림이 없는 갈래도 열쇠는 낸다', () => {
    expect(
      recordIconKeyOf({
        kind: 'dropSale',
        characterName: '낟낟',
        ocid: 'o',
        payoutMeso: 1,
        count: 1,
        unpricedCount: 0,
      } as unknown as DayRecord),
    ).toBe('dropSale')
    expect(recordIconKeyOf(spend({ category: 'content' }))).toBe('spend:content')
  })
})

// 지출의 목록 갈래는 시트에서 고른 타일의 그림을 쓴다. 시트와 줄이 같은 조회를 써야 둘이 다른 그림을 그리지 않는다.
describe('recordIconOf', () => {
  it('에픽던전 추가 리워드는 형태별 항목 key 로 타일을 되짚어 지역 그림을 쓴다', () => {
    expect(
      recordIconOf(spend({ category: 'content', itemKey: null, formItemKeys: { exp: 'high_mountain_2', sol_erda: 'high_mountain_1' } })),
    ).toBe(DAILY_QUEST_ICON_ASSETS.highMountain)
  })

  // 버프 갈래 전체가 세이람의 영약 하나이던 것이 끝난다.
  it('버프는 고른 영약의 그림이다', () => {
    expect(recordIconOf(spend({ category: 'buff', itemKey: 'alleria_elixir' }))).toBe(ITEM_ASSETS['alleria_elixir.webp'])
    expect(recordIconOf(spend({ category: 'buff', itemKey: 'alleria_elixir' }))).not.toBe(ITEM_ASSETS['seiram_elixir.webp'])
  })

  it('주문서 · 이벤트·BM 은 고른 타일의 그림이다', () => {
    expect(recordIconOf(spend({ category: 'scroll', itemKey: 'amazing_positive_chaos_scroll_60' }))).toBe(
      ITEM_ASSETS['amazing_positive_chaos_scroll.webp'],
    )
    expect(recordIconOf(spend({ category: 'event_bm', itemKey: 'nickname_change' }))).toBe(ITEM_ASSETS['npc_mr_newname.webp'])
  })

  // 비슷한 그림을 갖다 붙이면 틀린 것을 그린다.
  it('그림 없는 타일과 되짚지 못한 기록은 그림이 없다', () => {
    expect(recordIconOf(spend({ category: 'event_bm', itemKey: 'tonic_buff_reset' }))).toBeNull()
    expect(recordIconOf(spend({ category: 'buff', itemKey: null, item: '없어진 영약' }))).toBeNull()
    expect(recordIconOf(spend({ category: 'buff', itemKey: 'nope' }))).toBeNull()
  })

  // 이름을 치는 갈래는 갈래 key 로 잡는다. 기타 둘은 두 시트의 기타 카드와 같은 메소 주머니다.
  it('기타(수익) · 기타(지출)은 메소 주머니이고 아이템 구매 · 아이템 판매는 그림이 없다', () => {
    expect(recordIconOf(spend({ category: 'etc', item: '아무거나' }))).toBe(ITEM_ASSETS['meso.webp'])
    expect(recordIconOf(income({ category: 'etc', item: '아무거나' }))).toBe(ITEM_ASSETS['meso.webp'])
    expect(recordIconOf(spend({ category: 'item_purchase', item: '루즈 컨트롤 머신 마크' }))).toBeNull()
    expect(recordIconOf(income({ category: 'item_sale', item: '앱솔 무기' }))).toBeNull()
  })

  it('사냥 줄은 지금 그림 그대로다', () => {
    expect(recordIconOf(income({ item: '아무거나' }))).toBe(ITEM_ASSETS['wealth_acquisition_potion_small.webp'])
  })
})
