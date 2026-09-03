// 떠 있는 바가 **화면 안에서** 규칙대로 도는가. 규칙 자체는 `bar-model.test.ts` 가
// 순수 함수로 고정하므로, 여기서 물을 것은 그 규칙이 **실제 내비게이션에 배선됐는가** 다:
// 눌렀을 때 화면이 바뀌는가· ← 가 서는 자리.
//
// 여기에 광고 게이트 배선도 함께 물었다(그룹 이동에만 걸리는가). 전면광고를 걷으며 그 묶음을
// 통째로 지웠다. **목을 두고 안 불린다 를 물어 봐야 헛것이다**:
// 모듈을 아무도 import 하지 않으므로 그 단언은 배선이 되살아나도 초록이다. 지금 그 자리를 지키는
// 것은 소스를 훑는 `src/__tests__/interstitial-policy.test.ts` 다.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { Dimensions } from 'react-native'
import { isLiquidGlassAvailable } from 'expo-glass-effect'
import { useOnboardingStore } from '../../features/onboarding/store'

import jobThemes from '../../data/job-themes.json'
import type { ThemeDefinition, ThemeName } from '../../types/theme'

import { BAR_MAX_WIDTH, resolveBottomBarMetrics } from '../../lib/bottom-bar-metrics'
import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../theme/appearance-store'
import { resetBarStoreForTests } from '../bar-store'
import { NavigationHarness } from './harness'
import { installMemoryPreferences } from './memory-preferences'

// Liquid Glass 가 **없는** 쪽을 그릴 수 있어야 한다. jest 에서 이 함수는 참을
// 내주므로(유리 경로), 폴백을 물으려면 여기서만 거짓으로 돌려세운다. 기본값은 참 그대로다.
jest.mock('expo-glass-effect', () => ({
  ...jest.requireActual('expo-glass-effect'),
  isLiquidGlassAvailable: jest.fn(() => true),
}))

const isLiquidGlassAvailableMock = isLiquidGlassAvailable as jest.MockedFunction<
  typeof isLiquidGlassAvailable
>

// **`act` 로 감싸지 않는다.** 이 시점에는 마운트된 컴포넌트가 없어 감쌀 이유가 없고, 렌더 *전*의
// `act` 는 뒤따르는 `render` 가 `null` 을 내게 만든다(`RootNavigator.test.tsx` 머리말).
beforeEach(() => {
  installMemoryPreferences()
  resetBarStoreForTests()
  isLiquidGlassAvailableMock.mockReturnValue(true)
  useOnboardingStore.setState({ status: 'completed' })
})

afterEach(() => {
  useOnboardingStore.setState({ status: 'awaitingApiKey' })
  __resetThemeAppearanceForTest()
})

