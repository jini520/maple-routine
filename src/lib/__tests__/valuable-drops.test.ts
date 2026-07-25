import { describe, expect, it } from 'vitest'
import { isValuableDrop } from '../valuable-drops'

describe('isValuableDrop', () => {
  it('칠흑의 보스 세트 구성원은 고가 (장신구·비장신구 모두)', () => {
    expect(isValuableDrop('루즈 컨트롤 머신 마크')).toBe(true) // 장신구
    expect(isValuableDrop('컴플리트 언더컨트롤')).toBe(true) // 기계심장(비장신구)
    expect(isValuableDrop('창세의 뱃지')).toBe(true) // 뱃지(비장신구)
    expect(isValuableDrop('미트라의 분노 선택 상자')).toBe(true) // 선택 상자류
  })

  it('광휘의 보스 세트 구성원은 고가 (불멸의 유산=훈장 포함)', () => {
    expect(isValuableDrop('불멸의 유산')).toBe(true)
    expect(isValuableDrop('근원의 속삭임')).toBe(true)
  })

  it('개별 지정 아이템(연마석 2종·칠흑 장신구 상자)은 고가', () => {
    expect(isValuableDrop('생명의 연마석')).toBe(true)
    expect(isValuableDrop('신념의 연마석')).toBe(true)
    expect(isValuableDrop('혼돈의 칠흑 장신구 상자')).toBe(true)
    expect(isValuableDrop('메이린의 칠흑 장신구 상자')).toBe(true)
  })

  it('여명 세트·일반 아이템은 고가 아님', () => {
    expect(isValuableDrop('데이브레이크 펜던트')).toBe(false) // 여명 세트
    expect(isValuableDrop('주문의 흔적')).toBe(false)
    expect(isValuableDrop('리스트레인트 링')).toBe(false)
    expect(isValuableDrop('홍옥의 보스 반지 상자')).toBe(false)
  })
})
