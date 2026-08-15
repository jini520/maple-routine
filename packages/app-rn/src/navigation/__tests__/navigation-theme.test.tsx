// 내비게이션 테마 — 라이브러리가 **자기가 칠하는 자리**에 쓸 색.
//
// 여기서 지키는 것은 하나다: **배경 이미지가 있는 테마에서 화면 배경을 비우는가**([[ADR-088]]
// 결정 4 의 RN 짝). 안 비우면 벽지가 **통째로 사라진다** — 웹에서도 같은 실수를 했고
// (2026-08-03, 앱 루트의 `bg-bg`), 그때 증상이 "어둡게 깔림"이 아니라 "아예 안 보임"이라
// **원인을 짚기 어려웠다.** 그 자리를 값으로 고정한다.
import { render, renderHook } from '@testing-library/react-native'
import { Text } from 'react-native'

import { getThemeDefinition } from '@core/lib/theme-registry'

import { ScreenBackdrop } from '../../components/templates/ThemeBackdrop/ScreenBackdrop'
import { rnThemeAppearancePort } from '../../native/adapters/rn-theme-appearance'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { __resetThemeAppearanceForTest } from '../../theme/appearance-store'
import { SCREENS_CARRY_BACKDROP } from '../../theme/screen-backdrop-policy'
import { useNavigationTheme } from '../navigation-theme'

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

describe('useNavigationTheme — 배경 이미지가 있으면 화면 배경을 비운다', () => {
  it('벽지가 있는 테마는 transparent 다 — 안 그러면 벽지를 덮는다', async () => {
    const 혼테일 = getThemeDefinition('혼테일')
    expect(혼테일.background).toBeDefined() // 전제가 깨지면 이 테스트는 뜻이 없다

    rnThemeAppearancePort.apply('혼테일', 혼테일)
    const { result } = await renderHook(() => useNavigationTheme(), { wrapper: ThemeProvider })

    expect(result.current.colors.background).toBe('transparent')
  })

  // 배경이 없는 테마는 그대로 칠해야 한다 — 이 값의 원래 목적(다크 테마 전환 프레임에 라이브러리
  // 기본 흰 배경이 드러나는 것을 막는다)이 여전히 유효하다.
  it('벽지가 없는 테마는 테마 배경색 그대로다', async () => {
    const 머쉬맘 = getThemeDefinition('머쉬맘')
    expect(머쉬맘.background).toBeUndefined()

    rnThemeAppearancePort.apply('머쉬맘', 머쉬맘)
    const { result } = await renderHook(() => useNavigationTheme(), { wrapper: ThemeProvider })

    expect(result.current.colors.background).toBe(머쉬맘.bg)
  })
})

// [[ADR-134]] 정정 5 의 **반대쪽 갈래** — 화면이 벽지를 들지 않는 플랫폼(iOS, 이 러너의 기본)에서는
// `ScreenBackdrop` 이 뷰를 하나도 늘리지 않고 자식을 그대로 통과시킨다. 여기서 벽지를 그리면
// 셸의 벽지와 **두 겹**이 되고, 그것이 [[ADR-133]] 결정 1 이 없앤 «그리는 곳이 둘» 이다.
describe('[[ADR-134]] 정정 5 — 화면이 벽지를 들지 않는 플랫폼', () => {
  it('`ScreenBackdrop` 이 자식을 그대로 통과시킨다', async () => {
    expect(SCREENS_CARRY_BACKDROP).toBe(false) // 전제

    const { toJSON } = await render(
      <ScreenBackdrop>
        <Text>화면</Text>
      </ScreenBackdrop>,
    )

    // 래퍼 View 가 없다 — 자식 하나가 그대로 루트다(있으면 셸의 벽지와 두 겹이 된다).
    expect((toJSON() as { type: string }).type).toBe('Text')
  })
})
