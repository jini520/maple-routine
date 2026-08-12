// `ThemeAppearancePort` 의 RN 구현 — **값이 어디로 흐르는가**를 지킨다([[ADR-127]] 3단계).
//
// 웹뷰 구현은 DOM 을 만지므로 "문서가 이렇게 됐는가"를 봤지만, RN 구현이 하는 일은 값을 한 칸에 놓고
// 구독자에게 알리는 것이다. 그래서 검사 대상은 셋이다 — 초기값 · 갈아치우기 · 알림.

import { DEFAULT_THEME, getThemeDefinition } from '@core/lib/theme-registry'

import {
  __resetThemeAppearanceForTest,
  getThemeAppearance,
  subscribeThemeAppearance,
} from '../../../theme/appearance-store'
import { rnThemeAppearancePort } from '../rn-theme-appearance'

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

describe('rnThemeAppearancePort', () => {
  // 웹은 첫 페인트를 `index.css` 의 `@theme` 기본 블록(머쉬맘)이 메운다. RN 에는 번들 CSS 가 없어
  // 그 역할을 이 초기값이 한다 — 비워 두면 `restoreFromStorage()` 전까지 **색이 없는 화면**이 된다
  // (변수를 못 찾으면 NativeWind 가 그 스타일 속성을 조용히 뺀다).
  it('아무도 적용하지 않아도 기본 테마가 서 있다', () => {
    expect(getThemeAppearance()).toEqual({
      theme: DEFAULT_THEME,
      definition: getThemeDefinition(DEFAULT_THEME),
    })
  })

  it('적용하면 그 테마와 정의가 그대로 놓인다', () => {
    rnThemeAppearancePort.apply('검은마법사', getThemeDefinition('검은마법사'))

    expect(getThemeAppearance()).toEqual({
      theme: '검은마법사',
      definition: getThemeDefinition('검은마법사'),
    })
  })

  it('구독자에게 알린다(뷰가 리렌더할 유일한 계기다)', () => {
    const listener = jest.fn()
    subscribeThemeAppearance(listener)

    rnThemeAppearancePort.apply('레테', getThemeDefinition('레테'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('같은 테마를 다시 적용하면 알리지 않는다', () => {
    rnThemeAppearancePort.apply('레테', getThemeDefinition('레테'))
    const listener = jest.fn()
    subscribeThemeAppearance(listener)

    rnThemeAppearancePort.apply('레테', getThemeDefinition('레테'))

    expect(listener).not.toHaveBeenCalled()
  })

  // `useSyncExternalStore` 는 `getSnapshot` 이 바뀌지 않았을 때 **같은 객체**를 돌려주기를 요구한다 —
  // 매번 새로 만들면 React 가 무한 리렌더로 읽는다.
  it('바뀌지 않았으면 같은 스냅샷 객체를 준다', () => {
    expect(getThemeAppearance()).toBe(getThemeAppearance())

    rnThemeAppearancePort.apply('혼테일', getThemeDefinition('혼테일'))
    const applied = getThemeAppearance()

    expect(getThemeAppearance()).toBe(applied)
  })

  it('구독을 해제하면 더 이상 알리지 않는다', () => {
    const listener = jest.fn()
    subscribeThemeAppearance(listener)()

    rnThemeAppearancePort.apply('렌', getThemeDefinition('렌'))

    expect(listener).not.toHaveBeenCalled()
  })
})
