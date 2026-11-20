// 줄 표식을 고르는 열쇠.
//
// **화면 글자로 고르면 안 된다.** 손입력 줄에 적히는 것은 `item ?? category` 라 사용자가 항목
// 이름을 적으면 그것이 뜨고, 분류 이름은 비었을 때만 선다. 보이는 글자로 그림을 찾으면 이름을
// 적은 줄에서만 그림이 사라진다.
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import { assetIdOfPath, imageOfPath } from '../../../assets/__tests__/asset-uri'
import { enhancementCostsTable } from '../../../lib/enhancement/cost'
import type { DayRecord, EnhancedItem } from '../records'
import { enhancedItemIconOf, recordIconKeyOf, recordIconOf } from '../row-icon'

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
  it('강화 줄은 기록 종류와 분류 key 로 잡는다', () => {
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
  it('손입력 줄은 이름을 적어도 기록 종류와 분류 key 로 잡는다', () => {
    expect(recordIconKeyOf(spend({ item: '세이람의 영약 3개' }))).toBe('spend:buff')
    expect(recordIconKeyOf(income({ item: '아무거나' }))).toBe('income:hunting')
    expect(recordIconKeyOf(income({ category: 'etc' }))).not.toBe(recordIconKeyOf(spend({ category: 'etc' })))
  })

  // 그림이 없는 분류도 열쇠는 낸다. 무엇을 그릴지는 조회표가 정하므로, 나중에 그림을 붙일 때
  // 고치는 것이 표 한 줄이지 이 함수가 아니다.
  it('그림이 없는 분류도 열쇠는 낸다', () => {
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

// 지출에서 목록으로 고르는 분류는 시트에서 고른 타일의 그림을 쓴다. 시트와 줄이 같은 조회를 써야 둘이 다른 그림을 그리지 않는다.
describe('recordIconOf', () => {
  it('에픽던전 추가 리워드는 형태별 항목 key 로 타일을 되짚어 지역 그림을 쓴다', () => {
    expect(
      recordIconOf(spend({ category: 'content', itemKey: null, formItemKeys: { exp: 'high_mountain_2', sol_erda: 'high_mountain_1' } })),
    ).toBe(imageOfPath('maps/icons/highMountain.png'))
  })

  // 버프 분류 전체가 세이람의 영약 하나이던 것이 끝난다.
  it('버프는 고른 영약의 그림이다', () => {
    expect(recordIconOf(spend({ category: 'buff', itemKey: 'alleria_elixir' }))).toBe(imageOfPath('items/alleria_elixir.webp'))
    expect(recordIconOf(spend({ category: 'buff', itemKey: 'alleria_elixir' }))).not.toBe(imageOfPath('items/seiram_elixir.webp'))
  })

  it('주문서 · 이벤트·BM 은 고른 타일의 그림이다', () => {
    expect(recordIconOf(spend({ category: 'scroll', itemKey: 'amazing_positive_chaos_scroll_60' }))).toBe(
      imageOfPath('items/amazing_positive_chaos_scroll.webp'),
    )
    expect(recordIconOf(spend({ category: 'event_bm', itemKey: 'nickname_change' }))).toBe(imageOfPath('items/npc_mr_newname.webp'))
  })

  // 분류 그림 하나로 그리면 순록의 우유와 돋보기 줄이 같은 그림이 된다.
  it('사냥 전리품 판매는 전리품 표에서 찾은 그 아이템의 그림이다', () => {
    expect(recordIconOf(income({ category: 'hunt_loot_sale', itemKey: 'reindeer_milk' }))).toBe(
      imageOfPath('items/reindeer_milk.webp'),
    )
    expect(recordIconOf(income({ category: 'hunt_loot_sale', itemKey: 'suspicious_magnifier' }))).toBe(
      imageOfPath('items/suspicious_magnifier.webp'),
    )
  })

  it('헥사 스킬은 그 코어의 스킬 그림이고, 헥사 스탯은 분류 카드와 같은 헥사 매트릭스 그림이다', () => {
    const 조각 = { fragmentCount: 345, untradableFragmentCount: 0, fragmentPrice: 1, useStorage: false, storageAsSpend: false, storageUses: [] }
    expect(recordIconOf(spend({ category: 'hexa_matrix', itemKey: '창룡파천검 : 만참', hexa: { ...조각, activation: null } }))).toBe(
      imageOfPath('skills/KEJDKDOEMH.webp'),
    )
    expect(recordIconOf(spend({ category: 'hexa_matrix', itemKey: 'hexa_stat_1', hexa: { ...조각, activation: false } }))).toBe(
      imageOfPath('items/hexa_matrix.webp'),
    )
    expect(imageOfPath('skills/KEJDKDOEMH.webp')).not.toBeNull()
  })

  // 선택 목록이 아니라 비용 표에서 심볼을 되짚는다.
  it('심볼 강화는 고른 심볼의 그림이다', () => {
    expect(recordIconOf(spend({ category: 'symbol', itemKey: 'cernium', levelFrom: 1, levelTo: 2 }))).toBe(
      imageOfPath('items/authentic_symbol_cernium.webp'),
    )
    expect(recordIconOf(spend({ category: 'symbol', itemKey: 'nope' }))).toBeNull()
  })

  // 비슷한 그림을 갖다 붙이면 틀린 것을 그린다.
  it('그림 없는 타일과 되짚지 못한 기록은 그림이 없다', () => {
    expect(recordIconOf(spend({ category: 'event_bm', itemKey: 'tonic_buff_reset' }))).toBeNull()
    expect(recordIconOf(spend({ category: 'buff', itemKey: null, item: '없어진 영약' }))).toBeNull()
    expect(recordIconOf(spend({ category: 'buff', itemKey: 'nope' }))).toBeNull()
  })

  // 이름을 치는 분류는 분류 key 로 잡는다. 기타 둘은 두 시트의 기타 카드와 같은 메소 주머니다.
  it('기타(수익) · 기타(지출)은 메소 주머니이고 아이템 구매 · 아이템 판매는 그림이 없다', () => {
    expect(recordIconOf(spend({ category: 'etc', item: '아무거나' }))).toBe(imageOfPath('items/meso.webp'))
    expect(recordIconOf(income({ category: 'etc', item: '아무거나' }))).toBe(imageOfPath('items/meso.webp'))
    expect(recordIconOf(spend({ category: 'item_purchase', item: '루즈 컨트롤 머신 마크' }))).toBeNull()
    expect(recordIconOf(income({ category: 'item_sale', item: '앱솔 무기' }))).toBeNull()
  })

  it('목록에서 고른 아이템 구매 · 판매는 그 아이템의 그림이다', () => {
    expect(recordIconOf(spend({ category: 'item_purchase', item: null, itemKey: 'risk_taker_ring' }))).toBe(
      imageOfPath('items/rings/Risk_Taker_Ring.webp'),
    )
    expect(recordIconOf(income({ category: 'item_sale', item: null, itemKey: 'risk_taker_ring' }))).toBe(
      imageOfPath('items/rings/Risk_Taker_Ring.webp'),
    )
  })
})

// 펼친 강화 줄의 장비 그림. 강화 장비 표의 장비는 아이템 표에 같은 key 로 들어 있어 key 로 찾는다.
describe('enhancedItemIconOf', () => {
  const 장비 = (itemKey: string | null, targetItem: string): EnhancedItem => ({
    itemKey,
    targetItem,
    count: 1,
    costMeso: 1,
    fromStar: null,
    toStar: null,
  })

  it('장비 key 로 아이템 표의 그림을 찾고, key 로 찾으면 이름은 보지 않는다', () => {
    expect(imageOfPath('items/dark_boss_ring.png')).not.toBeNull()
    expect(enhancedItemIconOf(장비('giant_terror', '거대한 공포'))).toBe(imageOfPath('items/dark_boss_ring.png'))
    expect(enhancedItemIconOf(장비('giant_terror', '루즈 컨트롤 머신 마크'))).toBe(imageOfPath('items/dark_boss_ring.png'))
  })

  // 강화 장비 표에 없는 장비는 합계 줄에 key 없이 넥슨이 준 이름만 남는다. 그 이름은 띄어쓰기가 아이템 표와 다를 수 있다.
  it('key 로 못 찾으면 공백을 지운 이름으로 아이템 표를 찾는다', () => {
    expect(imageOfPath('items/dark_boss_face_acc.png')).not.toBeNull()
    expect(enhancedItemIconOf(장비(null, '루즈 컨트롤머신 마크'))).toBe(imageOfPath('items/dark_boss_face_acc.png'))
    expect(enhancedItemIconOf(장비('nope', '루즈 컨트롤 머신 마크'))).toBe(imageOfPath('items/dark_boss_face_acc.png'))
  })

  // 타일런트 신발 · 장갑 · 망토와 노바 · 헬리시움 정예는 아이템 표에 없고 슈페리얼 장비 표에만 그림이 있다.
  describe('아이템 표에 없는 슈페리얼 장비', () => {
    const fixture = enhancementCostsTable.get()
    afterEach(() => enhancementCostsTable.set(fixture))

    it('슈페리얼 장비 표의 그림을 쓴다', () => {
      const icon = assetIdOfPath('items/dark_boss_belt.png')
      expect(icon).toBeDefined()
      enhancementCostsTable.set({
        ...fixture,
        superiorItems: [{ name: '노바 리카온 벨트', seriesKey: 'nova', iconAssetId: icon ?? null }],
      })

      expect(enhancedItemIconOf(장비(null, '노바 리카온벨트'))).toBe(imageOfPath('items/dark_boss_belt.png'))
    })
  })

  // 비슷한 장비의 그림을 대신 붙이면 다른 장비를 그린다.
  it('key 로도 이름으로도 못 찾으면 그림이 없다', () => {
    expect(enhancedItemIconOf(장비(null, '왕푸'))).toBeNull()
  })
})
