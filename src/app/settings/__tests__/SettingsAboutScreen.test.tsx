// 이 화면이 지키는 것을 적는다.
//
// ① 라우터 프로브가 없다. 뒤로·이동은 `goBack`/`navigate` 가 무엇으로 불렸는가로 본다.
// ② `getByRole('heading')` 이 없다. RN 에 heading 역할이 없어 제목 글자로 본다. `제목이 하나뿐`
//    케이스도 그래서 `업데이트 카드가 자기 제목을 그리지 않는다` 로만 남는다.
// ③ OTA 상태는 포트를 갈아끼우는 것으로 만든다. 문구 열넷의 계약은 `AppUpdateSection` 테스트가
//    프롭을 직접 넣어 지킨다. 여기서 보는 것은 배선이다.
// ④ 카드 경계는 `Card` atom 의 라운딩 대신 **트리 상의 조상 관계**로 본다.
// ⑤ 삭제 뒤 흐름(타임아웃 경쟁 → `closeBossProfitDb` → 스플래시 → 리로드)은 **core 의
//    `clearCacheDataAndReload` 가 소유한다**. 여기서는 **화면이 무엇을 넘기고 무엇을 받는가**만
//    본다. 순서 자체는 `storage/__tests__/cache-data.spec.ts` 가 지킨다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { clearCacheDataAndReload, loadCacheDataCounts } from '../../../features/settings/cache-data'
import { useSettingsStore } from '../../../features/settings/store'

import { useLiveUpdateStore } from '../../../features/live-update/store'
import { openInAppBrowser } from '../../../native/browser'
import { setLiveUpdatePort, type LiveUpdatePort } from '../../../native/ports'

import packageJson from '../../../../package.json'
import { formatAppVersion } from '../../../lib/app-version'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { PRIVACY_URL, SettingsAboutScreen } from '../SettingsAboutScreen'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'

/**
 * 이 화면이 마운트에서 `loadCurrentVersion` 을 부르므로 포트가 있어야 한다(배선).
 *
 * `isSupported` 를 케이스별로 갈라 지원되지 않는 환경 과 도는 번들이 있는 환경 을 둘 다
 * 만든다. 그 갈림이 곧 카드가 확인 버튼을 그리는지의 근거다.
 */
function installLiveUpdatePort(overrides: Partial<LiveUpdatePort> = {}): void {
  setLiveUpdatePort({
    isSupported: () => true,
    notifyAppReady: async () => {},
    getCurrentVersion: async () => '1.0.6',
    getChannel: () => 'production',
    check: async () => ({ kind: 'up-to-date' }),
    download: async () => {},
    apply: async () => {},
    getNetworkType: async () => 'unknown',
    openStore: () => {},
    ...overrides,
  })
}

jest.mock('../../../hooks/useSettingsNavigation', () => ({ useSettingsNavigation: jest.fn() }))
jest.mock('../../../native/browser', () => ({ openInAppBrowser: jest.fn() }))
jest.mock('../../../features/settings/store', () => ({ useSettingsStore: jest.fn() }))
jest.mock('../../../features/settings/cache-data', () => ({
  loadCacheDataCounts: jest.fn(),
  clearCacheDataAndReload: jest.fn(async () => {}),
}))
// 로그아웃 행은 로그인이 있을 때만 선다. 화면은 `features/` 를 거치고 저장소는 그 아래가 맡는다.
jest.mock('../../../features/auth/saved-key', () => ({ hasNexonLogin: jest.fn() }))
jest.mock('../../../features/auth/store', () => {
  const signOutNexonLogin = jest.fn()
  return { useAuthStore: (selector: (s: unknown) => unknown) => selector({ signOutNexonLogin }) }
})
const { hasNexonLogin: mockedHasNexonLogin } = jest.requireMock('../../../features/auth/saved-key') as Record<string, jest.Mock>
const mockedStore = jest.mocked(useSettingsStore)
const mockedLoadCounts = jest.mocked(loadCacheDataCounts)
const mockedClearAndReload = jest.mocked(clearCacheDataAndReload)

const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const navigate = jest.fn()
const goBack = jest.fn()

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function rowOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`행을 찾지 못했다: ${label}`)
  return node
}

