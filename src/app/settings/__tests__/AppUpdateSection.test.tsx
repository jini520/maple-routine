// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppUpdateSection } from '../AppUpdateSection'
import { useLiveUpdateStore } from '../../../features/live-update/store'

vi.mock('../../../features/live-update/store', () => ({ useLiveUpdateStore: vi.fn() }))

const mockedUseLiveUpdateStore = vi.mocked(useLiveUpdateStore)

function mockStore(overrides: Partial<ReturnType<typeof useLiveUpdateStore>>) {
  const check = vi.fn()
  const loadCurrentVersion = vi.fn()
  mockedUseLiveUpdateStore.mockReturnValue({
    currentVersion: '1.0.0',
    status: 'idle',
    availableVersion: null,
    availableSize: null,
    minNativeVersion: null,
    downloadProgress: 0,
    channel: 'production',
    pending: null,
    downloadedBundleId: null,
    loadCurrentVersion,
    check,
    checkOnBoot: vi.fn(),
    startDownload: vi.fn(),
    confirmCellularDownload: vi.fn(),
    apply: vi.fn(),
    openStore: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  })
  return { check, loadCurrentVersion }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AppUpdateSection', () => {
  it('"앱 업데이트" 제목과 현재 번들 버전을 표시하고, 마운트 시 현재 버전을 불러온다', () => {
    const { loadCurrentVersion } = mockStore({ currentVersion: '1.0.3' })
    render(<AppUpdateSection />)
    expect(screen.getByText('앱 업데이트')).toBeInTheDocument()
    expect(screen.getByText('1.0.3')).toBeInTheDocument()
    expect(loadCurrentVersion).toHaveBeenCalledTimes(1)
  })

  it('베타 채널이면 "beta" 배지를 보여준다(한글 아님)', () => {
    mockStore({ channel: 'beta' })
    render(<AppUpdateSection />)
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
  })

  it('"업데이트 확인"을 누르면 check가 호출된다', async () => {
    const user = userEvent.setup()
    const { check } = mockStore({ status: 'idle' })
    render(<AppUpdateSection />)
    await user.click(screen.getByRole('button', { name: '업데이트 확인' }))
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('최신이면 "최신입니다"를 표시한다', () => {
    mockStore({ status: 'up-to-date' })
    render(<AppUpdateSection />)
    expect(screen.getByText('최신입니다')).toBeInTheDocument()
  })

  it('새 버전이 있으면 상태에 버전을 표시한다', () => {
    mockStore({ status: 'update-available', availableVersion: '1.0.2' })
    render(<AppUpdateSection />)
    expect(screen.getByText(/새 버전 v1\.0\.2 있음/)).toBeInTheDocument()
  })

  it('다운로드 중에는 진행률을 표시하고 버튼이 비활성화된다', () => {
    mockStore({ status: 'downloading', downloadProgress: 30 })
    render(<AppUpdateSection />)
    expect(screen.getByText(/다운로드 중 30%/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '업데이트 확인' })).toBeDisabled()
  })

  it('오류면 오류 문구를 표시한다', () => {
    mockStore({ status: 'error' })
    render(<AppUpdateSection />)
    expect(screen.getByText(/실패/)).toBeInTheDocument()
  })

  it('지원되지 않는 플랫폼이면 안내 문구를 보여주고 확인 버튼을 감춘다', () => {
    mockStore({ status: 'unsupported', currentVersion: null })
    render(<AppUpdateSection />)
    expect(screen.getByText(/지원되지 않습니다/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '업데이트 확인' })).not.toBeInTheDocument()
  })
})
