// 층은 진짜 스택 한 단이다.
//
// 이 파일이 거는 것은 바가 어떻게 보이는가 가 아니라 이동이 내비게이션 상태에 무엇을 남기는가
// 다. iOS 가장자리 스와이프는 우리가 만드는 것이 아니라 되돌아갈 단이 있으면 OS 가 주는
// 것이고, 그룹→하위 이동이 형제 탭 전환이면 그 단이 아예 없다.
//
// 그래서 스와이프가 되는가 를 직접 물을 수 없어도(네이티브 제스처는 jest 에 없다) 그 제스처가
// 걸릴 자리가 생겼는가 는 여기서 정확히 물을 수 있다.
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createNavigationContainerRef, StackActions } from '@react-navigation/native'

import { useAppEntryStore } from '../../features/app-entry/store'
import { __resetThemeAppearanceForTest } from '../../theme/appearance-store'
import { resetBarStoreForTests } from '../../components/organisms/BottomBar/bar-store'
import { PUSH_SCREEN_OPTIONS } from '../push-screen-options'
import { needsPopToGroupLayer, tabNavigateArgs } from '../tab-navigate'
import { NavigationHarness } from './harness'
import { installMemoryPreferences } from './memory-preferences'
import type { RootStackParamList } from '../routes'

type ContainerRef = React.ComponentProps<typeof NavigationHarness>['navigationRef']

let navigationRef: ContainerRef

beforeEach(() => {
  installMemoryPreferences()
  resetBarStoreForTests()
  useAppEntryStore.setState({ stage: 'ready' })
  navigationRef = createNavigationContainerRef<RootStackParamList>() as ContainerRef
})

afterEach(() => {
  useAppEntryStore.setState({ stage: 'signIn' })
  __resetThemeAppearanceForTest()
})

async function 앱을_켠다(): Promise<void> {
  await act(async () => {
    render(<NavigationHarness navigationRef={navigationRef} />)
  })
}

