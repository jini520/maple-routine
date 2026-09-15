// 장비 마스터 표 조회. 강화 기록은 장비 key 를 들고 레벨은 여기서 찾는다. 스타포스 응답에 `item_level` 이 없어서다.
import {
  comparableEquipmentName,
  equipmentItemKeyOfApiName,
  equipmentItemLevelOf,
  findEquipmentItem,
} from '../equipment-items'

/** API 이름에서 레벨까지. 응답을 받는 자리가 key 를 얻고 값을 매기는 자리가 레벨을 찾는 두 걸음을 잇는다. */
function levelOfApiName(name: string): number | null {
  return equipmentItemLevelOf(equipmentItemKeyOfApiName(name))
}

describe('API 이름에서 key 를 찾는다', () => {
  // API 는 띄어 주고(`아케인셰이드 나이트햇`) 표는 붙여 쓴다. 그대로 맞추면 한 건도 안 걸린다.
  it('API 가 주는 띄어쓴 이름을 그대로 받는다', () => {
    expect(equipmentItemKeyOfApiName('아케인셰이드 나이트햇')).toBe('arcane_umbra_knight_hat')
    expect(levelOfApiName('아케인셰이드 나이트햇')).toBe(200)
  })

  it('붙여 쓴 이름과 NFD 글자도 같은 key 다', () => {
    expect(equipmentItemKeyOfApiName('아케인셰이드나이트햇')).toBe('arcane_umbra_knight_hat')
    expect(equipmentItemKeyOfApiName('아케인셰이드 나이트햇'.normalize('NFD'))).toBe('arcane_umbra_knight_hat')
  })

  // 드롭 아이템 표와 같은 장비는 같은 key 다. 드롭 기록이 이미 그 key 를 저장한다.
  it('드롭 표와 겹치는 장비는 드롭 표의 key 다', () => {
    expect(equipmentItemKeyOfApiName('루즈 컨트롤 머신 마크')).toBe('loose_control_machine_mark')
    expect(equipmentItemKeyOfApiName('거대한 공포')).toBe('giant_terror')
    expect(equipmentItemKeyOfApiName('근원의 속삭임')).toBe('whisper_of_origin')
  })

  it('표에 없는 이름과 빈 이름은 null 이다', () => {
    expect(equipmentItemKeyOfApiName('골드 히어로즈 엠블렘')).toBeNull()
    expect(equipmentItemKeyOfApiName('')).toBeNull()
  })

  // 강화가 불가능한 장비는 표에 안 담는다(사용자 지정). 담아 두면 다음 세션이 그 자리를 빈 레벨로 보고 채우려 든다.
  it('강화 불가 장비는 표에 없다', () => {
    expect(equipmentItemKeyOfApiName('도전자의 모자')).toBeNull()
    expect(equipmentItemKeyOfApiName('칠요의 뱃지')).toBeNull()
  })

  // 키는 `arcane_umbra_soul_shooter` 인데 이름이 아케인셰이드엔젤릭슈터로 들어와 있었다. API 가
  // 주는 이름과 안 맞아 11건이 조용히 빠졌다. 키의 영문을 이름으로 옮겨 적을 때 나는 종류다.
  it('키와 이름이 어긋나 안 붙던 자리를 지킨다', () => {
    expect(levelOfApiName('아케인셰이드 소울슈터')).toBe(200)
    expect(equipmentItemKeyOfApiName('아케인셰이드 엔젤릭슈터')).toBeNull()
  })
})

describe('key 로 레벨을 찾는다', () => {
  // 관측이 23종뿐인데 68종이 다 채워져 있다. 세트가 한 레벨이라는 사실을 표에 굳혀 둔 결과다.
  it('관측에 없던 같은 세트 장비도 값을 갖는다', () => {
    expect(levelOfApiName('아케인셰이드 시즈건')).toBe(200)
  })

  it('사용자가 준 세트 레벨이 들어 있다', () => {
    expect(levelOfApiName('앱솔랩스 나이트헬름')).toBe(160)
    expect(levelOfApiName('데스티니 세이버')).toBe(250)
    expect(levelOfApiName('파프니르 체인')).toBe(150)
  })

  it('보스 장신구·칠흑·광휘도 값을 갖는다', () => {
    expect(levelOfApiName('파풀라투스 마크')).toBe(145)
    expect(levelOfApiName('루즈 컨트롤 머신 마크')).toBe(160)
    expect(levelOfApiName('오만의 원죄')).toBe(250)
  })

  it('사용자가 준 보조무기 레벨도 든다', () => {
    expect(levelOfApiName('데이모스 세이지 실드')).toBe(130)
    expect(levelOfApiName('아스트라 여의보주')).toBe(200)
    expect(levelOfApiName('아스트라 데카코어 컨트롤러')).toBe(200)
  })

  it('제네시스 카르타는 카타나와 다른 무기다', () => {
    expect(levelOfApiName('제네시스 카르타')).toBe(200)
    expect(levelOfApiName('제네시스 카타나')).toBe(200)
  })

  it('2026-09-17 패치의 새 반지도 레벨을 갖는다 (사용자 제공)', () => {
    expect(levelOfApiName('어센던트 펄스 링')).toBe(130)
  })

  // **모름은 0 이 아니다.** 0 을 주면 레벨 0 짜리 장비가 생겨 비용이 조용히 틀린다.
  it('모르는 key 와 key 없음은 null 이다', () => {
    expect(equipmentItemLevelOf('nope')).toBeNull()
    expect(equipmentItemLevelOf(null)).toBeNull()
    expect(findEquipmentItem(undefined)).toBeNull()
  })
})

// 표에 없는 장비는 관측 레벨을 이름으로 찾는다. 그 이름을 API 이름과 같은 규칙으로 맞춘다.
it('비교용 이름은 NFC 뒤 공백을 모두 지운 글자다', () => {
  expect(comparableEquipmentName('골드 히어로즈  엠블렘')).toBe('골드히어로즈엠블렘')
  expect(comparableEquipmentName('블랙 마법깃펜'.normalize('NFD'))).toBe('블랙마법깃펜')
})
