import { capTextScale, TEXT_SIZE_SCALE } from '../text-size'

describe('capTextScale', () => {
  it('넓은 화면에서는 고른 배수를 그대로 준다', () => {
    expect(capTextScale(TEXT_SIZE_SCALE.xlarge, 432)).toBe(1.2)
    expect(capTextScale(TEXT_SIZE_SCALE.small, 402)).toBe(0.9)
  })

  it('화면 폭을 배수로 나눈 값이 360 아래로 내려가지 않게 자른다', () => {
    // 아이폰 17 Pro 폭에서 아주 크게는 402 ÷ 360 까지만 커진다
    expect(capTextScale(TEXT_SIZE_SCALE.xlarge, 402)).toBeCloseTo(402 / 360)
    expect(capTextScale(TEXT_SIZE_SCALE.large, 360)).toBe(1)
  })

  it('폭이 320 이면 기본 단계도 줄어든다', () => {
    expect(capTextScale(TEXT_SIZE_SCALE.default, 320)).toBeCloseTo(320 / 360)
    expect(capTextScale(TEXT_SIZE_SCALE.small, 320)).toBeCloseTo(320 / 360)
  })

  it('폭을 아직 모르면(0) 고른 배수를 그대로 준다', () => {
    expect(capTextScale(TEXT_SIZE_SCALE.large, 0)).toBe(1.1)
  })
})
