import {
  mvpGrades,
  auctionFeePercentOf,
  highestMvpGrade,
  mvpBenefitText,
  starforceDiscountPercentOf,
} from '../grades'

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

describe('혜택 한 줄', () => {
  it('수수료와 할인을 적고 할인이 없으면 없다고 적는다', () => {
    expect(mvpBenefitText('diamond')).toBe('경매장 수수료 3% · 스타포스 10% 할인')
    expect(mvpBenefitText('bronze')).toBe('경매장 수수료 5% · 스타포스 할인 없음')
  })
})

describe('명패 그림', () => {
  const { mvpPlateAsset } = jest.requireActual<typeof import('../../assets/asset-lookup')>('../../assets/asset-lookup')

  it('일반을 뺀 여섯 등급에 명패가 있다', () => {
    for (const grade of mvpGrades()) {
      if (grade.key === 'normal') expect(mvpPlateAsset(grade.key)).toBeNull()
      else expect(mvpPlateAsset(grade.key)).not.toBeNull()
    }
  })
})