/** 그 행이 속한 카드. `Card` atom 이 심는 testID 가 없어 조상 관계로 가른다. */
function cardOf(view: Rendered, label: string): AtomElement {
  const cards = view.getAllByTestId('settings-card')
  const row = rowOf(view, label)
  for (const card of cards) {
    let node: AtomElement | null = row
    while (node !== null && node !== card) node = node.parent
    if (node === card) return card
  }
  throw new Error(`카드를 찾지 못했다: ${label}`)
}

function hasChevron(node: AtomElement): boolean {
  if (node.props.testID === 'settings-row-chevron') return true
  return node.children.some((child) => typeof child !== 'string' && hasChevron(child))
}

function mockSettingsStore(overrides: Partial<ReturnType<typeof useSettingsStore>> = {}): void {
  mockedStore.mockReturnValue({
    status: 'idle',
    accounts: [],
    error: null,
    prefetchProgress: null,
    pendingAccountId: null,
    changeApiKey: jest.fn(),
    refreshAccounts: jest.fn(),
    selectAccount: jest.fn(),
    commitAccountChange: jest.fn(),
    disconnect: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  })
}


beforeEach(() => {
  mockedUseSettingsNavigation.mockReturnValue({ navigate, goBack } as unknown as ReturnType<
    typeof useSettingsNavigation
  >)
  installLiveUpdatePort()
  mockSettingsStore()
  mockedLoadCounts.mockReturnValue(new Promise(() => {}))
  // 기본은 로그인 없음. 행이 서는 케이스만 따로 세운다.
  mockedHasNexonLogin.mockResolvedValue(false)
  // 스토어는 모듈 싱글턴이라 케이스 사이에 상태가 샌다.
  useLiveUpdateStore.setState({ currentVersion: null, status: 'idle', channel: '' })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsAboutScreen', () => {
  // 골격은 관리 페이지와 같다. `ScreenScroll` + `PageHeader` + `ArrowLeft`.
  it('"앱 정보 및 계정" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 pop 한다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText('앱 정보 및 계정')).toBeTruthy()
    expect(view.getByTestId('page-header')).toBeTruthy()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })

  // `LiveUpdatePort` 가 던져 확인 경로가 없다. **없는 것을 있는 척하지 않는
  // 것이 이 화면의 계약**이라 확인 버튼도 함께 사라진다.
  // 런타임이 없는 환경(개발 서버)에서는 확인 버튼 자체가 없어야 한다. 누를 수 없는 것을 그리면
  // 눌러 보고 아무 일도 안 일어나는 자리가 된다.
  it('런타임이 없으면 미지원 상태이고 확인 버튼이 없다', async () => {
    installLiveUpdatePort({ isSupported: () => false })

    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText('이 플랫폼에서는 지원되지 않습니다')).toBeTruthy()
    expect(view.queryByText('업데이트 확인')).toBeNull()
  })

  //  배선의 요점. 화면이 **실행 중인 번들 버전**을 묻고 그리는가. 이것이 이
  // 말한 **반영의 증거** 이고, 빌드 시점 값만 그리면 OTA 가 적용됐는지 화면으로 알 방법이 없다.
  it('실행 중인 번들 버전을 싣고 그린다(빌드 시점 값이 아니다)', async () => {
    installLiveUpdatePort({ getCurrentVersion: async () => '9.9.9' })

    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText('9.9.9')).toBeTruthy()
  })

  // 아직 싣기 전 첫 렌더에는 값이 없다. 그때는 빌드 시점 값이 폴백이다(`SettingsScreen` 과 같은 자리).
  it('버전을 싣기 전에는 빌드 시점 package.json 버전을 쓴다', async () => {
    installLiveUpdatePort({ isSupported: () => false })

    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText(formatAppVersion(packageJson.version))).toBeTruthy()
  })

  // 사본을 두지 않고 사이트 원본을 인앱 브라우저로 연다. 앱을 떠나지 않으므로 외부 링크 행이 아니다.
  it('개인정보 처리방침 행이 사이트를 인앱 브라우저로 연다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    // 외부 링크 행이면 chevron 이 아니라 외부 링크 아이콘이 선다. 그 표식이 없어야 한다.
    expect(view.queryByTestId('settings-row-external')).toBeNull()

    await press(rowOf(view, '개인정보 처리방침'))

    expect(openInAppBrowser).toHaveBeenCalledWith(PRIVACY_URL)
    expect(navigate).not.toHaveBeenCalled()
  })

  // 계정 행이 정보 행 아래에 있어 묶음 제목이 없으면 끝까지 읽어야 계정 행이 있다는 것을 안다.
  it('묶음 제목 `앱 정보` 아래에 정보 행이, `계정` 아래에 계정 행이 선다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    const order = view
      .getAllByText(/^(앱 정보|개인정보 처리방침|계정|데이터 삭제|연결 해제)$/)
      .map((node) => node.props.children as string)
    expect(order).toEqual(['앱 정보', '개인정보 처리방침', '계정', '데이터 삭제', '연결 해제'])
  })
})

