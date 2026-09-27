// 이 화면이 지키는 것을 적는다.
//
// 갈린 것 넷
// ① **라우터 프로브가 없다**. 뒤로는 `goBack` 이 불렸는가로 본다.
// ② **확인 모달 오버레이가 body 직속으로 포털 렌더링된다는 것은 옮길 계약이 아니다.**
//    그것이 필요했던 이유(`fixed inset-0` 높이가 호출부 마진에 깎여 하단 딤이 빠진다)가 RN 에
//    없다. `Modal` 이 **별도 네이티브 윈도우**라 갇힐 상자가 없다(`Modal.tsx`).
// ③ 카드 경계는 `Card` atom 의 라운딩 대신 **트리 상의 조상 관계**로 본다.
// ④ 삭제 뒤 흐름(타임아웃 경쟁 → `closeBossProfitDb` → 스플래시 → 리로드)은 **core 의
//    `clearCacheDataAndReload` 가 소유한다**. 여기서는 **화면이 무엇을 넘기고 무엇을 받는가**만
//    본다. 순서 자체는 `storage/__tests__/cache-data.spec.ts` 가 지킨다.
//
// ⑤ **계정 변경 케이스 셋은 갱신이 아니라 삭제됐다**. 그 행이 없어졌으므로
//    **어떻게 생겼는가**·**누르면 무엇이 열리는가** 는 물을 대상이 없다. 남는 계약(**그 행이 없다**)은
//    아래 카드 케이스가 진다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { clearCacheDataAndReload, loadCacheDataSizes } from '../../../features/settings/cache-data'
import { useSettingsStore } from '../../../features/settings/store'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsAccountDataScreen } from '../SettingsAccountDataScreen'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'

