// 떠 있는 바가 **화면 안에서** 규칙대로 도는가([[ADR-132]]). 규칙 자체는 `bar-model.test.ts` 가
// 순수 함수로 고정하므로, 여기서 물을 것은 그 규칙이 **실제 내비게이션에 배선됐는가** 다:
// 눌렀을 때 화면이 바뀌는가 · ← 가 서는 자리 · 광고 게이트가 그룹 이동에만 걸리는가.
//
// 게이트가 여기 있는 이유는 [[ADR-132]] 결정 9 다 — 예전에는 `tabPress` 리스너가 맡았지만, 이제
// 그룹 이동·하위 이동·뒤로가기가 전부 탭 전환이라 거기 걸면 셋이 다 게이트를 탄다.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { isLiquidGlassAvailable } from 'expo-glass-effect'
import { maybeShowTabSwitchAd } from '@core/features/ads/tab-switch-ad'
import { useOnboardingStore } from '@core/features/onboarding/store'

import jobThemes from '@core/data/job-themes.json'
import type { ThemeDefinition, ThemeName } from '@core/types/theme'

import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../theme/appearance-store'
import { resetBarStoreForTests } from '../bar-store'
import { NavigationHarness } from './harness'
import { installMemoryPreferences } from './memory-preferences'

jest.mock('@core/features/ads/tab-switch-ad', () => ({
  __esModule: true,
  maybeShowTabSwitchAd: jest.fn(async () => {}),
  startAds: jest.fn(async () => {}),
}))

// Liquid Glass 가 **없는** 쪽을 그릴 수 있어야 한다 ([[ADR-132]] 정정 29). jest 에서 이 함수는 참을
// 내주므로(유리 경로), 폴백을 물으려면 여기서만 거짓으로 돌려세운다 — 기본값은 참 그대로다.
jest.mock('expo-glass-effect', () => ({
  ...jest.requireActual('expo-glass-effect'),
  isLiquidGlassAvailable: jest.fn(() => true),
}))

const isLiquidGlassAvailableMock = isLiquidGlassAvailable as jest.MockedFunction<
  typeof isLiquidGlassAvailable
>

const maybeShowTabSwitchAdMock = maybeShowTabSwitchAd as jest.MockedFunction<
  typeof maybeShowTabSwitchAd
>