async function press(testID: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

// 유리는 OS 외형이 아니라 앱 테마를 따라야 한다.
//
// `GlassView` 의 `colorScheme` 기본값은 `'auto'`(= 시스템 외형)인데 이 앱은 자체 테마를 쓴다.
// 그 배선이 빠지면 라이트 OS 에서 다크 테마를 켰을 때 새까만 페이지 위에 밝은 유리판이 뜨고,
// 스냅샷을 포함해 어느 테스트도 이것을 잡지 못한다. 그래서 명시로 건다.
//
// 유리판은 누름 과녁 밖에 있어야 한다. 판을 `Pressable` 안에 두면 iOS 가 그 `GlassView`
// 를 아예 그리지 않는다. 알약과 코드가 한 글자도 다르지 않고 런타임 props 까지 같은데도
// 그렇다. 판을 바 루트로 꺼내면 바로 살아난다(바 대비 −15.7 → +23.1). 네이티브 렌더는 jest
// 로 못 보므로 깨졌던 구조 자체를 건다.
describe('채우지 못하는 아이콘은 활성일 때 굵어진다', () => {
  const strokes = (id: string): number[] =>
    [...JSON.stringify(screen.getByTestId(id)).matchAll(/"strokeWidth":([0-9.]+)/g)].map(
      ([, value]) => Number(value),
    )

  // 활성이 되는 자리로 고른다. 그룹 행에서 ← 를 누르면 기록이 있어 **today 로 돌아가므로**
  // 그 경로로는 스케줄이 활성이 되지 않는다.
  it.each([
    ['bar-sub-Content', 'bar-group-schedule', true],   // 목록. 선뿐이라 못 채운다
    ['bar-sub-Cashbook', 'bar-group-ledger', true],    // 장부. 선뿐이라 못 채운다
    ['bar-sub-Boss', 'bar-group-schedule', false],     // 검. 칼날이 면으로 찬다(채우는 쪽)
    ['bar-sub-Profit', 'bar-group-ledger', false],     // 수익. 동전 두 개가 면으로 찬다
    ['bar-group-utility', 'bar-group-utility', false], // 렌치. 채운다
  ] as const)('%s 가 활성일 때 굵어지는가: %s', async (target, entry, thicker) => {
    await render(<NavigationHarness />)
    await press(entry)
    if (target !== entry) await press(target)

    const active = strokes(target)
    expect(active.length).toBeGreaterThan(0)
    expect(active.some((width) => width > 1.5)).toBe(thicker)
  })

  it('비활성은 어느 그림이든 기본 굵기다', async () => {
    await render(<NavigationHarness />)

    // 같은 값이 컴포넌트·호스트 양쪽에 실려 여러 번 잡힌다. 개수가 아니라 **전부 기본인가** 다.
    const widths = strokes('bar-group-schedule')
    expect(widths.length).toBeGreaterThan(0)
    expect(widths.every((width) => width === 1.5)).toBe(true)
  })
})

describe('활성 아이콘 채우기는 가려서 한다', () => {
  it.each([
    ['today', true],
    ['utility', true],
    ['schedule', false],
    ['ledger', false],
  ] as const)('%s 그룹의 활성 아이콘 fill 은 %s 다', async (group, filled) => {
    await render(<NavigationHarness />)
    await press(`bar-group-${group}`)
    if (group === 'schedule' || group === 'ledger') await press('bar-back')

    const item = JSON.stringify(screen.getByTestId(`bar-group-${group}`))
    // 커스텀 아이콘은 뿌리에 자기 `fill="none"` 을 갖는다. **none 이 있나** 가 아니라
    // **none 아닌 fill 이 하나라도 있나** 를 물어야 한다.
    const fills = [...item.matchAll(/"fill":"([^"]*)"/g)].map(([, value]) => value)

    expect(item).toContain('strokeWidth')
    expect(fills.some((value) => value !== 'none')).toBe(filled)
  })
})

describe('← 판이 누름 과녁 밖에 있다', () => {
  it('유리판은 bar-back 의 자식이 아니다', async () => {
    await render(<NavigationHarness />)
    await press('bar-group-schedule')

    expect(screen.getByTestId('bar-back-plate')).toBeTruthy()
    expect(JSON.stringify(screen.getByTestId('bar-back'))).not.toContain('GlassEffect')
  })
})

describe('유리가 앱 테마를 따른다', () => {
  it.each([
    ['혼테일', 'dark'],
    ['레테', 'dark'],
    ['검은마법사', 'dark'],
    ['머쉬맘', 'light'],
  ] as const)('%s 를 켜면 유리가 %s 로 그려진다', async (theme, mode) => {
    setThemeAppearance(theme, (jobThemes as Record<ThemeName, ThemeDefinition>)[theme])

    await render(<NavigationHarness />)

    expect(screen.getByTestId('bar-glass').props.colorScheme).toBe(mode)
  })
})

describe('바는 **지금 페이지** 가 정하는 층을 그린다', () => {
  it('앱을 켜면 today · 그룹 행 · ← 없음', async () => {
    await render(<NavigationHarness />)

    expect(screen.getByTestId('screen-Today')).toBeTruthy()
    expect(screen.getByTestId('bar-group-schedule')).toBeTruthy()
    expect(screen.queryByTestId('bar-back')).toBeNull()
  })

  it('하위를 가진 그룹에 들어가면 하위 행 + ← 가 선다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-schedule')

    expect(screen.getByTestId('screen-Content')).toBeTruthy()
    expect(screen.getByTestId('bar-sub-Boss')).toBeTruthy()
    expect(screen.getByTestId('bar-back')).toBeTruthy()
 // 하위 행이 떴으면 그룹 행은 자리를 비운다. 한 줄에 두 층이 겹칠 수 없다.
    expect(screen.queryByTestId('bar-group-schedule')).toBeNull()
  })

 // 헤더 버튼으로 열던 하위 페이지가 하위 행의 셋째 항목이 됐다. 여기서 물을
 // 것은 **바에 섰는가** 가 아니라 **눌러서 그 화면이 열리는가** 다(라우트 표만 고치고 내비게이터에
 // 안 꽂으면 바에는 서고 화면은 안 바뀐다. 2026-08-13 설정 탭 사고와 같은 부류).
  it('스케줄 하위의 보스 관리를 누르면 그 화면이 열린다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-schedule')
    await press('bar-sub-BossManage')

    expect(screen.getByTestId('screen-BossManage')).toBeTruthy()
 // 하위 행에 남아 있다. 탭이지 push 가 아니므로 층이 안 바뀐다.
    expect(screen.getByTestId('bar-sub-Boss')).toBeTruthy()
    expect(screen.getByTestId('bar-back')).toBeTruthy()
  })

  it('하위가 없는 그룹은 그룹 행을 유지한다. ← 도 안 선다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-settings')

    expect(screen.getByTestId('screen-Settings')).toBeTruthy()
    expect(screen.getByTestId('bar-group-utility')).toBeTruthy()
    expect(screen.queryByTestId('bar-back')).toBeNull()
  })
})