describe('계정 묶음', () => {
  // 이 앱에는 `계정 변경`이 없다. 계정을 바꾸는 일이 `캐릭터 관리`의
  // 드롭다운 안으로 들어갔다. 이 요구한 **파괴적 행을 계정 변경과
  // 다른 카드로** 는 그 짝이 없어져 저절로 성립하므로, 여기서는 **그 행이 정말 없는지**와 남은
  // 위험 색 행 둘이 한 카드에 함께 있는지를 본다.
  it('`계정 변경` 행을 두지 않고, 위험 색 행 둘만 한 카드에 남는다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.queryByText('계정 변경')).toBeNull()
    expect(view.getAllByTestId('settings-card')).toHaveLength(1)
    expect(cardOf(view, '연결 해제')).toBe(cardOf(view, '데이터 삭제'))
  })

  // chevron 이 있으면 누르면 무언가 열리고, 없는 위험 색 행은 누르면 지운다.
  it('위험 색 행 둘에는 chevron 이 없다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(hasChevron(rowOf(view, '데이터 삭제'))).toBe(false)
    expect(hasChevron(rowOf(view, '연결 해제'))).toBe(false)
  })

  // **범위는 이 화면이 정하지 않는다**. 그룹마다 고른 여부를 그대로 넘기고,
  // 어떤 키·테이블이 지워지는지는 core 의 `storage/cache-data` 가 혼자 정한다.
  it('모달에서 고른 그룹을 그대로 core 로 넘긴다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    await press(rowOf(view, '데이터 삭제'))
    await press(view.getByLabelText('가계부'))
    await press(view.getByText(/^삭제/))

    expect(mockedClearAndReload).toHaveBeenCalledTimes(1)
    expect(mockedClearAndReload.mock.calls[0][0]).toEqual({
      manual: false,
      boss: false,
      cashbook: true,
      enhancement: false,
      cache: false,
    })
  })

  // 리로드 실행부는 **주입 가능**하다. 기본값은 지금 도는 번들의 재실행이다.
  it('리로드 실행부를 프롭으로 받아 core 에 넘긴다', async () => {
    const reload = jest.fn()
    const view = await renderOverlay(<SettingsAboutScreen reload={reload} />)

    await press(rowOf(view, '데이터 삭제'))
    await press(view.getByLabelText('가계부'))
    await press(view.getByText(/^삭제/))

    expect(mockedClearAndReload.mock.calls[0][1]).toBe(reload)
  })

  // 라벨이 가려진 채 자리를 지키고 스피너가 그 위에 겹친다.
  it('삭제 중에는 삭제 버튼이 대기 상태가 된다', async () => {
    mockedClearAndReload.mockReturnValue(new Promise(() => {}))
    const view = await renderOverlay(<SettingsAboutScreen />)

    await press(rowOf(view, '데이터 삭제'))
    await press(view.getByLabelText('가계부'))
    await press(view.getByText(/^삭제/))

    expect(view.getByTestId('button-busy', { includeHiddenElements: true })).toBeTruthy()
  })

  it('"연결 해제"를 누르면 확인 모달이 열리고, 확인 시 disconnect가 호출된다', async () => {
    const disconnect = jest.fn()
    mockSettingsStore({ disconnect })
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.queryByText('연결을 해제할까요?')).toBeNull()

    await press(rowOf(view, '연결 해제'))
    expect(view.getByText('연결을 해제할까요?')).toBeTruthy()

    // 확인 모달 안의 `연결 해제`. 행과 이름이 같아 오버레이 안쪽에서 고른다.
    const overlay = view.getByTestId('disconnect-confirm-overlay')
    const buttons = view
      .getAllByText('연결 해제')
      .map((node) => {
        let current: AtomElement | null = node
        while (current !== null && current.props.role !== 'button') current = current.parent
        return current
      })
      .filter((node): node is AtomElement => {
        let current: AtomElement | null = node
        while (current !== null && current !== overlay) current = current.parent
        return current === overlay
      })

    await press(buttons[buttons.length - 1])

    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})

