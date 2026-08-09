// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsAboutScreen } from '../SettingsAboutScreen'
import { useLiveUpdateStore } from '../../../features/live-update/store'

vi.mock('../../../features/live-update/store', () => ({ useLiveUpdateStore: vi.fn() }))

const mockedUseLiveUpdateStore = vi.mocked(useLiveUpdateStore)

function mockLiveUpdateStore(overrides: Partial<ReturnType<typeof useLiveUpdateStore>> = {}): void {
  mockedUseLiveUpdateStore.mockReturnValue({
    currentVersion: '1.0.3',
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
    startDownload: vi.fn(),
    confirmCellularDownload: vi.fn(),
    apply: vi.fn(),
    openStore: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  })
}

function renderAboutScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/settings/about']}>
      <Routes>
        <Route path="/settings/about" element={<SettingsAboutScreen />}>
          <Route path="privacy" element={<div>처방침 프로브</div>} />
        </Route>
        <Route path="/settings" element={<div>설정 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockLiveUpdateStore()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsAboutScreen', () => {
  // 골격은 관리 페이지와 같다(ADR-118 결정 2) — PageHeader + ArrowLeft + useScreenNavigate.
  it('"앱 정보" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 설정으로 돌아간다', () => {
    renderAboutScreen()

    expect(screen.getByRole('heading', { name: '앱 정보' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('설정 프로브')).toBeInTheDocument()
  })

  it('업데이트 카드(현재 버전·상태·확인 버튼)를 품는다', () => {
    renderAboutScreen()

    expect(screen.getByText('현재 버전')).toBeInTheDocument()
    expect(screen.getByText('1.0.3')).toBeInTheDocument()
    expect(screen.getByText('상태')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '업데이트 확인' })).toBeInTheDocument()
  })

  // ADR-118 결정 10: `현재 버전` 바로 아래 행이라 주어가 생략되면 무엇이 최신인지가 문장에 없다.
  it('최신이면 "최신 버전입니다"를 표시한다', () => {
    mockLiveUpdateStore({ status: 'up-to-date' })
    renderAboutScreen()

    expect(screen.getByText('최신 버전입니다')).toBeInTheDocument()
  })

  // 페이지 제목이 이미 「앱 정보」라 업데이트 카드가 자기 제목을 또 그리면 중복이다.
  it('업데이트 카드가 "앱 업데이트" 제목을 다시 그리지 않는다', () => {
    renderAboutScreen()

    expect(screen.queryByText('앱 업데이트')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })

  // ADR-118 결정 7: footer 고지에서 이 화면의 행으로 옮겨왔다. Play 사용자 데이터 정책이
  // 요구하는 것은 "앱 안에 링크"이지 "첫 화면에 링크"가 아니다.
  //
  // ADR-120 결정 11: **앱을 벗어나던 링크가 앱 안 하위 페이지로 바뀌었다.** 사본을 만드는 것이
  // 아니라 같은 사이트를 iframe 으로 싣는 것이라 "법적 문서를 두 벌로 만들지 않는다"는 그대로다.
  it('개인정보 처리방침 행이 앱 밖으로 나가지 않고 하위 페이지를 연다', () => {
    renderAboutScreen()

    expect(screen.queryByRole('link', { name: /개인정보 처리방침/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /개인정보 처리방침/ }))

    expect(screen.getByText('처방침 프로브')).toBeInTheDocument()
  })
})