// 떠 있는 것의 층은 **형제 순서**가 정한다.
//
// 펼침판이 화면 **안**에서 그려지던 동안 바는 그 위였다. 펴도 바만 안 흐려졌고, 편 채로 바를 눌러
// 다른 탭으로 갈 수 있었다. `zIndex` 로는 못 고친다(부모가 다르다). 지금은 펼침판이 `Main` 의
// `layout` 안 **바 뒤** 슬롯에 그려지므로, 여기서 물을 것은 **그리는 순서 하나**다.
describe('펼침판은 바보다 뒤에 그려진다', () => {
 /** `toJSON` 을 훑어 그리는 순서대로 낸 testID 목록. 뒤에 있는 것이 위에 그려진다. */
  function 그리는순서(): string[] {
    const order: string[] = []

    function walk(node: unknown): void {
      if (Array.isArray(node)) {
        node.forEach(walk)
        return
      }
      if (node === null || typeof node !== 'object') return

      const element = node as { props?: Record<string, unknown>; children?: unknown }
      const testID = element.props?.testID
      if (typeof testID === 'string') order.push(testID)
      walk(element.children)
    }

    walk(screen.toJSON())
    return order
  }

  it('가계부의 스크림·＋ 가 바 뒤에 선다. 백드롭이 바를 덮는다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-ledger')
    await press('bar-sub-Cashbook')

    const order = 그리는순서()

    expect(order).toContain('speed-dial-scrim')
    expect(order.indexOf('speed-dial-scrim')).toBeGreaterThan(order.indexOf('bottom-bar'))
    expect(order.indexOf('speed-dial-actions')).toBeGreaterThan(order.indexOf('bottom-bar'))
  })
})

describe('← 는 **한 층 내려온 자리**로 되돌린다 (결정 4)', () => {
  it('설정 → 스케줄 → ← → 설정', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-settings')
    await press('bar-group-schedule')
    expect(screen.getByTestId('screen-Content')).toBeTruthy()

    await press('bar-back')

    expect(screen.getByTestId('screen-Settings')).toBeTruthy()
    expect(screen.queryByTestId('bar-back')).toBeNull()
  })

  it('하위끼리 이동은 쌓이지 않아 ← 가 그룹 밖으로 나간다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-utility')
    await press('bar-group-ledger')
    await press('bar-sub-Cashbook')
    await press('bar-sub-Profit')
    await press('bar-sub-Cashbook')

    expect(screen.getByTestId('screen-Cashbook')).toBeTruthy()

    await press('bar-back')

    expect(screen.getByTestId('screen-Utility')).toBeTruthy()
  })

 // 기록 없는 ←(페이지를 두고 그룹 행만 연다)는 앱을 켠 뒤로는 도달하지 않는다. 첫 화면이
 // 그룹 행이라 하위로 내려가는 순간 기록이 반드시 하나 생기기 때문이다. 그 사실 자체가 그
 // 분기가 안전망인 근거라 여기 남긴다. 규칙 자체는 `bar-model.test.ts` 가 상태를 직접 만들어
 // 고정한다.
  it('하위를 오간 뒤에도 ← 는 내려오기 전 자리로 나간다. 그룹 행만 열리지 않는다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-schedule')
    await press('bar-sub-Boss')
    await press('bar-back')

    expect(screen.getByTestId('screen-Today')).toBeTruthy()
  })
})