// **`act()` 로 감싸지 않는다.** 이 시점에는 마운트된 컴포넌트가 없어 감쌀 이유가 없고, 렌더 *전*의
// `act` 는 뒤따르는 `render()` 가 `null` 을 내게 만든다(실측 — `RootNavigator.test.tsx` 머리말).
beforeEach(() => {
  installMemoryPreferences()
  resetBarStoreForTests()
  isLiquidGlassAvailableMock.mockReturnValue(true)
  maybeShowTabSwitchAdMock.mockClear()
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

// 유리는 **OS 외형이 아니라 앱 테마**를 따라야 한다 ([[ADR-132]] 정정 19).
//
// `GlassView` 의 `colorScheme` 기본값은 `'auto'`(= 시스템 외형)인데 이 앱은 자체 테마를 쓴다. 그
// 배선이 빠져 있던 동안 라이트 OS 에서 레테를 켜면 **새까만 페이지 위에 밝은 유리판**이 떴고,
// 그때까지 있던 테스트는 스냅샷을 포함해 하나도 이것을 잡지 못했다 — 그래서 명시로 건다.
// ← 의 유리판은 **누름 과녁 «밖»** 에 있어야 한다 ([[ADR-132]] 정정 21).
//
// 판을 `Pressable` 안에 두었더니 iOS 가 그 `GlassView` 를 **아예 그리지 않았다** — 알약과 코드가
// 한 글자도 다르지 않고 런타임 props 까지 같았는데도. 빨간 tint 를 강제로 넣어도 반응이 없어
// «렌더 없음» 이 확정됐고, 판을 바 루트로 꺼내니 바로 살아났다(바 대비 −15.7 → +23.1).
// 네이티브 렌더는 jest 로 못 보므로, **깨졌던 구조 자체**를 건다.
// 활성 아이콘은 **가려서** 채운다 ([[ADR-132]] 정정 25).
//
// fill 과 stroke 가 같은 색이라, 안쪽에 선이 있는 lucide 아이콘은 채우는 순간 그 선이 사라진다 —
// 조준경은 십자선을 잃어 원판이 되고 달력·지갑은 안쪽 체크·주머니를 잃는다(사용자 판정 —
// *"싹다 채워버리면 어떡해"*). 목록을 늘릴 때 이 검사가 «전부 채우기» 로 돌아가는 것을 막는다.
//
// 톱니와 수익은 **우리가 그린 아이콘이라 채울 자리를 고를 수 있어** 채우는 쪽인데, 여기서는 안
// 다룬다 — 그 둘은 뿌리에 자기 `fill="none"` 을 갖고 채우기는 안쪽 도형에만 걸려서 이 검사의
// 눈에 안 보인다. 각자의 테스트가 더 정확하게 잡는다(`GearIcon` 은 evenodd 로 가운데를 비우는지,
// `ProfitIcon` 은 동전 둘에만 걸리고 호에는 안 새는지).
// 채우지 못하는 그림은 **굵기로** 활성을 말한다 ([[ADR-132]] 정정 27).
//
// 채우기가 통하는 셋(대시보드·렌치·장바구니)과 커스텀 둘(톱니·수익)은 면으로 활성을 표시하는데,
// 나머지(달력·지갑·목록·검·조준경)는 안쪽 선이 의미를 져서 채울 수 없다 — 그쪽만 획을 키운다.
// 둘 다 하면 채운 그림이 과해지므로 **배타**여야 하고, 그 배타성을 여기서 건다.
describe('채우지 못하는 아이콘은 활성일 때 굵어진다 ([[ADR-132]] 정정 27)', () => {
  const strokes = (id: string): number[] =>
    [...JSON.stringify(screen.getByTestId(id)).matchAll(/"strokeWidth":([0-9.]+)/g)].map(
      ([, value]) => Number(value),
    )

  // 활성이 되는 자리로 고른다 — 그룹 행에서 ← 를 누르면 기록이 있어 **today 로 돌아가므로**
  // 그 경로로는 스케줄이 활성이 되지 않는다([[ADR-132]] 결정 4).
  it.each([
    ['bar-sub-Content', 'bar-group-schedule', true],   // 목록 — 선뿐이라 못 채운다
    ['bar-sub-HuntingProfit', 'bar-group-ledger', true], // 조준경 — 채우면 원판이 된다
    ['bar-sub-Boss', 'bar-group-schedule', false],     // 검 — 칼날이 면으로 찬다(채우는 쪽)
    ['bar-sub-Spend', 'bar-group-ledger', false],      // 장바구니 — 채운다
    ['bar-group-utility', 'bar-group-utility', false], // 렌치 — 채운다
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

    // 같은 값이 컴포넌트·호스트 양쪽에 실려 여러 번 잡힌다 — 개수가 아니라 «전부 기본인가» 다.
    const widths = strokes('bar-group-schedule')
    expect(widths.length).toBeGreaterThan(0)
    expect(widths.every((width) => width === 1.5)).toBe(true)
  })
})

describe('활성 아이콘 채우기는 가려서 한다 ([[ADR-132]] 정정 25)', () => {
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
    // 커스텀 아이콘은 뿌리에 자기 `fill="none"` 을 갖는다 — «none 이 있나» 가 아니라
    // «none 아닌 fill 이 하나라도 있나» 를 물어야 한다.
    const fills = [...item.matchAll(/"fill":"([^"]*)"/g)].map(([, value]) => value)

    expect(item).toContain('strokeWidth')
    expect(fills.some((value) => value !== 'none')).toBe(filled)
  })
})

describe('← 판이 누름 과녁 밖에 있다 ([[ADR-132]] 정정 21)', () => {
  it('유리판은 bar-back 의 자식이 아니다', async () => {
    await render(<NavigationHarness />)
    await press('bar-group-schedule')

    expect(screen.getByTestId('bar-back-plate')).toBeTruthy()
    expect(JSON.stringify(screen.getByTestId('bar-back'))).not.toContain('GlassEffect')
  })
})

