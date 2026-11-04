// 루트 스택. **골격이 실제로 도는가**를 본다. 화면 내용은 자리표시자라 볼 것이 없다(4단계 몫).
//
// 검사하는 것 셋:
//   ① 진입 분기가 **양방향**으로 도는가 (미완료 → 그 화면만 / 열림 → 탭 + 하위 페이지)
//  ② 하위 페이지 열둘이 **하나도 빠짐없이 열리는가**(계획서 §1 의 열하나 + 의 하나)
//  ③ 하위 페이지가 열려도 아래 탭 화면이 **언마운트되지 않는가**
//
// `act` 를 쓰는 규칙
//
// **렌더 *전*에 `act` 를 부르면 그 뒤의 `render` 가 `null` 을 낸다.** RNTL 14 의 `render` 가
// 비동기라(동시성 루트) 이미 열린 act 스코프와 겹치는 것으로 보인다. 원인을 끝까지 파지는 않았고,
// 대신 규칙 둘로 우회한다:
// 렌더 전 상태 준비는 **그냥 `setState`**(마운트된 컴포넌트가 없어 `act` 가 필요 없다)
// 렌더 후 갱신은 **`await act(async =>...)`**. `await` 없는 동기 `act` 는 갱신이
//     반영되지 않은 채 통과한다(단언이 옛 화면을 보고도 초록이 된다)
import { act, render, screen } from '@testing-library/react-native'
import { createNavigationContainerRef } from '@react-navigation/native'
import { useAppEntryStore } from '../../features/app-entry/store'
import { useMvpAskStore } from '../../features/mvp-grade/flow-store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { setLiveUpdatePort } from '../../native/ports'

import { NavigationHarness } from './harness'
import { installMemoryPreferences } from './memory-preferences'
import { STACK_ROUTE_NAMES, type RootStackParamList } from '../routes'

type Stage = 'signIn' | 'characterSetup' | 'ready'

beforeEach(() => {
  installMemoryPreferences()
  // `SettingsAbout` 이 마운트에서 실행 중인 번들 버전을 묻는다(배선). 주입이 없으면
  // 슬롯이 던져 **그 화면이 열리는가** 를 묻는 케이스가 배선과 무관한 이유로 빨개진다.
  // 지원하지 않는 환경으로 두는 것이 이 파일에 맞다. 여기서 보는 것은 라우팅이지 OTA 가 아니다.
  setLiveUpdatePort({
    isSupported: () => false,
    notifyAppReady: async () => {},
    getCurrentVersion: async () => null,
    getChannel: () => 'production',
    check: async () => ({ kind: 'unsupported' }),
    download: async () => {},
    apply: async () => {},
    getNetworkType: async () => 'unknown',
    openStore: () => {} })
  useAppEntryStore.setState({ stage: 'signIn' })
  // `ContentManage` 는 **수동 모드 전용**이라 자동 모드로 두면 열리자마자
  // 물러난다. 그러면 이 파일의 **열둘이 전부 열린다** 가 배선이 아니라 모드 때문에 빨개진다.
  useTrackingModeStore.setState({ mode: 'manual' })
})

