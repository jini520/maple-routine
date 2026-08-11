// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsAccountDataScreen } from '../SettingsAccountDataScreen'
import { useSettingsStore } from '@core/features/settings/store'
import { consumePendingNotice } from '@core/storage/pending-notice'
import { clearCacheData, getCacheDataSizes } from '@core/storage/cache-data'
import { closeBossProfitDb } from '@core/storage/sqlite/db'
import { showSplashScreen } from '@core/native/splash-screen'

vi.mock('@core/features/settings/store', () => ({
  useSettingsStore: vi.fn(),
}))

vi.mock('@core/storage/cache-data', () => ({
  clearCacheData: vi.fn(),
  getCacheDataSizes: vi.fn(async () => ({ general: 0, bossRecords: 0 })),
}))

vi.mock('@core/storage/sqlite/db', () => ({
  closeBossProfitDb: vi.fn(async () => {}),
}))

vi.mock('@core/native/splash-screen', () => ({
  showSplashScreen: vi.fn(async () => {}),
}))

const mockedUseSettingsStore = vi.mocked(useSettingsStore)
const mockedClear = vi.mocked(clearCacheData)
const mockedGetSizes = vi.mocked(getCacheDataSizes)

function mockSettingsStore(overrides: Partial<ReturnType<typeof useSettingsStore>> = {}): void {
  mockedUseSettingsStore.mockReturnValue({
    status: 'idle',
    accounts: [],
    error: null,
    prefetchProgress: null,
    pendingAccountId: null,
    changeApiKey: vi.fn(),
    refreshAccounts: vi.fn(),
    selectAccount: vi.fn(),
    commitAccountChange: vi.fn(),
    disconnect: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  })
}

