// 커서를 **숫자 기준**으로 되짚는 산수.
//
// 칸이 든 것은 숫자만이고 보이는 것은 콤마가 낀 글자다. 한 자를 칠 때마다 콤마 자리가 바뀌어
// 글자 길이가 달라지므로, 커서를 글자 인덱스로 들고 있으면 다시 그린 글자의 다른 곳을 가리킨다.
// 숫자 개수는 그 사이에 안 변한다.
import { caretAfterDigits, digitsBefore } from '../meso-caret'

describe('digitsBefore', () => {
  it('커서 앞의 숫자만 센다. 콤마는 안 센다', () => {
    expect(digitsBefore('1,000,000,000', 5)).toBe(4)
  })

  it('맨 앞은 0', () => {
    expect(digitsBefore('1,234', 0)).toBe(0)
  })

  it('맨 뒤는 전부', () => {
    expect(digitsBefore('1,234', 5)).toBe(4)
  })

  it('글자 길이를 넘는 자리는 전부로 본다', () => {
    expect(digitsBefore('1,234', 99)).toBe(4)
  })

  it('콤마 바로 앞뒤가 같은 수를 낸다. 그 사이엔 숫자가 없다', () => {
    expect(digitsBefore('1,234', 1)).toBe(1)
    expect(digitsBefore('1,234', 2)).toBe(1)
  })
})

describe('caretAfterDigits', () => {
  it('n 번째 숫자 바로 뒤에 선다', () => {
    expect(caretAfterDigits('1,000,000,000', 4)).toBe(5)
  })

  it('0 이면 맨 앞', () => {
    expect(caretAfterDigits('1,234', 0)).toBe(0)
  })

  it('숫자가 모자라면 맨 뒤', () => {
    expect(caretAfterDigits('1,234', 99)).toBe(5)
  })

  it('빈 글자는 0', () => {
    expect(caretAfterDigits('', 3)).toBe(0)
  })

  it('digitsBefore 와 서로 되짚는다', () => {
    const 글자 = '12,345,678'
    for (let i = 0; i <= 글자.length; i += 1) {
      const 수 = digitsBefore(글자, i)
      // 되짚은 자리의 숫자 개수는 같다. 콤마 위의 자리는 그 앞 숫자 뒤로 당겨진다.
      expect(digitsBefore(글자, caretAfterDigits(글자, 수))).toBe(수)
    }
  })
})

describe('사용자가 보고한 자리', () => {
  it('1,000|,000,000 에 34 를 치면 1,00034,000,000 이 되고 커서는 34 뒤다', () => {
    // 친 직후의 날 글자와 그 안에서의 커서.
    const 친글자 = '1,00034,000,000'
    const 친커서 = 7
    expect(digitsBefore(친글자, 친커서)).toBe(6)

    // 다시 포맷한 글자에서 여섯째 숫자 뒤.
    expect(caretAfterDigits('100,034,000,000', 6)).toBe(7)
  })
})