// 로그아웃은 연결 해제와 다르다. 지우는 것은 넥슨 로그인 하나이고 API 키와 내부 데이터는 남는다.
/** 스토어가 내주는 로그아웃 액션. 모킹이 셀렉터라 꺼내 쓰는 길이 한 줄이 아니다. */
function 로그아웃액션(): jest.Mock {
  const { useAuthStore: authStoreMock } = jest.requireMock('../../../features/auth/store') as {
    useAuthStore: (s: (v: { signOutNexonLogin: jest.Mock }) => unknown) => unknown
  }
  return authStoreMock((state) => state.signOutNexonLogin) as jest.Mock
}

describe('넥슨 로그아웃 행', () => {
  it('로그인이 있으면 선다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)

    const view = await renderOverlay(<SettingsAboutScreen />)

    await waitFor(() => expect(view.getByText('넥슨 로그아웃')).toBeTruthy())
  })

  it('로그인이 없으면 안 선다. 뗄 것이 없다', async () => {
    mockedHasNexonLogin.mockResolvedValue(false)

    const view = await renderOverlay(<SettingsAboutScreen />)

    await waitFor(() => expect(mockedHasNexonLogin).toHaveBeenCalled())
    expect(view.queryByText('넥슨 로그아웃')).toBeNull()
  })

  it('판정 전에는 안 세운다', async () => {
    mockedHasNexonLogin.mockReturnValue(new Promise(() => {}))

    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.queryByText('넥슨 로그아웃')).toBeNull()
  })

  // 확인을 한 번 받는다. 다시 로그인하는 것이 창을 열고 넥슨을 거치는 일이라 실수로 눌렀을 때
  // 치르는 값이 작지 않다.
  it('누르면 바로 안 뗀다. 확인을 먼저 받는다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)
    const signOut = 로그아웃액션()

    const view = await renderOverlay(<SettingsAboutScreen />)
    await waitFor(() => view.getByText('넥슨 로그아웃'))
    await press(rowOf(view, '넥슨 로그아웃'))

    expect(view.getByText('로그아웃할까요?')).toBeTruthy()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('확인을 누르면 뗀다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)
    const signOut = 로그아웃액션()

    const view = await renderOverlay(<SettingsAboutScreen />)
    await waitFor(() => view.getByText('넥슨 로그아웃'))
    await press(rowOf(view, '넥슨 로그아웃'))
    await press(view.getByText('로그아웃'))

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('취소하면 아무 일도 안 일어나고 모달이 닫힌다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)
    const signOut = 로그아웃액션()

    const view = await renderOverlay(<SettingsAboutScreen />)
    await waitFor(() => view.getByText('넥슨 로그아웃'))
    await press(rowOf(view, '넥슨 로그아웃'))
    await press(view.getByText('취소'))

    expect(signOut).not.toHaveBeenCalled()
    expect(view.queryByText('로그아웃할까요?')).toBeNull()
  })

  it('연결 해제 모달과 다른 문구다', async () => {
    // 두 행이 같은 화면에 있어 문구가 같으면 무엇을 누른 건지 모른다.
    mockedHasNexonLogin.mockResolvedValue(true)
    로그아웃액션()

    const view = await renderOverlay(<SettingsAboutScreen />)
    await waitFor(() => view.getByText('넥슨 로그아웃'))
    await press(rowOf(view, '넥슨 로그아웃'))

    expect(view.queryByText('연결을 해제할까요?')).toBeNull()
  })
})
