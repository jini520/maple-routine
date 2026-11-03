// 홀로그램 경로를 언제 돌리는가. 화면이 자리 잡았을 때만 돌고, 떠나면 멈추고, 다시 돌 때는 멈춘 자리에서 한 바퀴를 건다.
//
// 반복을 걸고 멈췄는지는 스파이로만 관측된다. 경로 값은 훅 밖으로 안 나오므로, 반복이 낸 값을 경로 중간으로 흉내 내어
// 다시 돌 때 그 자리를 이어 받는지 본다.
const mockWithTiming = jest.fn()
const mockWithRepeat = jest.fn()
const mockCancelAnimation = jest.fn()
/** 반복을 건 뒤 경로 값이 머문 자리. 멈춘 자리에서 이어 도는지는 이 값으로만 보인다. */
const MOCK_MID = 2.5

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated')
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useReducedMotion: () => false,
    // 타이밍은 목표값을 그대로 내고, 반복은 경로 중간값을 내서 멈춘 자리를 흉내 낸다.
    withTiming: (...args: unknown[]) => {
      mockWithTiming(...args)
      return args[0]
    },
    withRepeat: (...args: unknown[]) => {
      mockWithRepeat(...args)
      return MOCK_MID
    },
    cancelAnimation: (...args: unknown[]) => {
      mockCancelAnimation(...args)
      return actual.cancelAnimation(...args)
    },
  }
})
jest.mock('../../../../hooks/useScreenSettled', () => ({ useScreenSettled: jest.fn() }))

import { render } from '@testing-library/react-native'

import { useScreenSettled } from '../../../../hooks/useScreenSettled'
import { useHoloMotion } from '../holo-motion'

function Probe(props: { enabled: boolean }): null {
  useHoloMotion(props.enabled)
  return null
}

beforeEach(() => {
  mockWithTiming.mockClear()
  mockWithRepeat.mockClear()
  mockCancelAnimation.mockClear()
  jest.mocked(useScreenSettled).mockReturnValue(true)
})

describe('언제 도는가', () => {
  it('고가 드롭이 없으면 안 돈다', async () => {
    await render(<Probe enabled={false} />)

    expect(mockWithRepeat).not.toHaveBeenCalled()
  })

  it('화면이 자리 잡기 전에는 안 돈다', async () => {
    jest.mocked(useScreenSettled).mockReturnValue(false)

    await render(<Probe enabled />)

    expect(mockWithRepeat).not.toHaveBeenCalled()
  })

  it('자리 잡으면 돈다', async () => {
    await render(<Probe enabled />)

    expect(mockWithRepeat).toHaveBeenCalledTimes(1)
  })

  it('자리를 떠나면 멈춘다', async () => {
    const view = await render(<Probe enabled />)

    jest.mocked(useScreenSettled).mockReturnValue(false)
    await view.rerender(<Probe enabled />)

    expect(mockCancelAnimation).toHaveBeenCalled()
  })

  it('다시 돌 때 멈춘 자리에서 한 바퀴를 건다', async () => {
    const view = await render(<Probe enabled />)
    jest.mocked(useScreenSettled).mockReturnValue(false)
    await view.rerender(<Probe enabled />)

    jest.mocked(useScreenSettled).mockReturnValue(true)
    await view.rerender(<Probe enabled />)

    expect(mockWithTiming).toHaveBeenCalledTimes(2)
    const [첫바퀴끝] = mockWithTiming.mock.calls[0] as [number]
    const [다시건끝] = mockWithTiming.mock.calls[1] as [number]
    expect(다시건끝).toBe(MOCK_MID + 첫바퀴끝)
  })
})