describe('유리가 앱 테마를 따른다 ([[ADR-132]] 정정 19)', () => {
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

describe('바는 «지금 페이지» 가 정하는 층을 그린다 ([[ADR-132]] 결정 2·3)', () => {
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
    // 하위 행이 떴으면 그룹 행은 자리를 비운다 — 한 줄에 두 층이 겹칠 수 없다.
    expect(screen.queryByTestId('bar-group-schedule')).toBeNull()
  })

  it('하위가 없는 그룹은 그룹 행을 유지한다 — ← 도 안 선다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-settings')

    expect(screen.getByTestId('screen-Settings')).toBeTruthy()
    expect(screen.getByTestId('bar-group-utility')).toBeTruthy()
    expect(screen.queryByTestId('bar-back')).toBeNull()
  })
})

describe('← 는 «한 층 내려온 자리»로 되돌린다 (결정 4)', () => {
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
    await press('bar-sub-HuntingProfit')
    await press('bar-sub-Spend')

    expect(screen.getByTestId('screen-Spend')).toBeTruthy()

    await press('bar-back')

    expect(screen.getByTestId('screen-Utility')).toBeTruthy()
  })

  // 결정 5 의 «기록 없는 ←»(페이지를 두고 그룹 행만 연다)는 **앱을 켠 뒤로는 도달하지 않는다** —
  // 첫 화면이 그룹 행이라 하위로 내려가는 순간 기록이 반드시 하나 생기기 때문이다. 처음 이 자리를
  // 그 규칙의 테스트로 쓰려다 실패해서 알았고(← 가 today 로 나갔다), 그 사실 자체가 결정 5 가
  // «안전망» 인 근거라 여기 남긴다. 규칙 자체는 `bar-model.test.ts` 가 상태를 직접 만들어 고정한다.
  it('하위를 오간 뒤에도 ← 는 내려오기 전 자리로 나간다 — 그룹 행만 열리지 않는다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-schedule')
    await press('bar-sub-Boss')
    await press('bar-back')

    expect(screen.getByTestId('screen-Today')).toBeTruthy()
  })
})

describe('광고 게이트는 그룹 이동에만 (결정 9)', () => {
  it('다른 그룹을 누르면 불린다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-ledger')

    expect(screen.getByTestId('screen-Profit')).toBeTruthy()
    expect(maybeShowTabSwitchAdMock).toHaveBeenCalledTimes(1)
  })

  // 웹의 `window.location.pathname !== href` 와 같은 판정이다([[ADR-090]] 결정 2) — 이것이 없으면
  // 같은 자리를 연타하는 것만으로 게이트가 계속 불린다.
  it('같은 그룹을 다시 눌러도 불리지 않는다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-today')

    expect(screen.getByTestId('screen-Today')).toBeTruthy()
    expect(maybeShowTabSwitchAdMock).not.toHaveBeenCalled()
  })

  it('하위 이동과 ← 는 게이트 밖이다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-schedule')
    maybeShowTabSwitchAdMock.mockClear()

    await press('bar-sub-Boss')
    await press('bar-back')

    expect(maybeShowTabSwitchAdMock).not.toHaveBeenCalled()
  })

  it('그룹을 옮길 때마다 한 번씩 불린다', async () => {
    await render(<NavigationHarness />)

    await press('bar-group-schedule')
    await press('bar-back')
    await press('bar-group-ledger')
    await press('bar-back')
    await press('bar-group-settings')

    expect(screen.getByTestId('screen-Settings')).toBeTruthy()
    expect(maybeShowTabSwitchAdMock).toHaveBeenCalledTimes(3)
  })

  // **"게이트가 실패해도 이동은 된다"는 따로 안 쓴다.** 써 보고 지웠다 — `maybeShowTabSwitchAd` 는
  // 자기 안에서 전부 삼켜 거부하는 일이 없으므로(core `tab-switch-ad.ts` 의 `catch`), 그 상황을
  // 만들려면 목을 거부시켜야 하는데 그러면 **테스트가 만든 처리되지 않은 거부**를 테스트가 잡는
  // 꼴이 된다. 진짜로 지켜야 할 것 — *"게이트가 이동을 막지 않는다"* — 은 위 케이스들이 매번 새
  // 화면을 단언하는 것으로 이미 고정된다.
})

