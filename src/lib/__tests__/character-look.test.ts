// 넥슨 캐릭터 그림의 동작 · 표정 프레임.
import { LOOK_FRAMES, lookFrameHeadShift, lookFrameUrl } from '../character-look'

const 그림 = 'https://open.api.nexon.com/static/maplestory/character/look/ABC'

describe('프레임 주소', () => {
  it('프레임마다 서로 다른 주소다', () => {
    const 주소 = LOOK_FRAMES.map((frame) => lookFrameUrl(그림, frame))

    expect(new Set(주소).size).toBe(LOOK_FRAMES.length)
  })

  it('주소에 값을 붙인다', () => {
    expect(lookFrameUrl(그림, 'wink')).toBe(`${그림}?action=A01&emotion=E01`)
  })

  // 넥슨이 주소에 값을 붙여 주기 시작하면 `?` 를 또 붙인 주소는 값이 깨진다.
  it('이미 값이 붙은 주소에는 이어 붙인다', () => {
    expect(lookFrameUrl(`${그림}?v=1`, 'jump')).toBe(`${그림}?v=1&action=A06`)
  })
})

describe('휘두르기', () => {
  // 넥슨의 3장짜리 공격 번호는 맞지 않는 무기를 맨손으로 그린다. 그래서 어느 무기든 보이는 프레임을 잇는다.
  it('세 프레임이 차례로 선다', () => {
    expect(lookFrameUrl(그림, 'swing0')).toContain('action=A25.0')
    expect(lookFrameUrl(그림, 'swing1')).toContain('action=A24.0')
    expect(lookFrameUrl(그림, 'swing2')).toContain('action=A24.1')
  })

  // 그대로 그리면 마지막 프레임에서 캐릭터가 옆으로 튄다.
  it('머리가 밀리는 프레임은 마지막 하나뿐이다', () => {
    const 밀린다 = LOOK_FRAMES.filter((frame) => lookFrameHeadShift(frame) !== 0)

    expect(밀린다).toEqual(['swing2'])
  })
})
