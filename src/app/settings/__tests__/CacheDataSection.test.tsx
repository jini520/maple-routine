// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CacheDataSection } from '../CacheDataSection'
import { clearCacheData, getCacheDataSize } from '../../../storage/cache-data'
import { closeBossProfitDb } from '../../../storage/sqlite/db'
import { showSplashScreen } from '../../../native/splash-screen'

vi.mock('../../../storage/cache-data', () => ({
  clearCacheData: vi.fn(),
  getCacheDataSize: vi.fn(async () => 0),
}))

vi.mock('../../../storage/sqlite/db', () => ({
  closeBossProfitDb: vi.fn(async () => {}),
}))

vi.mock('../../../native/splash-screen', () => ({
  showSplashScreen: vi.fn(async () => {}),
}))

const mockedClear = vi.mocked(clearCacheData)
const mockedGetSize = vi.mocked(getCacheDataSize)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  document.body.style.overflow = ''
})

function openAndConfirm(): void {
  fireEvent.click(screen.getByRole('button', { name: /캐시 데이터 삭제/ }))
  fireEvent.click(screen.getByRole('button', { name: '삭제' }))
}

describe('CacheDataSection', () => {
  it('마운트 시 조회한 용량을 사람이 읽을 수 있는 단위로 보여준다', async () => {
    mockedGetSize.mockResolvedValue(1536)
    render(<CacheDataSection reload={vi.fn()} />)

    expect(await screen.findByText('1.5KB')).toBeInTheDocument()
  })

  // 오버레이가 호출부(SettingsScreen의 space-y-* 컨테이너) 안에서 렌더되면 margin-block-end 때문에
  // fixed inset-0 높이가 깎여 하단 제스처 영역만 딤이 빠진다(38c6ed7과 동일 기전, 실기기 스크린샷 확인).
  // 공용 Modal처럼 body로 포털 렌더링돼야 화면 끝까지 덮는다.
  it('확인 모달 오버레이는 body 직속으로 포털 렌더링된다', () => {
    render(<CacheDataSection reload={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /캐시 데이터 삭제/ }))

    const overlay = screen.getByTestId('cache-clear-confirm-overlay')
    expect(overlay.parentElement).toBe(document.body)
  })

  it('삭제가 성공하면 reload를 호출한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    render(<CacheDataSection reload={reload} />)

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(mockedClear).toHaveBeenCalledOnce()
  })

  it('리로드 직전에 스플래시를 띄워 리로드 동안 웹뷰 배경색이 드러나지 않게 한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    render(<CacheDataSection reload={reload} />)

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    const mockedShow = vi.mocked(showSplashScreen)
    expect(mockedShow).toHaveBeenCalled()
    // 스플래시가 reload보다 먼저 호출돼야 리로드 구간을 덮는다
    expect(mockedShow.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0])
  })

  // 리로드가 JS 컨텍스트를 파괴하기 전에 SQLite 커넥션을 먼저 정상 종료해야 한다 — 안 그러면
  // native/live-update.ts의 OTA 적용과 같은 이유로 네이티브 쪽에 stale 커넥션이 남아, 리로드 후
  // 보스 수익 과거 기간 조회가 실패한다(사용자 보고).
  it('reload하기 전에 SQLite 커넥션을 먼저 정상 종료한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    render(<CacheDataSection reload={reload} />)

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    const mockedClose = vi.mocked(closeBossProfitDb)
    expect(mockedClose).toHaveBeenCalled()
    expect(mockedClose.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0])
  })

  it('삭제가 실패(reject)해도 "삭제 중..."에 갇히지 않고 reload한다', async () => {
    mockedClear.mockRejectedValue(new Error('sqlite fail'))
    const reload = vi.fn()
    render(<CacheDataSection reload={reload} />)

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('삭제가 끝나지 않으면(hang) 타임아웃 후 reload한다', async () => {
    vi.useFakeTimers()
    mockedClear.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함
    const reload = vi.fn()
    render(<CacheDataSection reload={reload} />)

    openAndConfirm()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(reload).toHaveBeenCalled()
  })
})
