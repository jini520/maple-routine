import {
  MVP_GRADES,
  auctionFeePercentOf,
  findMvpGrade,
  highestMvpGrade,
  starforceDiscountPercentOf,
} from '../grades'

describe('MVP 등급 표', () => {
  // 사용자 확인값(2026-09-22). 옮겨 적다 틀리면 여기서 잡힌다.
  it('등급 일곱의 경매장 수수료와 스타포스 할인이 확인값과 같다', () => {
    expect(MVP_GRADES.map((grade) => [grade.key, grade.name, grade.auctionFeePercent, grade.starforceDiscountPercent])).toEqual([
      ['normal', '일반', 5, 0],
      ['bronze', '브론즈', 5, 0],
      ['silver', '실버', 3, 3],
      ['gold', '골드', 3, 5],
      ['diamond', '다이아', 3, 10],
      ['red', '레드', 3, 10],
      ['black', '블랙', 3, 10],
    ])
  })

  it('모르는 key 는 없다', () => {
    expect(findMvpGrade('platinum')).toBeNull()
    expect(findMvpGrade('gold')?.name).toBe('골드')
  })
})

describe('등급이 없을 때', () => {
  it('수수료는 일반 요율이다', () => {
    expect(auctionFeePercentOf(null)).toBe(5)
    expect(auctionFeePercentOf('silver')).toBe(3)
  })

  it('스타포스는 할인이 없다', () => {
    expect(starforceDiscountPercentOf(null)).toBe(0)
    expect(starforceDiscountPercentOf('diamond')).toBe(10)
  })
})

describe('가장 높은 등급', () => {
  it('표의 차례로 가장 뒤의 것이다', () => {
    expect(highestMvpGrade(['silver', 'black', 'gold'])).toBe('black')
    expect(highestMvpGrade(['bronze', null, 'normal'])).toBe('bronze')
  })

  it('등급이 하나도 없으면 없다', () => {
    expect(highestMvpGrade([])).toBeNull()
    expect(highestMvpGrade([null, null])).toBeNull()
  })
})

describe('명패 그림', () => {
  const { mvpPlateAsset } = jest.requireActual<typeof import('../../assets/asset-lookup')>('../../assets/asset-lookup')

  it('일반을 뺀 여섯 등급에 명패가 있다', () => {
    for (const grade of MVP_GRADES) {
      if (grade.key === 'normal') expect(mvpPlateAsset(grade.key)).toBeNull()
      else expect(mvpPlateAsset(grade.key)).not.toBeNull()
    }
  })
})
