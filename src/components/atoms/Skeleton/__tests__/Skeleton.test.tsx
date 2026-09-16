// 이 아톰이 지키는 것 넷.
//
// ① 칠은 아톰이 정한다. 자리마다 고르면 갈리고, 갈린 회색은 **다른 뜻**으로 읽힌다.
// ② 크기는 호출부가 준다. 결과가 들어올 자리와 같은 치수로 서는 것이 이 부품의 전부라,
//    치수를 아는 쪽은 언제나 호출부다.
// ③ 장식이라 스크린리더에서 숨는다. 조회 중임을 말하는 것은 감싸는 쪽의 `role="status"` 다.
// ④ 펄스는 모션 줄이기를 따른다. 보는 방법이 `withRepeat` 을 걸었는가인 것은 두 스피너와
//    같은 이유다(`reduced-motion.ts` 의 `withRepeatSpy` 주석).
jest.mock('react-native-reanimated', () =>
  require('../../../__tests__/reduced-motion').reanimatedWithReducedMotion(),
)

import { mockReducedMotion, withRepeatSpy } from '../../../__tests__/reduced-motion'
import { renderAtom } from '../../../__tests__/render-atom'
import { Skeleton } from '../Skeleton'

const HIDDEN = { includeHiddenElements: true } as const

afterEach(() => {
  mockReducedMotion(false)
  withRepeatSpy.mockClear()
})

describe('Skeleton', () => {
  it('장식이라 스크린리더에서 숨는다', async () => {
    const { getByTestId } = await renderAtom(<Skeleton testID="bar" />)

    expect(getByTestId('bar', HIDDEN).props['aria-hidden']).toBe(true)
  })

  it('호출부가 준 className 과 style 이 그대로 붙는다', async () => {
    const { getByTestId } = await renderAtom(
      <Skeleton testID="bar" className="w-full" style={{ height: 42 }} />,
    )

    // 스타일은 배열로 합쳐져 온다. 높이가 살아 있는지만 본다.
    expect(getByTestId('bar', HIDDEN)).toHaveStyle({ height: 42 })
  })

  it('반복 펄스를 건다', async () => {
    await renderAtom(<Skeleton testID="bar" />)

    expect(withRepeatSpy).toHaveBeenCalled()
  })

  it('모션 줄이기를 켜면 펄스를 걸지 않는다', async () => {
    mockReducedMotion(true)

    await renderAtom(<Skeleton testID="bar" />)

    expect(withRepeatSpy).not.toHaveBeenCalled()
  })
})