async function press(testID: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

/** 루트 스택이 든 화면 이름들. 하위 페이지는 `Main` **위**로 쌓인다. */
function 루트_단들(): string[] {
  return (navigationRef?.getRootState().routes ?? []).map((route) => route.name)
}

/** 층 스택이 든 단들. 이 배열의 길이가 곧 되돌아갈 단이 몇 개인가 다. */
function 층_단들(): string[] {
  const main = navigationRef?.getRootState().routes.find((route) => route.name === 'Main')
  return (main?.state?.routes ?? []).map((route) => route.name)
}

/** 지금 층 안에서 보고 있는 화면. */
function 지금_화면(): string | undefined {
  const main = navigationRef?.getRootState().routes.find((route) => route.name === 'Main')
  const layerState = main?.state
  if (layerState === undefined) return undefined
  const layer = layerState.routes[layerState.index ?? 0]
  const inner = layer.state
  return inner === undefined ? undefined : inner.routes[inner.index ?? 0]?.name
}

describe('그룹 진입이 스택 한 단을 만든다', () => {
  it('앱을 켜면 층은 한 단이다. 그룹 행이고 되돌아갈 자리가 없다', async () => {
    await 앱을_켠다()

    expect(루트_단들()).toEqual(['Main'])
    expect(층_단들()).toEqual(['Groups'])
    expect(지금_화면()).toBe('Today')
  })

  // 이 이동 뒤에 층이 한 단이면(형제 탭 전환) 가장자리 스와이프가 걸릴 자리가 없다.
  it('스케줄러를 누르면 한 단 쌓인다. 여기가 제스처가 걸리는 자리다', async () => {
    await 앱을_켠다()

    await press('bar-group-schedule')

    expect(층_단들()).toEqual(['Groups', 'ScheduleSubs'])
    expect(지금_화면()).toBe('Content')
  })

  it('← 를 누르면 그 단이 없어진다. 스와이프가 만드는 것과 같은 결과다', async () => {
    await 앱을_켠다()
    await press('bar-group-schedule')

    await press('bar-back')

    expect(층_단들()).toEqual(['Groups'])
    expect(지금_화면()).toBe('Today')
  })
})

describe('같은 층의 옆걸음은 쌓이지 않는다', () => {
  // 사용자 결정: *"지금처럼 옆걸음. 안 쌓는다."* 컨텐츠 → 보스 뒤에 ← 를 누르면
  // 컨텐츠가 아니라 **그룹에 들어오기 전 자리**로 나간다.
  it('컨텐츠 → 보스 는 같은 단 안에서 바뀐다', async () => {
    await 앱을_켠다()
    await press('bar-group-schedule')

    await press('bar-sub-Boss')

    expect(층_단들()).toEqual(['Groups', 'ScheduleSubs'])
    expect(지금_화면()).toBe('Boss')

    await press('bar-back')
    expect(층_단들()).toEqual(['Groups'])
  })

  // **이 설계의 축**. 둘 다 하위가 없어 같은 층이다.
  it('유틸리티 → 설정 은 그룹 층 안에서 바뀐다', async () => {
    await 앱을_켠다()
    await press('bar-group-utility')

    await press('bar-group-settings')

    expect(층_단들()).toEqual(['Groups'])
    expect(지금_화면()).toBe('Settings')
  })

  // 바에서는 이 길이 안 보인다. 하위 행에는 **하위만** 서고 그룹 행으로 가려면 ← 를 거친다.
  // 화면 CTA(**캐릭터 선택하러 가기** 등)는 `openTab` 으로 그룹 층 페이지를 곧장 지목하는데,
  // 그때 층이 쌓이지 않고 **올라가면서 옆걸음해야** 한다.
  it('하위 층에서 그룹 층 페이지를 열면 층이 한 단으로 돌아온다', async () => {
    await 앱을_켠다()
    await press('bar-group-ledger')
    expect(층_단들()).toHaveLength(2)

    // `openTab('Settings')` 가 하는 그대로다. 그룹 층은 스택 **바닥**이라 되돌리기가 곧
    // `popToTop` 이고, 그 뒤에 안쪽 탭을 지정한다(`hooks/useOpenTab.ts`).
    expect(needsPopToGroupLayer('Settings')).toBe(true)
    const [name, nested] = tabNavigateArgs('Settings')
    await act(async () => {
      navigationRef?.dispatch(StackActions.popToTop())
      ;(navigationRef?.navigate as unknown as (route: string, params: unknown) => void)(name, nested)
    })

    expect(층_단들()).toEqual(['Groups'])
    expect(지금_화면()).toBe('Settings')
  })
})

describe('마지막으로 보던 하위를 기억한다', () => {
  // 그룹을 나가면 그 단이 언마운트돼 안쪽 탭 상태가 사라진다. `lastSub` 가 스택으로 옮겨가지 못하고
  // 남은 유일한 값인 이유가 이것이다.
  it('나갔다 다시 들어오면 그 자리로 간다', async () => {
    await 앱을_켠다()
    await press('bar-group-schedule')
    await press('bar-sub-BossManage')

    await press('bar-back')
    await press('bar-group-schedule')

    expect(지금_화면()).toBe('BossManage')
  })
})

// 두 스택이 **같은 상수**를 쓴다는 것이 **다른 하위 페이지처럼 열린다** 의 실질이다. 각자 적으면
// 그 **처럼** 이 우연이 되고, 한쪽만 고쳐도 아무 테스트가 울지 않는다.
describe('층은 하위 페이지와 같은 방식으로 열린다', () => {
  it('전환과 제스처가 켜져 있다', () => {
    expect(PUSH_SCREEN_OPTIONS.animation).toBe('ios_from_right')
    expect(PUSH_SCREEN_OPTIONS.gestureEnabled).toBe(true)
    // 가장자리 인식기는 **OS 기본값**이어야 한다. 숫자를 얹으면 흉내가 원본을 덮는다.
    expect(PUSH_SCREEN_OPTIONS.gestureResponseDistance).toBeUndefined()
    expect(PUSH_SCREEN_OPTIONS.fullScreenGestureEnabled).toBeUndefined()
  })
})
