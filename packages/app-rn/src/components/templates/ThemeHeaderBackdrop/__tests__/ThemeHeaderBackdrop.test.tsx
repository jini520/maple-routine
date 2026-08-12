// 헤더 배경 조각([[ADR-088]] 결정 5-1) — **오늘은 어느 테마에서도 아무것도 안 그린다.**
//
// 그 사실을 테스트로 적어 두는 이유는 이 컴포넌트가 *"구현이 빠진 것"* 처럼 보이기 때문이다. 갈래는
// 둘이고 결과만 같다: 배경을 **선언하지 않은** 테마는 웹과 같은 이유로 안 그리고(계약), 선언한
// 둘은 그림이 있는데도 **아직 앉히지 않아서** 안 그린다([[ADR-129]] 이후 — 컴포넌트 주석).
//
// 그래서 여기서 검사할 수 있는 것은 *"조각이 나오는가"* 가 아니라 **"이 컴포넌트가 헤더 뷰를 늘리지
// 않는가"** 다. 에셋이 오면 두 번째 갈래의 기대가 바뀌고, 그때 이 파일이 빨개져 자리를 알려준다.

import { getThemeDefinition } from '@core/lib/theme-registry'
import { render } from '@testing-library/react-native'

import { rnThemeAppearancePort } from '../../../../native/adapters/rn-theme-appearance'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
import { ThemeProvider } from '../../../../theme/ThemeProvider'
import { ThemeHeaderBackdrop } from '../ThemeHeaderBackdrop'

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

/** `ThemeProvider` 의 `vars()` View 만 남고 그 자식이 0개 = 백드롭이 아무것도 안 그렸다. */
async function renderBackdropChildren(): Promise<unknown[]> {
  const tree = (
    await render(
      <ThemeProvider>
        <ThemeHeaderBackdrop />
      </ThemeProvider>,
    )
  ).toJSON()

  return (tree as { children: unknown[] | null } | null)?.children ?? []
}

describe('ThemeHeaderBackdrop', () => {
  // 배경 없는 테마 넷은 웹과 **같은 이유로** 비어 있다 — 이쪽은 계약이고, 에셋이 와도 안 바뀐다.
  it('배경을 선언하지 않은 테마에서는 아무것도 그리지 않는다 (웹과 같은 계약)', async () => {
    rnThemeAppearancePort.apply('렌', getThemeDefinition('렌'))

    expect(getThemeDefinition('렌').background).toBeUndefined()
    await expect(renderBackdropChildren()).resolves.toHaveLength(0)
  })

  // 이쪽은 **계약이 아니라 부채**다. 배경 선언은 진짜로 있는데(값도 진짜다) 그릴 그림이 없다.
  it.each(['혼테일', '검은마법사'] as const)(
    '%s 는 배경을 선언했지만 아직도 안 그린다 — 에셋 레이어를 기다린다',
    async (theme) => {
      rnThemeAppearancePort.apply(theme, getThemeDefinition(theme))

      expect(getThemeDefinition(theme).background).toBeDefined()
      await expect(renderBackdropChildren()).resolves.toHaveLength(0)
    },
  )
})
