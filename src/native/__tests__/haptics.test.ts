// 햅틱은 **이동을 막으면 안 된다**. 진동 장치가 없거나 사용자가 시스템 촉각 피드백을 꺼 두면
// 플러그인이 거절하는데, 그 거절이 흘러나가면 탭 누름 하나가 처리되지 않은 거부로 남는다.
import { tapFeedback } from '../haptics'
import { __resetNativePortsForTest, setHapticsPort } from '../ports'

afterEach(__resetNativePortsForTest)

describe('tapFeedback', () => {
  it('포트의 두드림을 부른다', () => {
    const tap = jest.fn().mockResolvedValue(undefined)
    setHapticsPort({ tap })

    tapFeedback()

    expect(tap).toHaveBeenCalledTimes(1)
  })

  it('거절해도 부른 쪽으로 새어 나가지 않는다', async () => {
    setHapticsPort({ tap: () => Promise.reject(new Error('진동 장치 없음')) })

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
