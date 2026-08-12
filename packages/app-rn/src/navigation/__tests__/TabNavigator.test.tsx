// 탭 전환 전면광고 인터셉터 — **광고가 뜨는지가 아니라 게이트가 불리는지**를 본다.
//
// 판정 자체([[ADR-090]] 결정 3 의 30분·60초·사전 로드)는 `packages/core` 의 순수 함수가 갖고 있고
// 그쪽 테스트가 이미 검사한다. 여기서 물을 수 있는 것은 하나뿐이다: 웹에서 캡처 단계 DOM 리스너가
// 맡던 자리를 RN 에서 **탭 `listeners` 가 이어받았는가**(`parity-inventory.md` §1).
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { maybeShowTabSwitchAd } from '@core/features/ads/tab-switch-ad'
import { useOnboardingStore } from '@core/features/onboarding/store'

import { NavigationHarness } from './harness'

jest.mock('@core/features/ads/tab-switch-ad', () => ({
  __esModule: true,
  maybeShowTabSwitchAd: jest.fn(async () => {}),
  startAds: jest.fn(async () => {}),
}))

const maybeShowTabSwitchAdMock = maybeShowTabSwitchAd as jest.MockedFunction<
  typeof maybeShowTabSwitchAd
>

// **`act()` 로 감싸지 않는다.** 이 시점에는 마운트된 컴포넌트가 없어 감쌀 이유가 없고, 렌더 *전*의
// `act` 는 뒤따르는 `render()` 가 `null` 을 내게 만든다(실측 — `RootNavigator.test.tsx` 머리말).
beforeEach(() => {
  maybeShowTabSwitchAdMock.mockClear()
  useOnboardingStore.setState({ status: 'completed' })
})

afterEach(() => {
  useOnboardingStore.setState({ status: 'awaitingApiKey' })
})

/**
 * 탭을 누르고 **화면 갱신이 반영될 때까지 기다린다.**
 *
 * `fireEvent` 만으로는 부족하다 — RNTL 14 의 렌더 루트는 동시성 모드라 `await act(async …)` 로
 * 한 번 흘려보내야 다음 단언이 새 화면을 본다. 안 그러면 "옛 화면을 보고 초록"이 아니라 "새 화면을
 * 못 찾아 빨강"으로 나타나는데, 그때 원인이 배선 문제처럼 보인다(실측 2026-08-12).
 */
async function pressTab(label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByText(label))
  })
}

describe('탭 전환 광고 인터셉터 ([[ADR-090]])', () => {
  it('다른 탭을 누르면 게이트가 불린다', async () => {
    await render(<NavigationHarness />)

    await pressTab('보스')

    expect(screen.getByTestId('screen-Boss')).toBeTruthy()
    expect(maybeShowTabSwitchAdMock).toHaveBeenCalledTimes(1)
  })

  // 웹의 `window.location.pathname !== href` 와 같은 판정이다. 이것이 없으면 같은 탭을 연타하는
  // 것만으로 게이트가 계속 불려 *"after every user action"* 쪽으로 밀린다([[ADR-090]] 결정 2).
  it('같은 탭을 다시 눌러도 불리지 않는다', async () => {
    await render(<NavigationHarness />)

    await pressTab('컨텐츠')

    expect(screen.getByTestId('screen-Content')).toBeTruthy()
    expect(maybeShowTabSwitchAdMock).not.toHaveBeenCalled()
  })

  it('탭을 옮길 때마다 한 번씩 불린다', async () => {
    await render(<NavigationHarness />)

    await pressTab('보스')
    await pressTab('수익')
    await pressTab('설정')

    expect(screen.getByTestId('screen-Settings')).toBeTruthy()
    expect(maybeShowTabSwitchAdMock).toHaveBeenCalledTimes(3)
  })

  // **"게이트가 실패해도 탭은 바뀐다"는 따로 안 쓴다.** 써 보고 지웠다 — `maybeShowTabSwitchAd` 는
  // 자기 안에서 전부 삼켜 거부하는 일이 없으므로(core `tab-switch-ad.ts` 의 `catch`), 그 상황을
  // 만들려면 목을 거부시켜야 하는데 그러면 **테스트가 만든 처리되지 않은 거부**를 테스트가 잡는
  // 꼴이 된다(실제 코드 경로에는 없는 실패다). 진짜로 지켜야 할 것 — *"리스너가 이동을 막지
  // 않는다"* — 은 위 세 케이스가 매번 새 화면을 단언하는 것으로 이미 고정된다.
})