// 바는 두 플랫폼에 같은 스타일로 도달해야 한다.
//
// `shadowOpacity`·`shadowRadius`·`shadowOffset` 은 iOS 전용 프롭이다. 그것으로 쓰면
// 안드로이드에는 맞춰 둔 층이 하나도 도달하지 않고 `elevation` 의 기본 그림자만 남는다.
// 폴백 알약이 분홍이면 색으로 이미 갈려 있어 그 부재가 안 보이고, 그 색을 빼는 순간 그림자가
// 유일한 층 장치가 된다.
//
// 눈으로는 못 잡는 부류다. 시뮬레이터만 보면 언제나 초록이고 안드로이드에서만 다르게 그려진다.
describe('바의 스타일이 플랫폼을 안 가린다', () => {
  const IOS_ONLY = ['shadowOpacity', 'shadowRadius', 'shadowOffset'] as const

  const styleOf = (testID: string): Record<string, unknown> =>
    Object.assign({},...[screen.getByTestId(testID).props.style].flat(2)) as Record<
      string,
      unknown
    >

  it.each(['bottom-bar', 'bar-pill', 'bar-back-plate'])(
    '%s. 그림자를 boxShadow 로 쓴다',
    async (testID) => {
      await render(<NavigationHarness />)
 // ← 판은 하위 행에만 마운트된다.
      await press('bar-group-ledger')

      const style = styleOf(testID)

      expect(style.boxShadow).toEqual(expect.any(String))
      for (const prop of IOS_ONLY) expect(style[prop]).toBeUndefined()
      // `elevation` 을 함께 걷지 않으면 안드로이드에서 그림자가 **두 번** 그려진다.
      expect(style.elevation).toBeUndefined()
    },
  )

  // 안드로이드 `Text` 는 글자 상자에 폰트 메트릭 여백을 넣어 iOS 보다 상자가 크다. 그래서
  // 아이콘→라벨 간격이 27 → 30px 이 되고 블록이 5px 자라 아이콘이 3px 위로 밀렸다.
  it('라벨이 폰트 메트릭 여백을 끈다', async () => {
    await render(<NavigationHarness />)

    // 화면 헤더에도 같은 글자가 있으므로 **바 안에서** 찾는다.
    const label = within(screen.getByTestId('bar-group-today')).getByText('today')
    const style = Object.assign({},...[label.props.style].flat(2)) as Record<string, unknown>

    expect(style.includeFontPadding).toBe(false)
  })

 // 바의 치수는 **창 폭에서 계산**된다. 값 자체는 `bottom-bar-metrics.test.ts`
 // 가 지키므로 여기서 물을 것은 **바가 그 함수를 실제로 보는가** 다. 숫자를 손으로 적어 두면 바와
  // 콘텐츠 인셋(`ScreenScroll`)이 서로 다른 값을 믿는 상태가 조용히 만들어진다.
  it('바의 폭·높이가 창 폭에서 나온다', async () => {
    await render(<NavigationHarness />)
    const metrics = resolveBottomBarMetrics(Dimensions.get('window').width)

    const style = styleOf('bottom-bar')

    expect(style.height).toBe(metrics.heightPx)
    expect(style.left).toBe(metrics.sideMarginPx)
    expect(style.right).toBe(metrics.sideMarginPx)
  })

 // 큰 화면에서 캡슐이 계속 늘어나지 않는다. 테스트 창(750pt)이 이미 상한 밖이라
 // 이 단언이 **상한이 실제로 걸린 자리** 를 본다.
  it('창이 상한보다 넓으면 바가 상한에서 멈추고 가운데 선다', async () => {
    await render(<NavigationHarness />)
    const windowWidth = Dimensions.get('window').width
    const style = styleOf('bottom-bar')

    expect(windowWidth).toBeGreaterThan(BAR_MAX_WIDTH)
    expect(windowWidth - Number(style.left) - Number(style.right)).toBe(BAR_MAX_WIDTH)
    expect(style.left).toBe(style.right)
  })
})

// 재질이 없는 쪽은 흉내 내지 않는다.
//
// `expo-glass-effect` 는 iOS 26 이상에서만 산다. 그 아래 iOS 와 안드로이드에는 이 재질이 없고,
// 없는 것을 블러로 흉내 내지 않는다.
//
// 폴백에서 지켜야 하는 것은 둘이다. 재질을 흉내 내는 판이 없을 것, 그 자리를 불투명 캡슐이 채울
// 것. 색 관계는 `bar-colors.test.ts` 가 테마 전부에 대고 따로 건다.
describe('재질이 없는 쪽은 흉내 내지 않는다', () => {
  it('유리가 없으면 불투명 캡슐이다. 블러 판을 얹지 않는다', async () => {
    isLiquidGlassAvailableMock.mockReturnValue(false)
    setThemeAppearance('엔젤릭버스터', (jobThemes as Record<ThemeName, ThemeDefinition>)['엔젤릭버스터'])

    await render(<NavigationHarness />)
    const bar = Object.assign(
      {},
      ...[screen.getByTestId('bottom-bar').props.style].flat(2),
    ) as Record<string, unknown>

    expect(screen.queryByTestId('bar-glass')).toBeNull()
    expect(screen.queryByTestId('bar-blur')).toBeNull()
 // 유리가 없으면 바탕은 **바 자신이** 칠한다(유리일 때는 투명이어야 한다. 아래 케이스).
    expect(bar.backgroundColor).toBe('#FEF8FB')
  })

  it('유리가 있으면 바탕을 재질에 맡긴다', async () => {
    await render(<NavigationHarness />)
    const bar = Object.assign(
      {},
      ...[screen.getByTestId('bottom-bar').props.style].flat(2),
    ) as Record<string, unknown>

    expect(screen.getByTestId('bar-glass')).toBeTruthy()
    expect(bar.backgroundColor).toBe('transparent')
  })
})