// 바는 **두 플랫폼에 같은 스타일로 도달해야 한다** ([[ADR-132]] 정정 28).
//
// `shadowOpacity`·`shadowRadius`·`shadowOffset` 은 **iOS 전용 프롭**이다. 그것으로 쓰면 안드로이드에는
// 정정 22 가 맞춰 둔 층이 **하나도 도달하지 않고** `elevation` 의 기본 그림자만 남는다. 두 주 동안
// 그 부재가 안 보였던 것은 폴백 알약이 분홍이라 **색으로 이미 갈려 있었기** 때문이고, 그 색을 빼는
// 순간(정정 28-1) 그림자가 유일한 층 장치가 된다 — 그래서 이 검사가 그 색 변경과 한 쌍이다.
//
// 눈으로는 못 잡는 부류다: 시뮬레이터만 보면 언제나 초록이고, 안드로이드에서만 다르게 그려진다.
describe('바의 스타일이 플랫폼을 안 가린다 ([[ADR-132]] 정정 28)', () => {
  const IOS_ONLY = ['shadowOpacity', 'shadowRadius', 'shadowOffset'] as const

  const styleOf = (testID: string): Record<string, unknown> =>
    Object.assign({}, ...[screen.getByTestId(testID).props.style].flat(2)) as Record<
      string,
      unknown
    >

  it.each(['bottom-bar', 'bar-pill', 'bar-back-plate'])(
    '%s — 그림자를 boxShadow 로 쓴다',
    async (testID) => {
      await render(<NavigationHarness />)
      // ← 판은 하위 행에만 마운트된다([[ADR-132]] 정정 26).
      await press('bar-group-ledger')

      const style = styleOf(testID)

      expect(style.boxShadow).toEqual(expect.any(String))
      for (const prop of IOS_ONLY) expect(style[prop]).toBeUndefined()
      // `elevation` 을 함께 걷지 않으면 안드로이드에서 그림자가 **두 번** 그려진다.
      expect(style.elevation).toBeUndefined()
    },
  )

  // 안드로이드 `Text` 는 글자 상자에 폰트 메트릭 여백을 넣어 iOS 보다 상자가 크다 — 실측으로
  // 아이콘→라벨 간격이 27 → 30px 이 되고 블록이 5px 자라 아이콘이 3px 위로 밀렸다.
  it('라벨이 폰트 메트릭 여백을 끈다', async () => {
    await render(<NavigationHarness />)

    // 화면 헤더에도 같은 글자가 있으므로 **바 안에서** 찾는다.
    const label = within(screen.getByTestId('bar-group-today')).getByText('today')
    const style = Object.assign({}, ...[label.props.style].flat(2)) as Record<string, unknown>

    expect(style.includeFontPadding).toBe(false)
  })
})

// 재질이 없는 쪽은 **흉내 내지 않는다** ([[ADR-132]] 정정 29).
//
// `expo-glass-effect` 는 iOS 26 이상에서만 산다. 그 아래 iOS 와 안드로이드에는 이 재질이 없고, 없는
// 것을 블러로 흉내 내는 판을 한 번 만들었다가 되돌렸다(사용자 지시 — 억지로 만들지 말고 색만 맞출 것).
//
// 그래서 폴백에서 지켜야 하는 것은 둘이다: **재질을 흉내 내는 판이 없을 것**, 그리고 그 자리를
// **불투명 캡슐**이 채울 것. 색 관계는 `bar-colors.test.ts` 가 테마 전부에 대고 따로 건다.
describe('재질이 없는 쪽은 흉내 내지 않는다 ([[ADR-132]] 정정 29)', () => {
  it('유리가 없으면 불투명 캡슐이다 — 블러 판을 얹지 않는다', async () => {
    isLiquidGlassAvailableMock.mockReturnValue(false)
    setThemeAppearance('엔젤릭버스터', (jobThemes as Record<ThemeName, ThemeDefinition>)['엔젤릭버스터'])

    await render(<NavigationHarness />)
    const bar = Object.assign(
      {},
      ...[screen.getByTestId('bottom-bar').props.style].flat(2),
    ) as Record<string, unknown>

    expect(screen.queryByTestId('bar-glass')).toBeNull()
    expect(screen.queryByTestId('bar-blur')).toBeNull()
    // 유리가 없으면 바탕은 **바 자신이** 칠한다(유리일 때는 투명이어야 한다 — 아래 케이스).
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
