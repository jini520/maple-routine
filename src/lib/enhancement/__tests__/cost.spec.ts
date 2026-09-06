/**
 * 값은 전부 사용자(도메인 전문가)가 준 것이다. 여기서 그 값을 못박아 다음 세션이 식을 만지다
 * 조용히 어긋나는 것을 막는다.
 */
import {
  cubeAppraisalCost,
  potentialResetCost,
  starforceCost,
} from '../cost'

describe('큐브 감정비용', () => {
  // 사용자가 표로 준 여섯 값. 식 `20 * L^2` 이 이 여섯과 마지막 자리까지 맞아 식으로 접었다.
  it.each([
    [130, 338_000],
    [140, 392_000],
    [150, 450_000],
    [160, 512_000],
    [200, 800_000],
    [250, 1_250_000],
  ])('레벨 %d 은 %d 메소', (level, expected) => {
    expect(cubeAppraisalCost(level)).toBe(expected)
  })

  it('표에 없던 레벨도 식이 채운다', () => {
    expect(cubeAppraisalCost(135)).toBe(364_500)
  })

  it('120 이하는 무료다. 통찰력 100 을 가정한다', () => {
    expect(cubeAppraisalCost(120)).toBe(0)
    expect(cubeAppraisalCost(30)).toBe(0)
  })
})

describe('잠재능력 재설정 비용', () => {
  it('본 잠재는 레벨 구간과 등급으로 정해진다', () => {
    expect(potentialResetCost('잠재능력 재설정', 250, '레전드리')).toBe(50_000_000)
    expect(potentialResetCost('잠재능력 재설정', 200, '유니크')).toBe(38_250_000)
    expect(potentialResetCost('잠재능력 재설정', 160, '에픽')).toBe(17_000_000)
    expect(potentialResetCost('잠재능력 재설정', 150, '레어')).toBe(4_000_000)
  })

  it('에디셔널은 표가 따로다', () => {
    expect(potentialResetCost('에디셔널 잠재능력 재설정', 250, '레전드리')).toBe(98_000_000)
    expect(potentialResetCost('에디셔널 잠재능력 재설정', 160, '레어')).toBe(10_375_000)
  })

  it('구간 경계는 아래쪽 줄에 붙는다', () => {
    expect(potentialResetCost('잠재능력 재설정', 249, '레전드리')).toBe(45_000_000)
    expect(potentialResetCost('잠재능력 재설정', 199, '레전드리')).toBe(42_500_000)
    expect(potentialResetCost('잠재능력 재설정', 159, '레전드리')).toBe(40_000_000)
  })

  it('노멀은 재설정할 수 없는 등급이라 값이 없다', () => {
    expect(potentialResetCost('잠재능력 재설정', 200, '노멀')).toBeNull()
  })
})

describe('스타포스 비용', () => {
  // 사용자가 준 실측 한 건. 반올림 앞뒤와 할인 순서가 여기 다 걸린다.
  it('160 레벨 18 성은 반올림해서 165,920,200 이다', () => {
    expect(starforceCost(160, 18)).toBe(165_920_200)
  })

  it('할인은 반올림 뒤에 붙는다', () => {
    expect(starforceCost(160, 18, 30)).toBe(116_144_140)
  })

  it('10 성 밑은 지수가 1 이라 값이 훨씬 싸다', () => {
    // 1000 + 200^3 * 1 / 36
    expect(starforceCost(200, 0)).toBe(223_200)
  })

  it('15 성과 16 성이 같은 나눗수를 쓴다', () => {
    // 같은 나눗수(200)라 값의 차이는 (S+1)^2.7 에서만 온다.
    expect(starforceCost(150, 15)).toBe(30_087_200)
    expect(starforceCost(150, 16)).toBe(35_437_900)
  })

  it('성수를 벗어나면 값이 없다', () => {
    expect(starforceCost(160, 30)).toBeNull()
    expect(starforceCost(160, -1)).toBeNull()
  })
})
