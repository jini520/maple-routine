// 넥슨 캐릭터 그림의 행동 · 표정 프레임 주소.
import { lookFrameKey, lookFrameUrl } from '../character-look'

const 그림 = 'https://open.api.nexon.com/static/maplestory/character/look/ABC'

describe('프레임 주소', () => {
  it('행동 프레임 번호를 붙인다', () => {
    expect(lookFrameUrl(그림, { action: 'A24', frame: 1, emotion: 'E00', emotionFrame: 0 })).toBe(`${그림}?action=A24.1`)
  })

  it('표정은 프레임 번호까지 붙인다', () => {
    expect(lookFrameUrl(그림, { action: 'A03', frame: 2, emotion: 'E06', emotionFrame: 1 })).toBe(
      `${그림}?action=A03.2&emotion=E06.1`,
    )
  })

  // 시트의 칸과 위젯이 같은 주소를 써야 디스크에 받아 둔 그림을 함께 쓴다.
  it('기본 표정은 표정 값을 붙이지 않아 행동 프레임과 같은 주소다', () => {
    const 기본 = lookFrameUrl(그림, { action: 'A00', frame: 0, emotion: 'E00', emotionFrame: 0 })

    expect(기본).not.toContain('emotion')
  })

  // 앱이 저장한 주소에는 `?wmotion=W00` 이 붙어 있다. `?` 를 또 붙이면 값이 깨진다.
  it('이미 값이 붙은 주소에는 이어 붙인다', () => {
    expect(lookFrameUrl(`${그림}?wmotion=W00`, { action: 'A06', frame: 0, emotion: 'E02', emotionFrame: 0 })).toBe(
      `${그림}?wmotion=W00&action=A06.0&emotion=E02.0`,
    )
  })
})

describe('프레임 열쇠', () => {
  it('행동 · 표정 · 각 프레임 번호가 하나라도 다르면 다른 열쇠다', () => {
    const 열쇠 = [
      lookFrameKey({ action: 'A03', frame: 0, emotion: 'E00', emotionFrame: 0 }),
      lookFrameKey({ action: 'A03', frame: 1, emotion: 'E00', emotionFrame: 0 }),
      lookFrameKey({ action: 'A02', frame: 0, emotion: 'E00', emotionFrame: 0 }),
      lookFrameKey({ action: 'A03', frame: 0, emotion: 'E17', emotionFrame: 0 }),
      lookFrameKey({ action: 'A03', frame: 0, emotion: 'E17', emotionFrame: 1 }),
    ]

    expect(new Set(열쇠).size).toBe(열쇠.length)
  })
})
