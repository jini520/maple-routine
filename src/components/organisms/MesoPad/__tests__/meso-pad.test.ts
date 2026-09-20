// 앞 키패드의 **타건 규칙**.
//
// 화면 없이 검증한다. `한 자를 치면 왼쪽으로 자란다`와 `상한을 넘기면 안 먹는다`가 규칙의
// 전부이고, 그것은 렌더된 글자보다 이 함수로 보는 편이 정확하다.
import {
  MAX_MESO,
  acceptMesoText,
  mesoTextOf,
  mesoValueOf,
  optionalMesoTextOf,
  optionalMesoValueOf,
  settleMesoText,
} from '../meso-pad'

/**
 * OS 숫자 키보드가 넣는 글자를 값으로 바꾸는 규칙.
 *
 * 칸이 콤마를 그리므로 **들어오는 글자에 콤마가 섞인다**. 그것을 걷는 것이 이 함수의 첫 일이고,
 * 상한을 넘기는 입력은 안 먹는다.
 */
/**
 * 칸이 **글자를 들고** 셈만 숫자로 하는 규칙.
 *
 * 값에서 글자를 다시 만들면 타건마다 `value` 가 갈려 **커서가 튄다.** `80000000000` 에서 `8` 을
 * 지운 `0000000000` 이 0 으로 접히고 빈 칸이 되던 자리가 그것이다.
 */
describe('acceptMesoText', () => {
  it('숫자만 남긴다. 붙여넣기·자동완성이 그 밖의 것을 들여보낸다', () => {
    expect(acceptMesoText('', '1,200')).toBe('1200')
    expect(acceptMesoText('', '1억 2000만')).toBe('12000')
  })

  // **여기서 앞자리 0 을 안 걷는 것이 핵심**이다. 그것이 곧 편집 중인 상태다.
  it('앞자리 0 을 그대로 둔다. 편집 중인 글자를 안 건드린다', () => {
    expect(acceptMesoText('80000000000', '0000000000')).toBe('0000000000')
    expect(acceptMesoText('0000000000', '60000000000')).toBe('60000000000')
  })

  it('다 지우면 빈 칸이다', () => {
    expect(acceptMesoText('1200', '')).toBe('')
  })

  // 넘기면 안 먹는다.
  it('상한을 넘기는 입력은 안 먹는다. 글자가 그대로다', () => {
    expect(acceptMesoText(`${MAX_MESO}`, `${MAX_MESO}0`)).toBe(`${MAX_MESO}`)
  })

  // 0 만 길게 이어지면 값으로는 상한에 안 걸린다. 자릿수로도 막는다.
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

  // 0 은 **빈 칸**이다. 자리표시자 `0` 이 그 자리를 대신한다.
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

/**
 * 비워 둔 것과 0 을 친 것이 다른 칸. 사냥 폼의 조각 가격이 쓴다.
 *
 * 빈 칸은 가격을 안 적었다는 뜻이라 그 조각이 보관에 들고, 0 은 0 메소에 팔았다는 기록이다.
 */
describe('optionalMesoValueOf · optionalMesoTextOf', () => {
  it('빈 칸은 null 이고 0 은 0 이다', () => {
    expect(optionalMesoValueOf('')).toBeNull()
    expect(optionalMesoValueOf('0')).toBe(0)
    expect(optionalMesoValueOf('0012')).toBe(12)
  })

  it('null 은 빈 칸이고 0 은 `0` 이다', () => {
    expect(optionalMesoTextOf(null)).toBe('')
    expect(optionalMesoTextOf(0)).toBe('0')
    expect(optionalMesoTextOf(1200)).toBe('1200')
  })

  // 커서가 빠질 때 두 함수를 이어 부른다. 앞자리 0 은 걷고 0 하나는 남는다.
  it('이어 부르면 앞자리 0 만 걷힌다', () => {
    expect(optionalMesoTextOf(optionalMesoValueOf('0000'))).toBe('0')
    expect(optionalMesoTextOf(optionalMesoValueOf('007'))).toBe('7')
    expect(optionalMesoTextOf(optionalMesoValueOf(''))).toBe('')
  })
})
