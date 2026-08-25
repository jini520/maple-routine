// 앞 키패드의 **타건 규칙**([[ADR-124]] 결정 5).
//
// 화면 없이 검증한다 — 「한 자를 치면 왼쪽으로 자란다」와 「상한을 넘기면 안 먹는다」가 규칙의
// 전부이고, 그것은 렌더된 글자보다 이 함수로 보는 편이 정확하다.
import { MAX_MESO, MESO_KEYS, applyMesoKey } from '../meso-pad'

describe('applyMesoKey', () => {
  it('숫자는 오른쪽에 붙는다 — 값이 왼쪽으로 자란다', () => {
    expect(applyMesoKey(0, '1')).toBe(1)
    expect(applyMesoKey(1, '2')).toBe(12)
    expect(applyMesoKey(12, '3')).toBe(123)
  })

  it('00 은 두 자리를 붙인다', () => {
    expect(applyMesoKey(1, '00')).toBe(100)
  })

  it('0 에서 0 을 쳐도 0 이다 — 앞자리 0 이 쌓이지 않는다', () => {
    expect(applyMesoKey(0, '0')).toBe(0)
    expect(applyMesoKey(0, '00')).toBe(0)
  })

  it('⌫ 는 한 자리를 지운다', () => {
    expect(applyMesoKey(123, 'del')).toBe(12)
    expect(applyMesoKey(1, 'del')).toBe(0)
    expect(applyMesoKey(0, 'del')).toBe(0)
  })

  // 조 단위를 넘기면 `Number` 정밀도가 아니라 **화면이 먼저 깨진다** — 그래서 타건을 막는다.
  it('상한을 넘기는 타건은 무시한다 — 값이 그대로다', () => {
    expect(applyMesoKey(MAX_MESO, '9')).toBe(MAX_MESO)
  })

  it('상한 자체는 칠 수 있다', () => {
    expect(applyMesoKey(999_999_999_999, '9')).toBe(MAX_MESO)
  })
})

describe('MESO_KEYS', () => {
  it('3열 넉 줄 — 1~9 · 00 · 0 · ⌫', () => {
    expect(MESO_KEYS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'])
  })
})
