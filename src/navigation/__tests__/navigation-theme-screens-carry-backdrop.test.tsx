// [[ADR-134]] 정정 5 — **화면이 벽지를 들 때는 화면 배경을 비우지 않는다.**
//
// 투명한 화면은 벽지만 비추는 것이 아니라 **그 아래 화면까지** 비춘다. 안드로이드 전환 중에 두
// 화면의 글자가 포개져 읽힌 것이 그것이다(실기기 2026-08-15, 혼테일 — 「기능 설명」의 행들이
// 「컨텐츠 관리 방법」의 목차와 포개졌다).
//
// 이 갈래는 **짝이 있어야 성립한다** — 화면을 불투명하게 칠하는 `navigation-theme` 과 벽지를
// 화면마다 그리는 `ScreenBackdrop`. 한쪽만 바뀌면 벽지가 통째로 사라지거나(불투명한데 안 그림)
// 겹침이 그대로 남는다(투명한데 그림). 그래서 **판정 상수를 뒤집어** 두 쪽을 함께 확인한다.
//
// 파일을 따로 두는 이유는 `jest.mock` 이 파일 단위로 끌어올려지기 때문이다 — 같은 파일에서 두
// 플랫폼을 오갈 수 없다(동적 `import()` 도 이 러너에서는 못 쓴다, 실측).
import { render, renderHook, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { getThemeDefinition } from '../../lib/theme-registry'

import { ScreenBackdrop } from '../../components/templates/ThemeBackdrop/ScreenBackdrop'
import { rnThemeAppearancePort } from '../../native/adapters/rn-theme-appearance'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { __resetThemeAppearanceForTest } from '../../theme/appearance-store'
import { useNavigationTheme } from '../navigation-theme'

jest.mock('../../theme/screen-backdrop-policy', () => ({ SCREENS_CARRY_BACKDROP: true }))

// 진짜 벽지는 번들 에셋을 해석해야 그려지는데 jest 는 그것을 못 한다(그 계약은
// `theme-backdrop-layout.test.ts` 의 몫이다). 여기서 지킬 것은 **그리는 자리에 놓였는가** 하나다.
jest.mock('../../components/templates/ThemeBackdrop/ThemeBackdrop', () => {
  // 팩토리 밖 변수를 못 쓰므로(jest 의 hoisting 가드) 여기서 직접 가져온다.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MockView = require('react-native').View
  return { ThemeBackdrop: () => <MockView testID="theme-backdrop-stub" /> }
})

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

describe('화면이 벽지를 드는 플랫폼(안드로이드)', () => {
  it('벽지가 있는 테마라도 화면 배경은 **테마 배경색**이다 — 아래 화면이 비치면 안 된다', async () => {
    const 혼테일 = getThemeDefinition('혼테일')
    expect(혼테일.background).toBeDefined() // 전제가 깨지면 이 테스트는 뜻이 없다

    rnThemeAppearancePort.apply('혼테일', 혼테일)
    const { result } = await renderHook(() => useNavigationTheme(), { wrapper: ThemeProvider })

    expect(result.current.colors.background).toBe(혼테일.bg)
  })

  it('그 대신 **화면마다** 벽지를 그린다 — 안 그리면 벽지가 통째로 사라진다', async () => {
    await render(
      <ScreenBackdrop>
        <Text>화면</Text>
      </ScreenBackdrop>,
    )

    expect(screen.getByTestId('theme-backdrop-stub')).toBeTruthy()
    expect(screen.getByText('화면')).toBeTruthy()
  })
})
