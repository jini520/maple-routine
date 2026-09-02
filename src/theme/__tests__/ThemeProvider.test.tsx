// 테마가 **실제 RN 스타일까지 흐르는지** 지킨다(3단계).
//
// 위 단계(`theme-vars.test.ts`)는 변수 맵이 맞는지만 본다. 여기서 보는 것은 그 맵이 `vars()` 를 타고
// 내려가 `className` 이 **색으로 풀리는가** 다. 배선(babel 프리셋·컴파일된 CSS·색 스케일) 중 하나가
// 끊기면 값 테스트는 초록인데 화면만 무색이 된다.
//
// 값은 손으로 적지 않고 `job-themes.json` 에서 읽는다(색은 사람이 확인해 커밋한 값이고
// 테스트가 베끼면 두 벌이 된다).
//
// ⚠️ 화면이 **예전(웹뷰 앱)과 같은지**는 여기서 답하지 않는다. 답하는 것은 "값이 흐르는가" 까지다.

import { act, render } from '@testing-library/react-native'
import { getThemeDefinition } from '../../lib/theme/theme-registry'
import { Text, View } from 'react-native'

import { rnThemeAppearancePort } from '../../native/adapters/rn-theme-appearance'
import { __resetThemeAppearanceForTest } from '../appearance-store'
import { MediaScope } from '../MediaScope'
import { ThemeProvider } from '../ThemeProvider'
import { useScrollIndicatorStyle, useThemeAppearance, useThemeMode } from '../context'

const 머쉬맘 = getThemeDefinition('머쉬맘')
const 검은마법사 = getThemeDefinition('검은마법사')

