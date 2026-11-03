// 가격표가 흔들리는 값. 멈춰 있는 시간과 줄어드는 흔들림을 본다.
import { TAG_SWING_LOOP_MS, tagSwingDegrees } from '../drop-price-fab-motion'

/** 한 바퀴를 촘촘히 잰 값 */
function 한바퀴(): number[] {
  return Array.from({ length: 1001 }, (_, step) => tagSwingDegrees(step / 1000))
}

describe('흔들리는 시간', () => {
  // 금액 목록을 읽는 동안 계속 움직이면 시선을 빼앗는다.
  it('한 바퀴의 대부분은 멈춰 있다', () => {
    const 멈춤 = 한바퀴().filter((degrees) => degrees === 0).length

    expect(멈춤 / 1001).toBeGreaterThanOrEqual(0.7)
  })

  it('한 바퀴는 6초다', () => {
    expect(TAG_SWING_LOOP_MS).toBe(6000)
  })

  // 끝 값이 시작 값과 다르면 반복될 때마다 태그가 한 번 튄다.
  it('끝과 시작이 같은 값이라 반복할 때 튀지 않는다', () => {
    expect(tagSwingDegrees(1)).toBeCloseTo(tagSwingDegrees(0))
  })
})

describe('흔들림의 모양', () => {
  function 꺾이는값(): number[] {
    const 값 = 한바퀴()
    return 값.filter((현재, index) => {
      const 앞 = 값[index - 1]
      const 뒤 = 값[index + 1]
      if (앞 === undefined || 뒤 === undefined) return false
      return Math.abs(현재) > Math.abs(앞) && Math.abs(현재) >= Math.abs(뒤)
    })
  }

  it('좌우를 오가며 점점 작아진다', () => {
    const 꺾임 = 꺾이는값()

    expect(꺾임.length).toBeGreaterThanOrEqual(3)
    꺾임.slice(1).forEach((현재, index) => {
      expect(Math.sign(현재)).toBe(-Math.sign(꺾임[index]))
      expect(Math.abs(현재)).toBeLessThan(Math.abs(꺾임[index]))
    })
  })

  it('값이 끊기지 않고 이어진다', () => {
    const 값 = 한바퀴()

    값.slice(1).forEach((현재, index) => {
      expect(Math.abs(현재 - 값[index])).toBeLessThan(2)
    })
  })
})
