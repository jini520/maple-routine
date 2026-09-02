// 앞 키패드의 **타건 규칙**.
//
// 화면 없이 검증한다 — `한 자를 치면 왼쪽으로 자란다`와 `상한을 넘기면 안 먹는다`가 규칙의
// 전부이고, 그것은 렌더된 글자보다 이 함수로 보는 편이 정확하다.
import {
  MAX_MESO,
  MESO_KEYS,
  acceptMesoText,
  applyMesoKey,
  mesoTextOf,
  mesoValueOf,
  parseMesoText,
  settleMesoText,
} from '../meso-pad'

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

/**
 * OS 숫자 키보드가 넣는 글자를 값으로 바꾸는 규칙.
 *
 * 칸이 콤마를 그리므로 **들어오는 글자에 콤마가 섞인다** — 그것을 걷는 것이 이 함수의 첫 일이고,
 * 상한 규칙은 `applyMesoKey` 와 **같아야 한다**(넘기면 안 먹는다).
 */
describe('parseMesoText', () => {
  it('콤마를 걷는다 — 칸이 그린 것이 그대로 돌아온다', () => {
    expect(parseMesoText(0, '1,200')).toBe(1200)
  })

  it('숫자가 아닌 글자를 걷는다 — 붙여넣기·자동완성이 들여보낼 수 있다', () => {
    expect(parseMesoText(0, '1억 2000만')).toBe(12000)
    expect(parseMesoText(0, '-5')).toBe(5)
  })

  it('비면 0 이다 — 다 지운 것은 **0 원** 이지 **그대로** 가 아니다', () => {
    expect(parseMesoText(1200, '')).toBe(0)
    expect(parseMesoText(1200, '메소')).toBe(0)
  })

  it('앞자리 0 이 쌓이지 않는다', () => {
    expect(parseMesoText(0, '0012')).toBe(12)
  })

  // `applyMesoKey` 와 **같은 규칙**이다 — 잘라 넣으면 사용자가 친 것과 다른 값이 남는다.
  it('상한을 넘기는 입력은 안 먹는다 — 값이 그대로다', () => {
    expect(parseMesoText(MAX_MESO, `${MAX_MESO}0`)).toBe(MAX_MESO)
  })
})

/**
 * 칸이 **글자를 들고** 셈만 숫자로 하는 규칙.
 *
 * 값에서 글자를 다시 만들면 타건마다 `value` 가 갈려 **커서가 튄다.** `80000000000` 에서 `8` 을
 * 지운 `0000000000` 이 0 으로 접히고 빈 칸이 되던 자리가 그것이다.
 */
describe('acceptMesoText', () => {
  it('숫자만 남긴다 — 붙여넣기·자동완성이 그 밖의 것을 들여보낸다', () => {
    expect(acceptMesoText('', '1,200')).toBe('1200')
    expect(acceptMesoText('', '1억 2000만')).toBe('12000')
  })

  // **여기서 앞자리 0 을 안 걷는 것이 핵심**이다 — 그것이 곧 편집 중인 상태다.
  it('앞자리 0 을 그대로 둔다 — 편집 중인 글자를 안 건드린다', () => {
    expect(acceptMesoText('80000000000', '0000000000')).toBe('0000000000')
    expect(acceptMesoText('0000000000', '60000000000')).toBe('60000000000')
  })

  it('다 지우면 빈 칸이다', () => {
    expect(acceptMesoText('1200', '')).toBe('')
  })

  // `applyMesoKey`·`parseMesoText` 와 **같은 규칙**이다 — 넘기면 안 먹는다.
  it('상한을 넘기는 입력은 안 먹는다 — 글자가 그대로다', () => {
    expect(acceptMesoText(`${MAX_MESO}`, `${MAX_MESO}0`)).toBe(`${MAX_MESO}`)
  })

  // 0 만 길게 이어지면 값으로는 상한에 안 걸린다 — 자릿수로도 막는다.
  it('자릿수 상한도 지킨다', () => {
    expect(acceptMesoText('0', '00000000000000')).toBe('0')
  })
})

describe('mesoValueOf · mesoTextOf', () => {
  it('빈 칸은 0 이고, 앞자리 0 은 값에서 접힌다', () => {
    expect(mesoValueOf('')).toBe(0)
    expect(mesoValueOf('0000000000')).toBe(0)
    expect(mesoValueOf('0012')).toBe(12)
  })

  // 0 은 **빈 칸**이다 — 자리표시자 `0` 이 그 자리를 대신한다.
  it('값을 글자로 되돌린다', () => {
    expect(mesoTextOf(0)).toBe('')
    expect(mesoTextOf(1200)).toBe('1200')
  })
})

/**
 * 커서가 빠질 때 정리한다.
 *
 * 타건마다 하면 편집 중인 `0000000000` 이 즉시 빈 칸이 되어 고치려던 그 문제가 되살아난다.
 */
describe('settleMesoText', () => {
  it('앞자리 0 을 걷는다', () => {
    expect(settleMesoText('007')).toBe('7')
  })

  it('0 만 남으면 빈 칸이다', () => {
    expect(settleMesoText('0000000000')).toBe('')
    expect(settleMesoText('0')).toBe('')
  })

  it('멀쩡한 글자는 안 건드린다', () => {
    expect(settleMesoText('60000000000')).toBe('60000000000')
    expect(settleMesoText('')).toBe('')
  })
})