/** `style` 프롭이 배열로도 오므로 평평하게 편다. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle)) as Record<string, unknown>
  }
  if (style !== null && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

function Swatch() {
  return (
    <View className="bg-surface border border-border" testID="card">
      <Text className="text-text-muted" testID="label">
        토큰
      </Text>
      <View className="bg-secondary-tint border-panel-border" testID="badge" />
    </View>
  )
}

function ModeProbe() {
  return (
    <Text testID="mode">{`${useThemeMode()}/${useScrollIndicatorStyle()}/${useThemeAppearance().theme}`}</Text>
  )
}

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

describe('ThemeProvider', () => {
  it('`className` 이 지금 테마의 실제 색으로 풀린다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    )

    expect(flattenStyle(getByTestId('card').props.style)).toMatchObject({
      backgroundColor: 머쉬맘.surface,
      borderColor: 머쉬맘.border,
    })
    expect(flattenStyle(getByTestId('label').props.style)).toMatchObject({
      color: 머쉬맘.textMuted,
    })
  })

  // 이 단언이 없으면 "프로바이더가 있으면 색이 나온다"만 보게 되는데, 그건 컴파일된 CSS 가 **어떤**
  // 색이든 내면 통과한다. 프로바이더를 빼면 색이 조용히 사라지는 것이 이 구조의 실패 모드라
  // 그 사실 자체를 계약으로 적어 둔다.
  it('프로바이더 없이 렌더하면 색이 아예 없다(무색으로 조용히 그려진다)', async () => {
    const { getByTestId } = await render(<Swatch />)

    expect(flattenStyle(getByTestId('card').props.style).backgroundColor).toBeUndefined()
  })

  it('포트가 다른 테마를 적용하면 소비자가 새 값을 받는다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    )

    await act(async () => {
      rnThemeAppearancePort.apply('검은마법사', 검은마법사)
    })

    expect(flattenStyle(getByTestId('card').props.style)).toMatchObject({
      backgroundColor: 검은마법사.surface,
      borderColor: 검은마법사.border,
    })
    // 두 테마가 실제로 다른 색이어야 위 단언에 판별력이 있다.
    expect(검은마법사.surface).not.toBe(머쉬맘.surface)
  })

  it('컨텍스트가 없으면 기본 테마로 폴백하지 않고 던진다', async () => {
    // 폴백을 두면 프로바이더를 빼먹은 화면이 "잘 도는 것처럼" 보인다.
    await expect(render(<ModeProbe />)).rejects.toThrow('테마 컨텍스트가 없습니다')
  })

  // ── 루트가 자기 바탕을 칠한다 ──────────────────────────────────────────────────────
  //
  // 이 View 는 웹의 `:root`/`body` 자리다(파일 머리). **웹은 그 자리를 칠하고 있었고 RN 은 아니었다**.
  // 앱에서 바탕을 칠하는 것이 내비게이터의 화면들뿐이라, 그 화면 **밖**이 드러나는 순간(하위 페이지로
  // 미끄러져 들어갈 때 iOS 가 화면 모서리를 둥글게 깎는다) 그 틈으로 **RN 루트 뷰의 흰색**이 보인다.
  // 시뮬레이터 실측: 내비게이션 두 층을 투명하게 두면 화면의 89.8% 가 흰색이었다.
  it('루트 View 가 테마 바탕색을 칠한다. 화면 밖으로 흰 루트가 새지 않게', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    )

    // 루트는 `Swatch` 의 조상이다. 트리를 타고 올라가 `flex: 1` 인 그 View 를 찾는다.
    let node = getByTestId('card').parent
    while (node !== null && flattenStyle(node.props.style).backgroundColor === undefined) {
      node = node.parent
    }

    expect(node).not.toBeNull()
    expect(flattenStyle(node?.props.style).backgroundColor).toBe(머쉬맘.bg)
  })

  it('테마를 바꾸면 루트 바탕색도 따라간다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    )

    await act(async () => {
      rnThemeAppearancePort.apply('검은마법사', 검은마법사)
    })

    let node = getByTestId('card').parent
    while (node !== null && flattenStyle(node.props.style).backgroundColor === undefined) {
      node = node.parent
    }

    expect(flattenStyle(node?.props.style).backgroundColor).toBe(검은마법사.bg)
    expect(검은마법사.bg).not.toBe(머쉬맘.bg)
  })
})

describe('모드 분기', () => {
  // 웹은 `data-mode` 선택자로, RN 은 **값**으로 푼다. 그래서 같은 클래스가 모드마다 다른 색이 된다.
  it('라이트에서는 패널 테두리가 `border` 와 다른 색이다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    )

    const borderColor = flattenStyle(getByTestId('badge').props.style).borderColor

    expect(borderColor).toBe('#685B4A')
    expect(borderColor).not.toBe(머쉬맘.border)
  })

  it('다크에서는 패널 테두리가 `border` 그대로다(유일한 경계라 손대지 않는다)', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Swatch />
      </ThemeProvider>,
    )

    await act(async () => {
      rnThemeAppearancePort.apply('검은마법사', 검은마법사)
    })

    expect(flattenStyle(getByTestId('badge').props.style).borderColor).toBe(검은마법사.border)
  })

  it.each([
    ['머쉬맘', 'light', 'black'],
    ['검은마법사', 'dark', 'white'],
  ] as const)('%s 는 모드 %s · 스크롤 인디케이터 %s', async (name, mode, indicator) => {
    rnThemeAppearancePort.apply(name, getThemeDefinition(name))

    const { getByTestId } = await render(
      <ThemeProvider>
        <ModeProbe />
      </ThemeProvider>,
    )

    expect(getByTestId('mode').props.children).toBe(`${mode}/${indicator}/${name}`)
  })
})

describe('MediaScope', () => {
  // 카드 안은 바탕이 `mediaSurface` 라 같은 레시피가 다른 기준을 봐야 한다. 재선언이 안 먹으면
  // 페이지의 밝은 표면이 어두운 카드 위로 내려온다(2026-07-30 실패).
  it('같은 `className` 이 카드 안에서는 카드 기준으로 풀린다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <View className="bg-surface" testID="page" />
        <MediaScope className="bg-surface">
          <View className="bg-surface" testID="inside" />
        </MediaScope>
      </ThemeProvider>,
    )

    expect(flattenStyle(getByTestId('page').props.style).backgroundColor).toBe(머쉬맘.surface)
    expect(flattenStyle(getByTestId('inside').props.style).backgroundColor).toBe(머쉬맘.mediaSurface)
    expect(머쉬맘.mediaSurface).not.toBe(머쉬맘.surface)
  })

  it('테마가 바뀌면 카드 기준도 함께 바뀐다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <MediaScope>
          <View className="bg-surface" testID="inside" />
        </MediaScope>
      </ThemeProvider>,
    )

    await act(async () => {
      rnThemeAppearancePort.apply('검은마법사', 검은마법사)
    })

    expect(flattenStyle(getByTestId('inside').props.style).backgroundColor).toBe(
      검은마법사.mediaSurface,
    )
  })
})