describe('진입 분기', () => {
  it('로그인 전이면 그 화면만 있고 탭은 그려지지 않는다', async () => {
    useAppEntryStore.setState({ stage: 'signIn' })

    await render(<NavigationHarness />)

    expect(screen.getByTestId('screen-SignIn')).toBeTruthy()
    expect(screen.queryByTestId('screen-Today', { includeHiddenElements: true })).toBeNull()
  })

  // 온보딩은 뒤로 갈 수 있는 한 스택이다. 부팅이 캐릭터 설정에서 멈춘 것을 찾으면 로그인 위에 캐릭터 설정을 쌓아,
  // 뒤로가기가 로그인으로 간다.
  it('캐릭터 설정 단계로 부팅하면 로그인 위에 캐릭터 설정이 서고 뒤로 가면 로그인이다', async () => {
    useAppEntryStore.setState({ stage: 'characterSetup', resumeTo: 'characterSetup' })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)

    expect(screen.getByTestId('screen-CharacterSetup')).toBeTruthy()
    expect(screen.getByTestId('screen-SignIn', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByTestId('screen-Today', { includeHiddenElements: true })).toBeNull()
    expect(useAppEntryStore.getState().resumeTo).toBeNull()

    await act(async () => {
      navigationRef.goBack()
    })
    expect(screen.getByTestId('screen-SignIn')).toBeTruthy()
  })

  it('MVP 등급 단계로 부팅하면 로그인 · 캐릭터 설정 · MVP 고르기가 쌓인다', async () => {
    useAppEntryStore.setState({ stage: 'mvpGrade', resumeTo: 'mvpGrade' })
    // 물을 것이 이미 서 있으면 고르기 화면이 재지 않는다. 여기서는 저장소를 안 탄다.
    useMvpAskStore.setState({ ask: { kind: 'select', accountIds: [], bulk: false }, accounts: [] })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)

    expect(screen.getByTestId('screen-MvpGradePick')).toBeTruthy()
    await act(async () => {
      navigationRef.goBack()
    })
    expect(screen.getByTestId('screen-CharacterSetup')).toBeTruthy()
  })

  it('열리면 탭이 그려지고 진입 화면은 사라진다', async () => {
    useAppEntryStore.setState({ stage: 'ready' })

    await render(<NavigationHarness />)

    expect(screen.getByTestId('screen-Today')).toBeTruthy()
    expect(screen.queryByTestId('screen-SignIn', { includeHiddenElements: true })).toBeNull()
  })

// **양방향이 요점이다.** 한 방향만 보면 "처음부터 열려 있었다"와 구분되지 않는다.
  // RN 은 화면 목록 자체를 갈아 끼운다(`RootNavigator` 주석).
  it('로그인 → 열림 → 로그인 으로 오갈 때 화면이 따라 바뀐다', async () => {
    useAppEntryStore.setState({ stage: 'signIn' })
    await render(<NavigationHarness />)
    expect(screen.getByTestId('screen-SignIn')).toBeTruthy()

    const setStage = async (stage: Stage): Promise<void> => {
      await act(async () => {
        useAppEntryStore.setState({ stage })
      })
    }

    await setStage('ready')
    expect(screen.getByTestId('screen-Today')).toBeTruthy()
    expect(screen.queryByTestId('screen-SignIn', { includeHiddenElements: true })).toBeNull()

    await setStage('signIn')
    expect(screen.getByTestId('screen-SignIn')).toBeTruthy()
    expect(screen.queryByTestId('screen-Today', { includeHiddenElements: true })).toBeNull()
  })
})

describe('하위 페이지. 열둘', () => {
  const params: Partial<Record<(typeof STACK_ROUTE_NAMES)[number], object>> = {
    SettingsMvpGradeHistory: { accountId: 'A' } }

  it.each(STACK_ROUTE_NAMES)('%s 로 push 하면 그 화면이 열린다', async (name) => {
    useAppEntryStore.setState({ stage: 'ready' })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)

    await act(async () => {
      // 이름·파라미터 조합이 라우트마다 달라 여기서만 타입을 느슨하게 둔다. 목록을 손으로 적지
      // 않고 `STACK_ROUTE_NAMES` 를 도는 것이 이 테스트의 값이라(빠뜨림이 드러난다) 그 대가로 받는다.
      ;(navigationRef.navigate as (name: string, params?: object) => void)(name, params[name])
    })

    expect(screen.getByTestId(`screen-${name}`)).toBeTruthy()
  })

  //  이 세우고 가 일곱 곳으로 넓힌 계약. 아래 화면이 살아 있어야
  // 전환 중에 보여줄 것이 있고, 펼침·기간·스크롤도 남는다. 네이티브 스택이 공짜로 주는 성질이지만
  // 공짜라고 검사하지 않으면 나중에 `presentation` 을 바꿨을 때 조용히 잃는다.
  //
  // `includeHiddenElements` 가 필요한 것이 오히려 증거다. 아래 화면은 **접근성에서만 가려졌고**
  // 트리에는 그대로 있다(언마운트됐다면 이 옵션으로도 안 나온다).
  it('하위 페이지가 열려도 아래 탭 화면이 남아 있다', async () => {
    useAppEntryStore.setState({ stage: 'ready' })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)
    await act(async () => {
      navigationRef.navigate('ContentManage')
    })

    expect(screen.getByTestId('screen-ContentManage')).toBeTruthy()
    expect(screen.getByTestId('screen-Today', { includeHiddenElements: true })).toBeTruthy()
  })

  it('뒤로 가면 하위 페이지만 사라진다', async () => {
    useAppEntryStore.setState({ stage: 'ready' })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)
    await act(async () => {
      navigationRef.navigate('ContentManage')
    })
    await act(async () => {
      navigationRef.goBack()
    })

    expect(screen.queryByTestId('screen-ContentManage', { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId('screen-Today')).toBeTruthy()
  })
})

