// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdatePromptModal } from '../UpdatePromptModal'
import { useLiveUpdateStore } from '../../features/live-update/store'

vi.mock('../../features/live-update/store', () => ({ useLiveUpdateStore: vi.fn() }))

const mockedStore = vi.mocked(useLiveUpdateStore)

function mockStore(overrides: Partial<ReturnType<typeof useLiveUpdateStore>>) {
  const actions = {
    startDownload: vi.fn(),
    confirmCellularDownload: vi.fn(),
    apply: vi.fn(),
    openStore: vi.fn(),
    dismiss: vi.fn(),
  }
  mockedStore.mockReturnValue({
    currentVersion: '1.0.1',
    status: 'idle',
    availableVersion: null,
    availableSize: null,
    minNativeVersion: null,
    downloadProgress: 0,
    channel: 'production',
    pending: null,
    downloadedBundleId: null,
    loadCurrentVersion: vi.fn(),
    check: vi.fn(),
    checkOnBoot: vi.fn(),
    ...actions,
    ...overrides,
  })
  return actions
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('UpdatePromptModal', () => {
  it('업데이트 관련 상태가 아니면 렌더링하지 않는다', () => {
    mockStore({ status: 'idle' })
    const { container } = render(<UpdatePromptModal />)
    expect(container).toBeEmptyDOMElement()

    cleanup()
    mockStore({ status: 'up-to-date' })
    const r2 = render(<UpdatePromptModal />)
    expect(r2.container).toBeEmptyDOMElement()
  })

  it('update-available: 버전·용량 표시, [다운로드]→startDownload, [나중에]→dismiss', async () => {
    const user = userEvent.setup()
    const a = mockStore({ status: 'update-available', availableVersion: '1.0.2', availableSize: 8_200_000 })

    render(<UpdatePromptModal />)
    expect(screen.getByText(/v1\.0\.2/)).toBeInTheDocument()
    expect(screen.getByText(/7\.8MB|8\.2MB/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다운로드' }))
    expect(a.startDownload).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: '나중에' }))
    expect(a.dismiss).toHaveBeenCalledTimes(1)
  })

  it('베타 채널이면 "beta" 배지를 보여준다(한글 아님)', () => {
    mockStore({ status: 'update-available', availableVersion: '1.0.2', availableSize: 1000, channel: 'beta' })
    render(<UpdatePromptModal />)
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
  })

  it('confirm-cellular: 데이터 경고 표시, [계속]→confirmCellularDownload', async () => {
    const user = userEvent.setup()
    const a = mockStore({ status: 'confirm-cellular', availableSize: 8_200_000 })

    render(<UpdatePromptModal />)
    expect(screen.getByText(/요금이 나올 수 있어요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '계속' }))
    expect(a.confirmCellularDownload).toHaveBeenCalledTimes(1)
  })

  it('downloading: 진행률 바 너비가 downloadProgress를 따른다', () => {
    mockStore({ status: 'downloading', downloadProgress: 42 })
    render(<UpdatePromptModal />)
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByTestId('update-progress-bar')).toHaveStyle({ width: '42%' })
  })

  it('ready-to-apply: [지금 적용 (재시작)]→apply', async () => {
    const user = userEvent.setup()
    const a = mockStore({ status: 'ready-to-apply', availableVersion: '1.0.2' })

    render(<UpdatePromptModal />)
    await user.click(screen.getByRole('button', { name: /지금 적용/ }))
    expect(a.apply).toHaveBeenCalledTimes(1)
  })

  it('store-required: 안내 + [스토어로 이동]→openStore', async () => {
    const user = userEvent.setup()
    const a = mockStore({ status: 'store-required', availableVersion: '2.0.0', minNativeVersion: '2.0.0' })

    render(<UpdatePromptModal />)
    expect(screen.getByText(/스토어에서 업데이트/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '스토어로 이동' }))
    expect(a.openStore).toHaveBeenCalledTimes(1)
  })
})
