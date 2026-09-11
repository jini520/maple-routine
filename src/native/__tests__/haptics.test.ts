// 햅틱은 **이동을 막으면 안 된다**. 진동 장치가 없거나 사용자가 시스템 촉각 피드백을 꺼 두면
// 플러그인이 거절하는데, 그 거절이 흘러나가면 탭 누름 하나가 처리되지 않은 거부로 남는다.
import { selectionFeedback, tapFeedback } from '../haptics'
import { __resetNativePortsForTest, setHapticsPort } from '../ports'

afterEach(__resetNativePortsForTest)

describe('tapFeedback', () => {
  it('포트의 두드림을 부른다', () => {
    const tap = jest.fn().mockResolvedValue(undefined)
    setHapticsPort({ tap, select: jest.fn().mockResolvedValue(undefined) })

    tapFeedback()

    expect(tap).toHaveBeenCalledTimes(1)
  })

  it('거절해도 부른 쪽으로 새어 나가지 않는다', async () => {
    setHapticsPort({
      tap: () => Promise.reject(new Error('진동 장치 없음')),
      select: async () => {},
    })

    expect(() => {
      tapFeedback()
    }).not.toThrow()
    // 거부가 마이크로태스크 큐에 남아 있으면 여기서 처리되지 않은 거부로 터진다.
    await Promise.resolve()
  })

  // 배선 사고는 조용히 넘어가면 안 된다. 이 기기에 그 기능이 없다 와 구분이 없어진다.
  it('포트가 주입되지 않았으면 던진다', () => {
    __resetNativePortsForTest()

    expect(() => {
      tapFeedback()
    }).toThrow(/HapticsPort/)
  })
})

// 고른 값이 바뀌는 것은 어딘가로 가는 것과 다른 일이라 다른 촉각을 낸다. 세그먼트 셋만 부른다.
describe('selectionFeedback', () => {
  it('포트의 선택 촉각을 부른다. 이동 쪽은 안 부른다', () => {
    const tap = jest.fn().mockResolvedValue(undefined)
    const select = jest.fn().mockResolvedValue(undefined)
    setHapticsPort({ tap, select })

    selectionFeedback()

    expect(select).toHaveBeenCalledTimes(1)
    expect(tap).not.toHaveBeenCalled()
  })

  it('거절해도 부른 쪽으로 새어 나가지 않는다', async () => {
    setHapticsPort({
      tap: async () => {},
      select: () => Promise.reject(new Error('진동 장치 없음')),
    })

    expect(() => {
      selectionFeedback()
    }).not.toThrow()
    await Promise.resolve()
  })

  it('포트가 주입되지 않았으면 던진다', () => {
    __resetNativePortsForTest()

    expect(() => {
      selectionFeedback()
    }).toThrow(/HapticsPort/)
  })
})
