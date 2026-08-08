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

  // ADR-065 결정 2: MODAL_STATUSES에 실패가 없어 모달이 소리 없이 닫히던 것을 고친다.
  it('download-error: 실패 문구 + [다시 시도]→startDownload, [나중에]→dismiss', async () => {
    const user = userEvent.setup()
    const actions = mockStore({ status: 'download-error' })

    render(<UpdatePromptModal />)

    expect(screen.getByText('업데이트를 받지 못했습니다')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(actions.startDownload).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: '나중에' }))
    expect(actions.dismiss).toHaveBeenCalledTimes(1)
  })

  // ADR-117 결정 7: 커버가 닫기 뒤로 밀리면서 그 구간(최대 5초) 동안 모달과 버튼이 살아 있게 됐다.
  // 그 구간에 화면이 "업데이트 준비 완료"라고 말하면 거짓말이고, 눌러도 반응 없는 버튼이 남는다.
  it('applying: 진행 표시만 두고 버튼을 전부 치운다', () => {
    mockStore({ status: 'applying', availableVersion: '1.0.2', downloadedBundleId: 'b1' })

    render(<UpdatePromptModal />)

    expect(screen.getByText('적용하고 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // 되돌릴 수 없는 구간이라 [나중에]도 없다 — dismiss가 downloadedBundleId를 비우면
    // 실패했을 때 재시도할 번들 참조를 잃는다.
    expect(screen.queryByText('업데이트 준비 완료')).not.toBeInTheDocument()
    // 적용은 퍼센트가 나오지 않는다 — 가짜로 채우는 결정형 진행률은 거짓 정보다(ADR-061 결정 6).
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('applying: 배경을 탭해도 닫히지 않는다(진행 중 취소 방지)', async () => {
    const user = userEvent.setup()
    const a = mockStore({ status: 'applying', downloadedBundleId: 'b1' })

    render(<UpdatePromptModal />)
    await user.click(screen.getByTestId('update-prompt-overlay'))

    expect(a.dismiss).not.toHaveBeenCalled()
  })

  // 받아둔 번들은 그대로 살아 있다(스토어가 downloadedBundleId를 비우지 않는다) — 다시 받지 않고
  // 적용만 다시 시도한다. download-error 와 갈리는 지점이 정확히 이 핸들러다(ADR-117 결정 1).
  it('apply-error: [다시 시도]→apply(startDownload 아님), [나중에]→dismiss', async () => {
    const user = userEvent.setup()
    const a = mockStore({ status: 'apply-error', availableVersion: '1.0.2', downloadedBundleId: 'b1' })

    render(<UpdatePromptModal />)

    expect(screen.getByText('업데이트를 적용하지 못했습니다')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(a.apply).toHaveBeenCalledTimes(1)
    expect(a.startDownload).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '나중에' }))
    expect(a.dismiss).toHaveBeenCalledTimes(1)
  })

  // 자동 확인일 수 있어 모달을 띄우지 않는다 — 설정 상태 행에만 남는다.
  it('check-error: 모달을 띄우지 않는다', () => {
    mockStore({ status: 'check-error' })

    const { container } = render(<UpdatePromptModal />)

    expect(container).toBeEmptyDOMElement()
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
