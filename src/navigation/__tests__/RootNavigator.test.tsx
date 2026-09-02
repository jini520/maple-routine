// 루트 스택 — **골격이 실제로 도는가**를 본다. 화면 내용은 자리표시자라 볼 것이 없다(4단계 몫).
//
// 검사하는 것 넷:
//   ① 온보딩 분기가 **양방향**으로 도는가 (미완료 → 온보딩만 / 완료 → 탭 + 하위 페이지)
//  ② 하위 페이지 열둘이 **하나도 빠짐없이 열리는가**(계획서 §1 의 열하나 + 의 하나)
//  ③ 같은 상세를 두 경로가 가리키는가
//  ④ 하위 페이지가 열려도 아래 탭 화면이 **언마운트되지 않는가**
//
// ── `act` 를 쓰는 규칙 (실측 2026-08-12) ──────────────────────────────────────────────
//
// **렌더 *전*에 `act()` 를 부르면 그 뒤의 `render()` 가 `null` 을 낸다.** RNTL 14 의 `render` 가
// 비동기라(동시성 루트) 이미 열린 act 스코프와 겹치는 것으로 보인다. 원인을 끝까지 파지는 않았고,
// 대신 규칙 둘로 우회한다:
//   · 렌더 전 상태 준비는 **그냥 `setState`**(마운트된 컴포넌트가 없어 `act` 가 필요 없다)
//   · 렌더 후 갱신은 **`await act(async () => ...)`**. `await` 없는 동기 `act` 는 갱신이
//     반영되지 않은 채 통과한다(단언이 옛 화면을 보고도 초록이 된다)
import { act, render, screen } from '@testing-library/react-native'
import { createNavigationContainerRef } from '@react-navigation/native'
import { FEATURE_GUIDES } from '../../data/feature-guides'
import { useOnboardingStore } from '../../features/onboarding/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { setLiveUpdatePort } from '../../native/ports'

import { NavigationHarness } from './harness'
import { installMemoryPreferences } from './memory-preferences'
import { FEATURE_GUIDE_ROUTE_NAMES, STACK_ROUTE_NAMES, type RootStackParamList } from '../routes'

type Status = 'awaitingApiKey' | 'completed'

/**
 * 안내 상세를 여는 데 쓰는 표본. **카탈로그에서 뽑는다**. 문자열을 손으로 적으면 안내가 개명될
 * 때 이 테스트가 *"두 경로가 같은 화면을 그리는가"* 대신 *"그 id 가 아직 있는가"* 를 묻게 되고,
 * 그 실패는 원인이 전혀 다른데 같은 자리에서 빨개진다.
 */
const GUIDE = FEATURE_GUIDES[0]
const GUIDE_ID = GUIDE.id
// 웹의 `?s=` 자리 — 경로가 아니라 파라미터라 스택 한 단으로 읽히지 않는다.
const GUIDE_SECTION_ID = GUIDE.sections[0].id

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
  useOnboardingStore.setState({ status: 'awaitingApiKey' })
  // `ContentManage` 는 **수동 모드 전용**이라 자동 모드로 두면 열리자마자
  // 물러난다. 그러면 이 파일의 **열둘이 전부 열린다** 가 배선이 아니라 모드 때문에 빨개진다.
  useTrackingModeStore.setState({ mode: 'manual' })
})

describe('온보딩 분기', () => {
  it('미완료면 온보딩만 있고 탭은 그려지지 않는다', async () => {
    useOnboardingStore.setState({ status: 'awaitingApiKey' })

    await render(<NavigationHarness />)

    expect(screen.getByTestId('screen-Onboarding')).toBeTruthy()
    expect(screen.queryByTestId('screen-Today', { includeHiddenElements: true })).toBeNull()
  })

  it('완료면 탭이 그려지고 온보딩은 사라진다', async () => {
    useOnboardingStore.setState({ status: 'completed' })

    await render(<NavigationHarness />)

    expect(screen.getByTestId('screen-Today')).toBeTruthy()
    expect(screen.queryByTestId('screen-Onboarding', { includeHiddenElements: true })).toBeNull()
  })

  // **양방향이 요점이다.** 한 방향만 보면 "처음부터 완료였다"와 구분되지 않는다. 웹은 라우트마다
  // `<Navigate replace>` 를 걸어 이 전환을 만들었고, RN 은 화면 목록 자체를 갈아 끼운다
  // (`RootNavigator` 주석). 계약은 같으므로 여기서 같은 것을 묻는다.
  it('미완료 → 완료 → 미완료 로 오갈 때 화면이 따라 바뀐다', async () => {
    useOnboardingStore.setState({ status: 'awaitingApiKey' })
    await render(<NavigationHarness />)
    expect(screen.getByTestId('screen-Onboarding')).toBeTruthy()

    const setStatus = async (status: Status): Promise<void> => {
      await act(async () => {
        useOnboardingStore.setState({ status })
      })
    }

    await setStatus('completed')
    expect(screen.getByTestId('screen-Today')).toBeTruthy()
    expect(screen.queryByTestId('screen-Onboarding', { includeHiddenElements: true })).toBeNull()

    await setStatus('awaitingApiKey')
    expect(screen.getByTestId('screen-Onboarding')).toBeTruthy()
    expect(screen.queryByTestId('screen-Today', { includeHiddenElements: true })).toBeNull()
  })
})