function renderScreen(props: { reload?: () => void } = {}): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/settings/account-data']}>
      <Routes>
        <Route
          path="/settings/account-data"
          element={<SettingsAccountDataScreen reload={props.reload ?? vi.fn()} />}
        />
        <Route path="/settings" element={<div>설정 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// 행이 속한 카드 — `Card` atom 의 라운딩 토큰으로 잡는다(ADR-094 결정 3: `rounded-[14px]` 는
// 카드 하나에만 있는 값이라 카드 경계의 표식으로 쓸 수 있다).
function cardOf(row: HTMLElement): Element {
  const card = row.closest('[class~="rounded-[14px]"]')
  expect(card).not.toBeNull()
  return card as Element
}

// 삭제 버튼은 선택 용량을 함께 표기하므로("삭제 (1.5KB)") 앞부분으로 잡는다 — 행 버튼의
// 접근성 이름은 "캐시 데이터 삭제"라 ^ 앵커에 걸리지 않는다.
function openAndConfirm(): void {
  fireEvent.click(screen.getByRole('button', { name: /캐시 데이터 삭제/ }))
  fireEvent.click(screen.getByRole('button', { name: /^삭제/ }))
}

beforeEach(() => {
  mockSettingsStore()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  document.body.style.overflow = ''
})

describe('SettingsAccountDataScreen', () => {
  // 골격은 관리 페이지와 같다(ADR-118 결정 2) — PageHeader + ArrowLeft + useScreenNavigate.
  it('"계정 및 데이터" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 설정으로 돌아간다', () => {
    renderScreen()

    expect(screen.getByRole('heading', { name: '계정 및 데이터' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('설정 프로브')).toBeInTheDocument()
  })

  // ADR-118 결정 3: 이슈 #135 가 요구한 분리가 실제로 일어나는 자리다. 본화면에서 빼는 것만으로는
  // 분리가 아니다 — 옮긴 곳에서 다시 `계정 변경` 과 붙으면 같은 문제가 한 층 내려갈 뿐이다.
  it('파괴적 행 둘을 "계정 변경"과 다른 카드로 내린다', () => {
    renderScreen()

    const accountCard = cardOf(screen.getByRole('button', { name: /계정 변경/ }))
    const cacheCard = cardOf(screen.getByRole('button', { name: /캐시 데이터 삭제/ }))
    const disconnectCard = cardOf(screen.getByRole('button', { name: '연결 해제' }))

    expect(cacheCard).not.toBe(accountCard)
    expect(disconnectCard).toBe(cacheCard)
  })

  // ADR-118 결정 4: chevron 이 있으면 누르면 무언가 열리고, 없는 위험 색 행은 누르면 지운다.
  it('위험 색 행 둘에는 chevron 이 없다', () => {
    renderScreen()

    const cacheRow = screen.getByRole('button', { name: /캐시 데이터 삭제/ })
    const disconnectRow = screen.getByRole('button', { name: '연결 해제' })

    expect(within(cacheRow).queryByTestId('settings-row-chevron')).not.toBeInTheDocument()
    expect(within(disconnectRow).queryByTestId('settings-row-chevron')).not.toBeInTheDocument()
  })

  // ADR-118 결정 6: `accountId` 는 불투명 문자열이고 대표 캐릭터는 파생·변동값이라 단정할 수 없다.
  // 대표값 규칙은 "확실히 아는 값이 있으면 보여준다"이지 "칸을 채운다"가 아니다.
  it('"계정 변경" 행은 chevron 만 두고 우측 값을 두지 않는다', () => {
    renderScreen()

    const row = screen.getByRole('button', { name: /계정 변경/ })
    expect(within(row).getByTestId('settings-row-chevron')).toBeInTheDocument()
    expect(row).toHaveTextContent(/^계정 변경$/)
  })

  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다(ADR-058 결정 8).
  it('마운트 시 조회한 그룹별 용량의 합을 사람이 읽을 수 있는 단위로 보여준다', async () => {
    mockedGetSizes.mockResolvedValue({ general: 1024, bossRecords: 512 })
    renderScreen()

    expect(await screen.findByText('1.5KB')).toBeInTheDocument()
  })

  // ADR-061 결정 7: 조회 전에도 값과 같은 폭·타이포로 자리를 잡아 값이 들어와도 레이아웃이 밀리지 않는다.
  it('용량 조회 전에는 "- KB" 자리표시를 보여준다', async () => {
    let resolveSizes: (sizes: { general: number; bossRecords: number }) => void = () => {}
    mockedGetSizes.mockReturnValue(
      new Promise((resolve) => {
        resolveSizes = resolve
      }),
    )
    renderScreen()

    expect(screen.getByText('- KB')).toBeInTheDocument()

    resolveSizes({ general: 1024, bossRecords: 512 })
    expect(await screen.findByText('1.5KB')).toBeInTheDocument()
    expect(screen.queryByText('- KB')).not.toBeInTheDocument()
  })

  it('모달에서 고른 그룹을 clearCacheData에 그대로 넘긴다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    renderScreen({ reload })

    fireEvent.click(screen.getByRole('button', { name: /캐시 데이터 삭제/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /보스 수익·드롭 기록/ }))
    fireEvent.click(screen.getByRole('button', { name: /^삭제/ }))

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(mockedClear).toHaveBeenCalledWith({ general: true, bossRecords: false })
  })

  // ADR-065 결정 3: 실패를 더는 삼키지 않는다. 리로드가 화면 신호를 파괴하므로 플래그를 남기고
  // 부팅 후에 토스트로 알린다(App.tsx가 소비).
  it('삭제가 실패하면 플래그를 남기고 리로드는 그대로 진행한다', async () => {
    mockedClear.mockRejectedValue(new Error('native failed'))
    const reload = vi.fn()
    renderScreen({ reload })

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(consumePendingNotice()).toBe('cacheClearFailed')
  })

  it('삭제가 성공하면 플래그를 남기지 않는다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    renderScreen({ reload })

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(consumePendingNotice()).toBeNull()
  })

  // ADR-058 결정 7: 어떤 그룹을 골라도 리로드 흐름(ADR-050)은 동일하다 — 두 그룹 모두 화면
  // 스토어가 메모리에 들고 있는 상태를 무효화하므로 선택적 재수화 경로를 새로 만들지 않는다.
  it('일부 그룹만 삭제해도 리로드한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    renderScreen({ reload })

    fireEvent.click(screen.getByRole('button', { name: /캐시 데이터 삭제/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /일반 데이터/ }))
    fireEvent.click(screen.getByRole('button', { name: /^삭제/ }))

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(mockedClear).toHaveBeenCalledWith({ general: false, bossRecords: true })
  })

  // 오버레이가 호출부의 space-y-* 컨테이너 안에서 렌더되면 margin-block-end 때문에 fixed inset-0
  // 높이가 깎여 하단 제스처 영역만 딤이 빠진다(38c6ed7과 동일 기전, 실기기 스크린샷 확인).
  // 공용 Modal처럼 body로 포털 렌더링돼야 화면 끝까지 덮는다.
  it('확인 모달 오버레이는 body 직속으로 포털 렌더링된다', () => {
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /캐시 데이터 삭제/ }))

    const overlay = screen.getByTestId('cache-clear-confirm-overlay')
    expect(overlay.parentElement).toBe(document.body)
  })

  it('삭제가 성공하면 reload를 호출한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    renderScreen({ reload })

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(mockedClear).toHaveBeenCalledOnce()
  })

  it('리로드 직전에 스플래시를 띄워 리로드 동안 웹뷰 배경색이 드러나지 않게 한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    renderScreen({ reload })

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    const mockedShow = vi.mocked(showSplashScreen)
    expect(mockedShow).toHaveBeenCalled()
    // 스플래시가 reload보다 먼저 호출돼야 리로드 구간을 덮는다
    expect(mockedShow.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0])
  })

  // 리로드가 JS 컨텍스트를 파괴하기 전에 SQLite 커넥션을 먼저 정상 종료해야 한다 — 안 그러면
  // native/live-update.ts의 OTA 적용과 같은 이유로 네이티브 쪽에 stale 커넥션이 남아, 리로드 후
  // 보스 수익 과거 기간 조회가 실패한다(사용자 보고). 순서는 ADR-117 결정 8이 고쳤다.
  it('reload하기 전에 SQLite 커넥션을 먼저 정상 종료한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    renderScreen({ reload })

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    const mockedClose = vi.mocked(closeBossProfitDb)
    expect(mockedClose).toHaveBeenCalled()
    expect(mockedClose.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0])
  })

  it('삭제가 실패(reject)해도 "삭제 중..."에 갇히지 않고 reload한다', async () => {
    mockedClear.mockRejectedValue(new Error('sqlite fail'))
    const reload = vi.fn()
    renderScreen({ reload })

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('삭제가 끝나지 않으면(hang) 타임아웃 후 reload한다', async () => {
    vi.useFakeTimers()
    mockedClear.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함
    const reload = vi.fn()
    renderScreen({ reload })

    openAndConfirm()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(reload).toHaveBeenCalled()
  })

  // 이 화면은 모달을 여는 자리만 옮긴다 — 계정 변경 흐름 자체는 그대로다(ADR-086 결정 6).
  it('"계정 변경" 클릭 시 계정 모달이 열리고 refreshAccounts가 호출된다', () => {
    const refreshAccounts = vi.fn()
    mockSettingsStore({ refreshAccounts })
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /계정 변경/ }))

    expect(refreshAccounts).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('account-modal-overlay')).toBeInTheDocument()
  })

  it('"연결 해제" 클릭 시 확인 모달이 열리고, 확인 클릭 시 disconnect가 호출된다', () => {
    const disconnect = vi.fn()
    mockSettingsStore({ disconnect })
    renderScreen()

    expect(screen.queryByText('연결을 해제할까요?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '연결 해제' }))

    expect(screen.getByText('연결을 해제할까요?')).toBeInTheDocument()

    const overlay = screen.getByTestId('disconnect-confirm-overlay')
    fireEvent.click(within(overlay).getByRole('button', { name: '연결 해제' }))

    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
