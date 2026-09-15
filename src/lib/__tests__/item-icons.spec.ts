
import { assetUri } from '../../assets/__tests__/asset-uri'
import { cashbookRowIconOf, dropItemIconOf, getItemIconUrlByFile, spendIconOf } from '../assets/asset-lookup'

describe('dropItemIconOf', () => {
  it('마스터 표에 그림이 있는 아이템은 그 파일로 조회된다 (홍옥의 보스 반지 상자 -> boss_ring_box_red.png)', () => {
    const url = dropItemIconOf('red_boss_ring_box')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('boss_ring_box_red')
  })

  it('반지는 rings/ 하위 파일로 조회된다 (리스트레인트 링 -> Ring_of_Restraint.webp)', () => {
    expect(assetUri(dropItemIconOf('restraint_ring'))).toContain('Ring_of_Restraint')
  })

  it('슬롯별 익셉셔널 해머는 각 슬롯 아이콘으로 조회된다', () => {
    expect(assetUri(dropItemIconOf('exceptional_hammer_face_accessory'))).toContain('except_face_acc')
    expect(assetUri(dropItemIconOf('exceptional_hammer_eye_accessory'))).toContain('except_eye_acc')
    expect(assetUri(dropItemIconOf('exceptional_hammer_medal'))).toContain('except_merit')
    expect(assetUri(dropItemIconOf('exceptional_hammer_earring'))).toContain('except_earring')
    expect(assetUri(dropItemIconOf('exceptional_hammer_belt'))).toContain('except_belt')
  })

  it('기타(백옥 밖 저가치 반지 묶음)는 리밋 링 아이콘으로 조회된다', () => {
    expect(assetUri(dropItemIconOf('other_ring'))).toContain('Limit_Ring')
  })

  it('반지 상자에도 드는 생명의 연마석은 whetstone 그림이다', () => {
    expect(assetUri(dropItemIconOf('life_whetstone'))).toContain('whetstone_life')
  })

  it('주문서 교환권 3종은 각자의 아이콘으로 조회된다', () => {
    expect(assetUri(dropItemIconOf('premium_accessory_scroll_voucher'))).toContain('premium_accessory_scroll_coupon')
    expect(assetUri(dropItemIconOf('premium_pet_equipment_scroll_voucher'))).toContain('premium_petequip_scroll_coupon')
    expect(assetUri(dropItemIconOf('magical_weapon_scroll_voucher'))).toContain('magical_weapon_scroll_coupon')
  })

  // 그림 없는 줄 · 모르는 key · key 없는 옛 기록은 비운다. 비슷한 그림을 붙이면 틀린 것을 그린다.
  it('그림이 없거나 모르는 key 이거나 key 가 없으면 null 이다', () => {
    expect(dropItemIconOf('sol_erda_energy')).toBeNull()
    expect(dropItemIconOf('nope')).toBeNull()
    expect(dropItemIconOf(null)).toBeNull()
  })
})

describe('getItemIconUrlByFile', () => {
  it('파일명으로 표시전용 아이콘(솔 에르다 단위)을 조회한다', () => {
    expect(assetUri(getItemIconUrlByFile('sole_500.webp'))).toContain('sole_500')
    expect(assetUri(getItemIconUrlByFile('sole_10.png'))).toContain('sole_10')
  })

  it('없는 파일은 null을 반환한다', () => {
    expect(getItemIconUrlByFile('nope.png')).toBeNull()
  })
})

// 가계부 줄 표식이 실제 파일에 닿는가.
//
// 표에 파일 이름을 손으로 적으므로 오타 한 글자면 그 줄만 조용히 아이콘으로 남는다. 화면에서는
// **아직 안 바꿨나** 로 보여 고장으로 안 읽힌다.
describe('가계부 줄 표식', () => {
  it.each([
    'bossCrystal',
    'enhancement:cube_reset',
    'enhancement:starforce',
    'enhancement:potential',
    'enhancement:additional_potential',
    'income:hunting',
    'spend:buff',
  ])('%s 줄이 그림을 찾는다', (key) => {
    expect(cashbookRowIconOf(key)).not.toBeNull()
  })

  // 표에 없는 갈래는 `null` 이어야 화면이 아이콘으로 떨어진다. 폴백 그림을 두면 틀린 것을 그린다.
  it.each(['dropSale', 'income:item_sale', 'income:etc', 'spend:content', 'spend:event_bm', 'spend:item_purchase', 'spend:etc'])(
    '%s 줄은 그림이 없다',
    (key) => {
      expect(cashbookRowIconOf(key)).toBeNull()
    },
  )
})

// 지출 타일 그림. 그림은 카탈로그의 `tiles` 가 들고 여기서는 자산으로 풀기만 한다.
describe('spendIconOf', () => {
  it('아이템 그림 파일은 타일 왼쪽에 선다', () => {
    const icon = spendIconOf({ file: 'seiram_elixir.webp' })
    expect(icon?.ref).toBeDefined()
    expect(icon?.beside).toBe(false)
  })

  it('지역 아이콘은 이름 옆에 선다', () => {
    const icon = spendIconOf({ map: 'highMountain' })
    expect(icon?.ref).toBeDefined()
    expect(icon?.beside).toBe(true)
  })

  it('그림이 없거나 못 찾으면 null 이다', () => {
    expect(spendIconOf(undefined)).toBeNull()
    expect(spendIconOf({ file: 'nope.webp' })).toBeNull()
    expect(spendIconOf({ map: 'nope' })).toBeNull()
  })
})
