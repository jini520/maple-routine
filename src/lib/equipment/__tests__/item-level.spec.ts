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

  // 관측이 23종뿐인데 68종이 다 채워져 있다. 세트가 한 레벨이라는 사실을 표에 굳혀 둔 결과다.
  it('관측에 없던 같은 세트 장비도 값을 갖는다', () => {
    expect(equipmentItemLevel('아케인셰이드 시즈건')).toBe(200)
  })

  it('사용자가 준 세트 레벨이 들어 있다', () => {
    expect(equipmentItemLevel('앱솔랩스 나이트헬름')).toBe(160)
    expect(equipmentItemLevel('데스티니 세이버')).toBe(250)
    expect(equipmentItemLevel('파프니르 체인')).toBe(150)
  })

  it('보스 장신구·칠흑·광휘도 값을 갖는다', () => {
    expect(equipmentItemLevel('파풀라투스 마크')).toBe(145)
    expect(equipmentItemLevel('루즈 컨트롤 머신 마크')).toBe(160)
    expect(equipmentItemLevel('오만의 원죄')).toBe(250)
  })

  it('사용자가 준 보조무기 레벨도 든다', () => {
    expect(equipmentItemLevel('데이모스 세이지 실드')).toBe(130)
    expect(equipmentItemLevel('아스트라 여의보주')).toBe(200)
    expect(equipmentItemLevel('아스트라 데카코어 컨트롤러')).toBe(200)
  })

  it('제네시스 카르타는 카타나와 다른 무기다', () => {
    expect(equipmentItemLevel('제네시스 카르타')).toBe(200)
    expect(equipmentItemLevel('제네시스 카타나')).toBe(200)
  })
})

// 키는 `arcane_umbra_soul_shooter` 인데 이름이 아케인셰이드엔젤릭슈터로 들어와 있었다. API 가
// 주는 이름과 안 맞아 11건이 조용히 빠졌다. 키의 영문을 이름으로 옮겨 적을 때 나는 종류다.
it('키와 이름이 어긋나 안 붙던 자리를 지킨다', () => {
  expect(equipmentItemLevel('아케인셰이드 소울슈터')).toBe(200)
  expect(equipmentItemLevel('아케인셰이드 엔젤릭슈터')).toBeNull()
})

// **모름은 0 이 아니다.** 0 을 주면 레벨 0 짜리 장비가 생겨 비용이 조용히 틀린다.
describe('모르면 null', () => {
  it('표에 없는 이름도 null 이다', () => {
    expect(equipmentItemLevel('없는 장비 이름')).toBeNull()
  })

  it('빈 이름도 던지지 않는다', () => {
    expect(equipmentItemLevel('')).toBeNull()
  })
})

// 강화가 불가능한 장비는 표에 안 담는다(사용자 지정). 담아 두면 다음 세션이 그 자리를 빈
// 레벨로 보고 채우려 든다.
it('강화 불가 장비는 표에 없다', () => {
  expect(equipmentItemLevel('도전자의 모자')).toBeNull()
  expect(equipmentItemLevel('칠요의 뱃지')).toBeNull()
})