describe('하위 페이지 — 열둘', () => {
  // **`guideId` 가 실재해야 한다**(step 3 에서 갈린 것). 자리표시자는 받은 문자열을 그냥 찍어
  // 아무 값이나 통했지만, 진짜 상세는 없는 id 면 조용히 pop 한다(옛 링크의
  // 착지점이 빈 화면이면 안 된다). 그래서 여기 값이 카탈로그와 어긋나면 이 테스트가 먼저 깨진다.
  const params: Partial<Record<(typeof STACK_ROUTE_NAMES)[number], object>> = {
    SettingsFeatureGuide: { guideId: GUIDE_ID },
    SettingsReleaseNoteGuide: { guideId: GUIDE_ID } }

  it.each(STACK_ROUTE_NAMES)('%s 로 push 하면 그 화면이 열린다', async (name) => {
    useOnboardingStore.setState({ status: 'completed' })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)

    await act(async () => {
      // 이름·파라미터 조합이 라우트마다 달라 여기서만 타입을 느슨하게 둔다. 목록을 손으로 적지
      // 않고 `STACK_ROUTE_NAMES` 를 도는 것이 이 테스트의 값이라(빠뜨림이 드러난다) 그 대가로 받는다.
      ;(navigationRef.navigate as (name: string, params?: object) => void)(name, params[name])
    })

    expect(screen.getByTestId(`screen-${name}`)).toBeTruthy()
  })

  //  이 세우고 가 일곱 곳으로 넓힌 계약 — 아래 화면이 살아 있어야
  // 전환 중에 보여줄 것이 있고, 펼침·기간·스크롤도 남는다. 네이티브 스택이 공짜로 주는 성질이지만
  // 공짜라고 검사하지 않으면 나중에 `presentation` 을 바꿨을 때 조용히 잃는다.
  //
  // `includeHiddenElements` 가 필요한 것이 오히려 증거다. 아래 화면은 **접근성에서만 가려졌고**
  // 트리에는 그대로 있다(언마운트됐다면 이 옵션으로도 안 나온다).
  it('하위 페이지가 열려도 아래 탭 화면이 남아 있다', async () => {
    useOnboardingStore.setState({ status: 'completed' })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)
    await act(async () => {
      navigationRef.navigate('ContentManage')
    })

    expect(screen.getByTestId('screen-ContentManage')).toBeTruthy()
    expect(screen.getByTestId('screen-Today', { includeHiddenElements: true })).toBeTruthy()
  })

  it('뒤로 가면 하위 페이지만 사라진다', async () => {
    useOnboardingStore.setState({ status: 'completed' })
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

// 앞엣것은 기능 설명 목록에서, 뒤엣것은 개발 노트에서 열리는 경로다.
//
// **자리표시자가 찍던 `guideId`·`section` 대신 실제로 그려진 글을 본다**(step 3). 자리표시자는
// 파라미터를 그대로 찍어 "같은 데이터가 실렸는가"를 물었는데, 진짜 상세가 들어온 뒤에는 그보다
// 강한 질문을 할 수 있다. **두 경로가 같은 안내의 본문을 그리는가.** 마디 파라미터가 하는 일
// (그 자리로 스크롤)은 레이아웃이 있어야 관측되므로 화면 자신의 테스트가 본다.
describe('안내 상세는 두 경로가 같은 화면을 그린다', () => {
  it.each(FEATURE_GUIDE_ROUTE_NAMES)('%s 로 열어도 같은 안내가 그려진다', async (routeName) => {
    useOnboardingStore.setState({ status: 'completed' })
    const navigationRef = createNavigationContainerRef<RootStackParamList>()

    await render(<NavigationHarness navigationRef={navigationRef} />)
    await act(async () => {
      navigationRef.navigate(routeName, { guideId: GUIDE_ID, section: GUIDE_SECTION_ID })
    })

    expect(screen.getByTestId(`screen-${routeName}`)).toBeTruthy()
    expect(screen.getAllByText(GUIDE.title).length).toBeGreaterThan(0)
    // 마디 제목이 그려진다는 것이 곧 **같은 데이터**라는 뜻이다. 두 경로가 다른 카탈로그를 읽고
    // 있었다면 여기서 갈린다.
    expect(screen.getAllByText(GUIDE.sections[0].title).length).toBeGreaterThan(0)
  })
})

