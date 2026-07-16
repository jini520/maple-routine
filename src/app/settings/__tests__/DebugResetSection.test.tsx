// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DebugResetSection } from '../DebugResetSection'
import { clearAppDataExceptAuth } from '../../../storage/debug-reset'
import { showSplashScreen } from '../../../native/splash-screen'

vi.mock('../../../storage/debug-reset', () => ({
  clearAppDataExceptAuth: vi.fn(),
}))

vi.mock('../../../native/splash-screen', () => ({
  showSplashScreen: vi.fn(async () => {}),
}))

const mockedClear = vi.mocked(clearAppDataExceptAuth)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  document.body.style.overflow = ''
})

function openAndConfirm(): void {
  fireEvent.click(screen.getByRole('button', { name: /디버그: 데이터 초기화/ }))
  fireEvent.click(screen.getByRole('button', { name: '초기화' }))
}

describe('DebugResetSection', () => {
  it('초기화가 성공하면 reload를 호출한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    render(<DebugResetSection reload={reload} />)

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(mockedClear).toHaveBeenCalledOnce()
  })

  it('리로드 직전에 스플래시를 띄워 리로드 동안 웹뷰 배경색이 드러나지 않게 한다', async () => {
    mockedClear.mockResolvedValue(undefined)
    const reload = vi.fn()
    render(<DebugResetSection reload={reload} />)

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
    const mockedShow = vi.mocked(showSplashScreen)
    expect(mockedShow).toHaveBeenCalled()
    // 스플래시가 reload보다 먼저 호출돼야 리로드 구간을 덮는다
    expect(mockedShow.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0])
  })

  it('초기화가 실패(reject)해도 "초기화 중..."에 갇히지 않고 reload한다', async () => {
    mockedClear.mockRejectedValue(new Error('sqlite fail'))
    const reload = vi.fn()
    render(<DebugResetSection reload={reload} />)

    openAndConfirm()

    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('초기화가 끝나지 않으면(hang) 타임아웃 후 reload한다', async () => {
    vi.useFakeTimers()
    mockedClear.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함
    const reload = vi.fn()
    render(<DebugResetSection reload={reload} />)

    openAndConfirm()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(reload).toHaveBeenCalled()
  })
})
