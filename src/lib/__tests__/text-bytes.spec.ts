import { fitToBytes, textBytes } from '../text-bytes'

describe('textBytes', () => {
  it('영문 · 숫자 · 공백 · 기본 기호는 1바이트, 한글은 2바이트로 센다', () => {
    expect(textBytes('Ab 1!-')).toBe(6)
    expect(textBytes('본캐')).toBe(4)
    // 기본 이름은 상한 16바이트를 넘어 칸의 값이 될 수 없다.
    expect(textBytes('메이플ID-4f1c08ab')).toBe(17)
  })

  it('ASCII 밖의 기호와 이모지도 2바이트다. 이모지는 UTF-16 두 칸이어도 한 글자로 센다', () => {
    expect(textBytes('★')).toBe(2)
    expect(textBytes('😀')).toBe(2)
  })
})

describe('fitToBytes', () => {
  it('상한 안의 입력은 그대로 받는다', () => {
    expect(fitToBytes('본캐', '본캐AB', 16).text).toBe('본캐AB')
  })

  it('상한을 넘는 글자는 받지 않고, 커서는 그 글자를 친 자리에 둔다', () => {
    // 15바이트에 한글 한 자(2바이트)를 끼우면 17바이트다.
    expect(fitToBytes('가나ABCDEFGHIJK', '가나다ABCDEFGHIJK', 16)).toEqual({ text: '가나ABCDEFGHIJK', caret: 2 })
  })

  it('붙여 넣은 글은 상한까지만 받고, 그 뒤의 글자는 남긴다', () => {
    expect(fitToBytes('가나', '가abcdefghijklmnop나', 16)).toEqual({ text: '가abcdefghijkl나', caret: 13 })
  })

  it('상한을 넘은 이름이라도 지우기는 받는다', () => {
    // 10자 규칙 때 저장한 20바이트 이름이다.
    expect(fitToBytes('가나다라마바사아자차', '가나다라마바사아자', 16).text).toBe('가나다라마바사아자')
  })

  it('조합 중인 자모가 같은 바이트의 글자로 바뀌는 것은 상한에서도 받는다', () => {
    expect(fitToBytes('가나다라마바사ㅎ', '가나다라마바사하', 16).text).toBe('가나다라마바사하')
  })

  it('남은 바이트가 이모지 반쪽만큼이어도 이모지를 쪼개지 않는다', () => {
    expect(fitToBytes('ABCDEFGHIJKLM', 'ABCDEFGHIJKLM😀😀', 16)).toEqual({ text: 'ABCDEFGHIJKLM😀', caret: 15 })
  })
})
