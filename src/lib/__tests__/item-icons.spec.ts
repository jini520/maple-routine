
import { cashbookRowIconOf, dropItemIconOf } from '../assets/asset-lookup'

describe('dropItemIconOf', () => {
  // 그림 없는 줄 · 모르는 key · key 없는 옛 기록은 비운다. 비슷한 그림을 붙이면 틀린 것을 그린다.
  it('그림이 없거나 모르는 key 이거나 key 가 없으면 null 이다', () => {
    expect(dropItemIconOf('sol_erda_energy')).toBeNull()
    expect(dropItemIconOf('nope')).toBeNull()
    expect(dropItemIconOf(null)).toBeNull()
  })
})

// 가계부 줄 표식이 실제 그림에 닿는가.
//
// 표식은 앱 그림 표의 key 나 가계부 분류 표의 갈래로 찾는다. 하나라도 어긋나면 그 줄만 조용히 아이콘으로 남는다. 화면에서는
// **아직 안 바꿨나** 로 보여 고장으로 안 읽힌다.
describe('가계부 줄 표식', () => {
  it.each([
    'bossCrystal',
    'enhancement:cube_reset',
    'enhancement:starforce',
    'enhancement:potential',
    'enhancement:additional_potential',
    'enhancement:soul_potential',
    'income:hunting',
    'income:sol_erda_fragment',
    'income:etc',
    'spend:etc',
  ])('%s 줄이 그림을 찾는다', (key) => {
    expect(cashbookRowIconOf(key)).not.toBeNull()
  })

  // 표에 없는 갈래는 `null` 이어야 화면이 아이콘으로 떨어진다. 폴백 그림을 두면 틀린 것을 그린다.
  // 목록 갈래 넷(`spend:buff` 등)은 갈래 열쇠로 그림을 안 찾는다. 고른 타일의 그림이 줄 표식이다.
  it.each(['dropSale', 'income:item_sale', 'spend:content', 'spend:event_bm', 'spend:buff', 'spend:scroll', 'spend:item_purchase'])(
    '%s 줄은 그림이 없다',
    (key) => {
      expect(cashbookRowIconOf(key)).toBeNull()
    },
  )
})