jest.mock('../../../features/settings/store', () => ({ useSettingsStore: jest.fn() }))
jest.mock('../../../features/settings/cache-data', () => ({
  loadCacheDataSizes: jest.fn(),
  clearCacheDataAndReload: jest.fn(async () => {}),
}))
jest.mock('../../../hooks/useSettingsNavigation', () => ({ useSettingsNavigation: jest.fn() }))
// 로그아웃 행은 로그인이 있을 때만 선다. 화면은 `features/` 를 거치고 저장소는 그 아래가 맡는다.
jest.mock('../../../features/auth/saved-key', () => ({ hasNexonLogin: jest.fn() }))
jest.mock('../../../features/auth/store', () => {
  const signOutNexonLogin = jest.fn()
  return { useAuthStore: (selector: (s: unknown) => unknown) => selector({ signOutNexonLogin }) }
})
const { hasNexonLogin: mockedHasNexonLogin } = jest.requireMock('../../../features/auth/saved-key') as Record<string, jest.Mock>
const mockedStore = jest.mocked(useSettingsStore)
const mockedLoadSizes = jest.mocked(loadCacheDataSizes)
const mockedClearAndReload = jest.mocked(clearCacheDataAndReload)
const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
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
  mockSettingsStore()
  mockedUseSettingsNavigation.mockReturnValue({
    navigate: jest.fn(),
    goBack,
  } as unknown as ReturnType<typeof useSettingsNavigation>)
  mockedLoadSizes.mockReturnValue(new Promise(() => {}))
  // 기본은 로그인 없음. 행이 서는 케이스만 따로 세운다.
  mockedHasNexonLogin.mockResolvedValue(false)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsAccountDataScreen', () => {
  it('"계정 및 데이터" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 pop 한다', async () => {
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    expect(view.getByText('계정 및 데이터')).toBeTruthy()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })

  // 이 앱에는 `계정 변경`이 없다. 계정을 바꾸는 일이 `캐릭터 관리`의
  // 드롭다운 안으로 들어갔다. 이 요구한 **파괴적 행을 계정 변경과
  // 다른 카드로** 는 그 짝이 없어져 저절로 성립하므로, 여기서는 **그 행이 정말 없는지**와 남은
  // 위험 색 행 둘이 한 카드에 함께 있는지를 본다.
  it('`계정 변경` 행을 두지 않고, 위험 색 행 둘만 한 카드에 남는다', async () => {
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    expect(view.queryByText('계정 변경')).toBeNull()
    expect(view.getAllByTestId('settings-card')).toHaveLength(1)
    expect(cardOf(view, '연결 해제')).toBe(cardOf(view, '캐시 데이터 삭제'))
  })

  // chevron 이 있으면 누르면 무언가 열리고, 없는 위험 색 행은 누르면 지운다.
  it('위험 색 행 둘에는 chevron 이 없다', async () => {
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    expect(hasChevron(rowOf(view, '캐시 데이터 삭제'))).toBe(false)
    expect(hasChevron(rowOf(view, '연결 해제'))).toBe(false)
  })

  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다.
  it('마운트 시 조회한 그룹별 용량의 합을 사람이 읽을 수 있는 단위로 보여준다', async () => {
    mockedLoadSizes.mockResolvedValue({ general: 1024, records: 512 })
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    expect(await view.findByText('1.5KB')).toBeTruthy()
  })

  // 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다.
  it('용량 조회 전에는 "- KB" 자리표시를 보여준다', async () => {
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    expect(view.getByText('- KB')).toBeTruthy()
  })

  // **범위는 이 화면이 정하지 않는다**. 고른 두 불리언을 그대로 넘기고,
  // 어떤 키·테이블이 지워지는지는 core 의 `storage/cache-data` 가 혼자 정한다.
  it('모달에서 고른 그룹을 그대로 core 로 넘긴다', async () => {
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    await press(rowOf(view, '캐시 데이터 삭제'))
    await press(view.getByLabelText('수익·지출 기록'))
    await press(view.getByText(/^삭제/))

    expect(mockedClearAndReload).toHaveBeenCalledTimes(1)
    expect(mockedClearAndReload.mock.calls[0][0]).toEqual({ general: true, records: false })
  })

  // 기본이 전체 선택이라 열고 바로 삭제하면 기존 전체 삭제와 같다.
  it('열고 바로 삭제하면 두 그룹 모두 넘어간다', async () => {
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    await press(rowOf(view, '캐시 데이터 삭제'))
    await press(view.getByText(/^삭제/))

    expect(mockedClearAndReload.mock.calls[0][0]).toEqual({ general: true, records: true })
  })

  // 리로드 실행부는 **주입 가능**하다. 기본값은 지금 도는 번들의 재실행이다.
  it('리로드 실행부를 프롭으로 받아 core 에 넘긴다', async () => {
    const reload = jest.fn()
    const view = await renderOverlay(<SettingsAccountDataScreen reload={reload} />)

    await press(rowOf(view, '캐시 데이터 삭제'))
    await press(view.getByText(/^삭제/))

    expect(mockedClearAndReload.mock.calls[0][1]).toBe(reload)
  })

  // 라벨이 가려진 채 자리를 지키고 스피너가 그 위에 겹친다.
  it('삭제 중에는 삭제 버튼이 대기 상태가 된다', async () => {
    mockedClearAndReload.mockReturnValue(new Promise(() => {}))
    const view = await renderOverlay(<SettingsAccountDataScreen />)

    await press(rowOf(view, '캐시 데이터 삭제'))
    await press(view.getByText(/^삭제/))

    expect(view.getByTestId('button-busy', { includeHiddenElements: true })).toBeTruthy()
  })

  it('"연결 해제"를 누르면 확인 모달이 열리고, 확인 시 disconnect가 호출된다', async () => {
    const disconnect = jest.fn()
    mockSettingsStore({ disconnect })
    const view = await renderOverlay(<SettingsAccountDataScreen />)

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
  const { useAuthStore } = jest.requireMock('../../../features/auth/store') as {
    useAuthStore: (s: (v: { signOutNexonLogin: jest.Mock }) => unknown) => unknown
  }
  return useAuthStore((state) => state.signOutNexonLogin) as jest.Mock
}

describe('넥슨 로그아웃 행', () => {
  it('로그인이 있으면 선다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)

    const view = await renderOverlay(<SettingsAccountDataScreen />)

    await waitFor(() => expect(view.getByText('넥슨 로그아웃')).toBeTruthy())
  })

  it('로그인이 없으면 안 선다. 뗄 것이 없다', async () => {
    mockedHasNexonLogin.mockResolvedValue(false)

    const view = await renderOverlay(<SettingsAccountDataScreen />)

    await waitFor(() => expect(mockedHasNexonLogin).toHaveBeenCalled())
    expect(view.queryByText('넥슨 로그아웃')).toBeNull()
  })

  it('판정 전에는 안 세운다', async () => {
    mockedHasNexonLogin.mockReturnValue(new Promise(() => {}))

    const view = await renderOverlay(<SettingsAccountDataScreen />)

    expect(view.queryByText('넥슨 로그아웃')).toBeNull()
  })

  // 확인을 한 번 받는다. 다시 로그인하는 것이 창을 열고 넥슨을 거치는 일이라 실수로 눌렀을 때
  // 치르는 값이 작지 않다.
  it('누르면 바로 안 뗀다. 확인을 먼저 받는다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)
    const signOut = 로그아웃액션()

    const view = await renderOverlay(<SettingsAccountDataScreen />)
    await waitFor(() => view.getByText('넥슨 로그아웃'))
    await press(rowOf(view, '넥슨 로그아웃'))

    expect(view.getByText('로그아웃할까요?')).toBeTruthy()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('확인을 누르면 뗀다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)
    const signOut = 로그아웃액션()

    const view = await renderOverlay(<SettingsAccountDataScreen />)
    await waitFor(() => view.getByText('넥슨 로그아웃'))
    await press(rowOf(view, '넥슨 로그아웃'))
    await press(view.getByText('로그아웃'))

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('취소하면 아무 일도 안 일어나고 모달이 닫힌다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)
    const signOut = 로그아웃액션()

    const view = await renderOverlay(<SettingsAccountDataScreen />)
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

    const view = await renderOverlay(<SettingsAccountDataScreen />)
    await waitFor(() => view.getByText('넥슨 로그아웃'))
    await press(rowOf(view, '넥슨 로그아웃'))

    expect(view.queryByText('연결을 해제할까요?')).toBeNull()
  })
})
