// 알림 탭이 공지 상세로 가는 길.
//
// **이 파일이 지키는 것은 타이밍 하나다.** 상세 화면은 `stage === 'ready'` 일 때만 루트 스택에
// 등록된다(`RootNavigator`). 그런데 죽어 있던 앱을 알림으로 열면 `getInitialNotification` 이
// 진입 단계 판정보다 먼저 답할 수 있고, 그러면 아직 없는 화면으로 이동을 걸어
// `The action 'NAVIGATE' ... was not handled by any navigator` 가 뜬다(실기기 관측, iOS).
//
// 그래서 이동을 **붙들었다가** 스택이 그 화면을 든 뒤에 민다.
//
// `act` 규칙은 `RootNavigator.test.tsx` 머리말과 같다. 렌더 전 준비는 그냥 `setState`,
// 렌더 뒤 갱신은 `await act(async …)`.
jest.mock('../../server/notices', () => ({
  __esModule: true,
  fetchNotices: jest.fn(async () => []),
  fetchNotice: jest.fn(async () => null),
}))

import { act, render, screen } from '@testing-library/react-native'
import { PortalProvider } from '@gorhom/portal'
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context'

import { useAppEntryStore } from '../../features/app-entry/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { installNoopNativePorts } from '../../native/__tests__/fake-native-ports'
import { setPushPort } from '../../native/ports'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { AppNavigation } from '../AppNavigation'
import { installMemoryPreferences } from './memory-preferences'

const TEST_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
}

/** 실제 트리와 같은 순서(`App.tsx`). `AppNavigation` 이 컨테이너를 자기가 만든다. */
function Harness(): React.JSX.Element {
  return (
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <ThemeProvider>
        <PortalProvider shouldAddRootHost={false}>
          <AppNavigation />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const 공지푸시 = {
  noticeId: 'notice-20260907-214405',
  title: '9월 정기 점검 안내',
  body: '9월 10일 오전 2시부터 4시까지 서버 점검이 진행됩니다.',
  publishedAt: '2026-09-07T12:44:05.000Z',
}

/** 죽어 있던 앱을 이 푸시로 열었다고 둔다. 마운트당 한 번만 답하는 API 다. */
function 알림으로_열렸다(data: Record<string, string> | null): void {
  let answered = false
  setPushPort({
    subscribe: async () => {},
    unsubscribe: async () => {},
    addMessageListener: () => () => {},
    addOpenedListener: () => () => {},
    getInitialNotification: async () => {
      if (answered) return null
      answered = true
      return data
    },
  })
}

beforeEach(() => {
  installMemoryPreferences()
  installNoopNativePorts()
  useTrackingModeStore.setState({ mode: 'manual' })
  useAppEntryStore.setState({ stage: 'signIn' })
})

async function 단계를_옮긴다(stage: 'signIn' | 'characterSetup' | 'ready'): Promise<void> {
  await act(async () => {
    useAppEntryStore.setState({ stage })
  })
}

describe('알림 탭이 여는 공지 상세', () => {
  // 실기기에서 난 그 에러가 이 자리다. 로그인 화면만 서 있는 스택에 상세로 이동을 걸었다.
  it('스택이 아직 그 화면을 안 들었으면 이동을 붙든다', async () => {
    알림으로_열렸다(공지푸시)

    await render(<Harness />)

    expect(screen.getByTestId('screen-SignIn')).toBeTruthy()
    expect(screen.queryByTestId('screen-SettingsNoticeDetail')).toBeNull()
  })

  it('앱이 열리면 붙들었던 이동을 그때 민다', async () => {
    알림으로_열렸다(공지푸시)
    await render(<Harness />)

    await 단계를_옮긴다('ready')

    expect(screen.getByTestId('screen-SettingsNoticeDetail')).toBeTruthy()
  })

  it('이미 열려 있으면 그대로 민다', async () => {
    알림으로_열렸다(공지푸시)
    useAppEntryStore.setState({ stage: 'ready' })

    await render(<Harness />)
    // 컨테이너가 준비됐다고 알리는 것은 렌더 뒤라 한 박자를 흘려보낸다.
    await act(async () => {})

    expect(screen.getByTestId('screen-SettingsNoticeDetail')).toBeTruthy()
  })

  // 한 번 민 것을 안 지우면, 나중에 로그아웃했다 다시 열 때 그 상세가 또 튀어나온다.
  it('한 번 민 뒤에는 다시 안 민다', async () => {
    알림으로_열렸다(공지푸시)
    await render(<Harness />)
    await 단계를_옮긴다('ready')
    expect(screen.getByTestId('screen-SettingsNoticeDetail')).toBeTruthy()

    await 단계를_옮긴다('signIn')
    await 단계를_옮긴다('ready')

    expect(screen.queryByTestId('screen-SettingsNoticeDetail')).toBeNull()
  })

  it('알림으로 연 것이 아니면 아무 데도 안 민다', async () => {
    알림으로_열렸다(null)
    useAppEntryStore.setState({ stage: 'ready' })

    await render(<Harness />)
    await act(async () => {})

    expect(screen.queryByTestId('screen-SettingsNoticeDetail')).toBeNull()
    expect(screen.getByTestId('screen-Today')).toBeTruthy()
  })
})
