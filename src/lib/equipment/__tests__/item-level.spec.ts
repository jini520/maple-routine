// 장비 이름에서 레벨로. 스타포스 응답에 `item_level` 이 없어 이 표가 그 자리를 든다.
import { equipmentItemLevel } from '../item-level'

describe('이름으로 찾는다', () => {
  // API 는 띄어 주고(`아케인셰이드 나이트햇`) 표는 붙여 쓴다. 그대로 맞추면 한 건도 안 걸린다.
  it('API 가 주는 띄어쓴 이름을 그대로 받는다', () => {
    expect(equipmentItemLevel('아케인셰이드 나이트햇')).toBe(200)
  })

  it('붙여 쓴 이름도 같은 답이다', () => {
    expect(equipmentItemLevel('아케인셰이드나이트햇')).toBe(200)
  })

  // 세트 레벨이 개별 항목을 덮는다. 그래야 세트 한 줄로 수십 종이 채워진다.
  it('개별 레벨이 없어도 세트 레벨을 쓴다', () => {
    // 아케인셰이드 68종 중 관측된 것은 23종이고 나머지도 같은 세트다.
    expect(equipmentItemLevel('아케인셰이드 시즈건')).toBe(200)
  })

  it('사용자가 준 보조무기 레벨도 든다', () => {
    expect(equipmentItemLevel('데이모스 세이지 실드')).toBe(130)
  })
})

// **모름은 0 이 아니다.** 0 을 주면 레벨 0 짜리 장비가 생겨 비용이 조용히 틀린다.
describe('모르면 null', () => {
  it('레벨을 아직 안 받은 세트는 null 이다', () => {
    expect(equipmentItemLevel('앱솔랩스 나이트헬름')).toBeNull()
  })

  it('표에 없는 이름도 null 이다', () => {
    expect(equipmentItemLevel('없는 장비 이름')).toBeNull()
  })

  it('빈 이름도 던지지 않는다', () => {
    expect(equipmentItemLevel('')).toBeNull()
  })
})
