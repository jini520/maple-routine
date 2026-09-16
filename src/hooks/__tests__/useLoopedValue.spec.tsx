// 한 값을 무한 반복시키는 훅.
//
// 여기서 보는 것은 **언제 도는가**다. 안 보이는 화면에서 돌면 그리지도 않을 뷰를 매 프레임 커밋해
// 메인 스레드가 쉬지 않는다(가만히 있는 더보기에서 코어의 25~29%, 2026-09-17 실기기).

// 반복을 걸고 멈췄는지는 스파이로만 관측된다(`components/__tests__/reduced-motion.ts`).
jest.mock('react-native-reanimated', () =>
  require('../../components/__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import {
  cancelAnimationSpy,
  mockReducedMotion,
  withRepeatSpy,
} from '../../components/__tests__/reduced-motion'

import { render } from '@testing-library/react-native'
import { NavigationContext } from '@react-navigation/native'
import { Easing } from 'react-native-reanimated'

import { useLoopedValue } from '../useLoopedValue'
import { 초점가짜 } from './screen-focus-fake'

// 모듈 상수라 렌더마다 같은 값이다. 새 객체를 넘기면 매 렌더가 반복을 다시 건다.
const LOOP = { from: 0, to: 3, durationMs: 6000, easing: Easing.linear }

function Probe(): null {
  useLoopedValue(LOOP)
  return null
}

async function 화면에그리기(초기값: boolean) {
  const 가짜 = 초점가짜(초기값)

  await render(
    <NavigationContext.Provider value={가짜.navigation as never}>
      <Probe />
    </NavigationContext.Provider>,
  )

  return 가짜
}

beforeEach(() => {
  mockReducedMotion(false)
  withRepeatSpy.mockClear()
  cancelAnimationSpy.mockClear()
})

describe('화면이 보일 때만 돈다', () => {
  it('보이면 돈다', async () => {
    await 화면에그리기(true)

    expect(withRepeatSpy).toHaveBeenCalledTimes(1)
  })

  it('처음부터 안 보이면 안 돈다', async () => {
    await 화면에그리기(false)

    expect(withRepeatSpy).not.toHaveBeenCalled()
  })

  it('초점을 잃으면 멈춘다', async () => {
    const 가짜 = await 화면에그리기(true)

    await 가짜.보내기('blur')

    expect(cancelAnimationSpy).toHaveBeenCalled()
  })

  it('초점을 되찾으면 다시 돈다', async () => {
    const 가짜 = await 화면에그리기(true)

    await 가짜.보내기('blur')
    await 가짜.보내기('focus')

    expect(withRepeatSpy).toHaveBeenCalledTimes(2)
  })

  // 컴포넌트 테스트는 내비게이터 없이 렌더한다. 거기서 멈추면 모든 스피너 테스트가 안 도는 그림을 본다.
  it('내비게이터 밖에서는 보이는 것으로 둔다', async () => {
    await render(<Probe />)

    expect(withRepeatSpy).toHaveBeenCalledTimes(1)
  })
})

it('움직임 줄이기면 보여도 안 돈다', async () => {
  mockReducedMotion(true)

  await 화면에그리기(true)

  expect(withRepeatSpy).not.toHaveBeenCalled()
})
