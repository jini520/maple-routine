// `이 캐릭터가 이 항목을 진행할 수 있는가`.
//
// 소비처가 다섯이다(컨텐츠 카드· 보스 카드· 컨텐츠 진행률· 초상화 링· today `남은 스케줄`).
// 판정이 흩어지면 **같은 항목이 화면마다 다르게 세어진다**. 이 금지하는 상태다.

import {
  bossRequiredLevel,
  contentRequiredLevel,
  isBossBlocked,
  isContentBlocked,
  isLevelBlocked,
} from '../scheduler/required-level'

describe('참조표 조회', () => {
  // 값은 절차로 들어온 사용자 제공분이다. 여기서 확인하는 것은 **읽어 오는가** 이지
  // 값 자체가 아니다(값을 지키는 것은 `data/__tests__` 의 형태 검사다).
  it('컨텐츠 이름으로 요구 레벨을 찾는다. 일간·주간 둘 다', () => {
    expect(contentRequiredLevel('몬스터파크')).toBe(105)
    expect(contentRequiredLevel('없는 컨텐츠')).toBeNull()
  })

  // 보스는 **`requiredLevel` 이 아니라 `requiredLevels`**(난이도별 맵)다. 이슈 본문이 이 필드명을
  // 잘못 세어 **27곳** 이라 적었다.
  it('보스는 난이도별로 찾는다', () => {
    expect(bossRequiredLevel('자쿰', '카오스')).toBe(90)
    expect(bossRequiredLevel('자쿰', '없는난이도')).toBeNull()
    expect(bossRequiredLevel('없는보스', '카오스')).toBeNull()
  })
})

describe('isLevelBlocked', () => {
  it('요구 레벨에 못 미치면 진행 불가다', () => {
    expect(isLevelBlocked(104, 105)).toBe(true)
  })

  it('같거나 넘으면 진행할 수 있다', () => {
    expect(isLevelBlocked(105, 105)).toBe(false)
    expect(isLevelBlocked(200, 105)).toBe(false)
  })

  // 두 **없음** 을 똑같이 다룬다.
  it('캐릭터 레벨을 모르면 단정하지 않는다', () => {
    expect(isLevelBlocked(null, 105)).toBe(false)
  })

  it('참조표에 요구 레벨이 없으면 **제한 없음** 으로 읽는다', () => {
    expect(isLevelBlocked(10, null)).toBe(false)
    expect(isLevelBlocked(null, null)).toBe(false)
  })
})

describe('항목별 판정', () => {
  it('컨텐츠. 이름으로 참조표를 거쳐 답한다', () => {
    expect(isContentBlocked(104, '몬스터파크')).toBe(true)
    expect(isContentBlocked(105, '몬스터파크')).toBe(false)
  })

  // 주간 컨텐츠 5개(유니온 둘· 길드 셋)에는 요구 레벨이 없다. 그 항목들은 어떤 레벨에서도
  // 진행 가능이다(`대가`).
  it('요구 레벨이 없는 컨텐츠는 어떤 레벨에서도 진행 가능이다', () => {
    expect(contentRequiredLevel('[길드] 지하 수로')).toBeNull()
    expect(isContentBlocked(1, '[길드] 지하 수로')).toBe(false)
  })

  it('보스. 난이도까지 보고 답한다', () => {
    expect(isBossBlocked(89, '자쿰', '카오스')).toBe(true)
    expect(isBossBlocked(90, '자쿰', '카오스')).toBe(false)
  })
})
