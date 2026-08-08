// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import packageJson from '../../../../package.json'
import type { ReleaseNote } from '../../../types'
import { SettingsReleaseNotesScreen } from '../SettingsReleaseNotesScreen'
import { useLiveUpdateStore } from '../../../features/live-update/store'

vi.mock('../../../features/live-update/store', () => ({ useLiveUpdateStore: vi.fn() }))

// 노트 데이터는 **화면이 아니라 데이터 파일이 소유한다**(ADR-119 결정 4) — 여러 건이 필요한
// 케이스(순서·항목 단위 표식)를 위해 `src/data/release-notes.ts` 를 늘리지 않고 여기서 픽스처를
// 주입한다. 픽스처를 안 넣으면 진짜 데이터가 그대로 온다.
let fixture: ReleaseNote[] | null = null

vi.mock('../../../data/release-notes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/release-notes')>()
  return {
    ...actual,
    get RELEASE_NOTES(): ReleaseNote[] {
      return fixture ?? actual.RELEASE_NOTES
    },
  }
})

const mockedUseLiveUpdateStore = vi.mocked(useLiveUpdateStore)
const checkMock = vi.fn()
const loadCurrentVersionMock = vi.fn()

function mockLiveUpdateStore(overrides: Partial<ReturnType<typeof useLiveUpdateStore>> = {}): void {
  mockedUseLiveUpdateStore.mockReturnValue({
    currentVersion: null,
    status: 'idle',
    availableVersion: null,
    availableSize: null,
    minNativeVersion: null,
    downloadProgress: 0,
    channel: 'production',
    pending: null,
    downloadedBundleId: null,
    loadCurrentVersion: loadCurrentVersionMock,
    check: checkMock,
    checkOnBoot: vi.fn(),
    startDownload: vi.fn(),
    confirmCellularDownload: vi.fn(),
    apply: vi.fn(),
    openStore: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  })
}

function renderReleaseNotesScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/settings/release-notes']}>
      <Routes>
        <Route path="/settings/release-notes" element={<SettingsReleaseNotesScreen />} />
        <Route path="/settings" element={<div>설정 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  fixture = null
  mockLiveUpdateStore()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsReleaseNotesScreen', () => {
  // 골격은 관리 페이지·`/settings/about` 과 같다(ADR-118 결정 2).
  it('"개발노트" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 설정으로 돌아간다', () => {
    renderReleaseNotesScreen()

    expect(screen.getByRole('heading', { name: '개발노트' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('설정 프로브')).toBeInTheDocument()
  })

  // 앱 번들에 실린 진짜 데이터를 그대로 그린다 — 이 화면의 계약이 "네트워크 0회, 과거 전체"다.
  it('RELEASE_NOTES 의 모든 버전과 모든 항목 문구를 그린다', async () => {
    const actual = await vi.importActual<typeof import('../../../data/release-notes')>(
      '../../../data/release-notes',
    )
    renderReleaseNotesScreen()

    expect(actual.RELEASE_NOTES.length).toBeGreaterThan(0)
    for (const note of actual.RELEASE_NOTES) {
      expect(screen.getByText(note.version)).toBeInTheDocument()
      expect(screen.getByText(note.date)).toBeInTheDocument()
      for (const item of note.items) {
        expect(screen.getByText(item.text)).toBeInTheDocument()
      }
    }
  })

  // ADR-119 / step 2: "최신이 먼저"는 데이터의 계약이고 그 강제는 데이터 테스트가 한다 —
  // 화면이 다시 정렬하면 같은 규칙의 진실이 두 곳에 생긴다.
  it('배열 순서를 그대로 그린다 — 화면이 정렬하지 않는다', () => {
    fixture = [
      { version: '1.0.4', date: '2026-08-20', items: [{ text: '나중 것' }] },
      { version: '1.0.3', date: '2026-08-09', items: [{ text: '먼저 것' }] },
    ]
    renderReleaseNotesScreen()

    const versions = screen.getAllByTestId('release-note-version').map((node) => node.textContent)
    expect(versions).toEqual(['1.0.4', '1.0.3'])
  })

  // ADR-119 결정 3: 표식은 버전이 아니라 **항목**에 붙는다 — 한 릴리스에 OTA 변경과 네이티브
  // 변경이 섞이는 것이 정상이고, 버전 단위로 묶으면 OTA 로 이미 받을 수 있는 나머지까지
  // 못 받는 것처럼 읽힌다.
  it('requiresStoreUpdate 인 항목에만 「스토어 업데이트 필요」 표식을 붙인다', () => {
    fixture = [
      {
        version: '1.0.4',
        date: '2026-08-20',
        items: [
          { text: 'OTA 로 가는 변경' },
          { text: '네이티브가 필요한 변경', requiresStoreUpdate: true },
        ],
      },
    ]
    renderReleaseNotesScreen()

    const otaItem = screen.getByText('OTA 로 가는 변경').closest('li')
    const nativeItem = screen.getByText('네이티브가 필요한 변경').closest('li')
    expect(otaItem).not.toBeNull()
    expect(nativeItem).not.toBeNull()

    expect(within(nativeItem as HTMLElement).getByText('스토어 업데이트 필요')).toBeInTheDocument()
    expect(within(otaItem as HTMLElement).queryByText('스토어 업데이트 필요')).not.toBeInTheDocument()
    expect(screen.getAllByText('스토어 업데이트 필요')).toHaveLength(1)
  })

  it('지금 실행 중인 버전에만 "사용 중" 배지를 붙인다', () => {
    fixture = [
      { version: '1.0.4', date: '2026-08-20', items: [{ text: '나중 것' }] },
      { version: '1.0.3', date: '2026-08-09', items: [{ text: '먼저 것' }] },
    ]
    mockLiveUpdateStore({ currentVersion: '1.0.3' })
    renderReleaseNotesScreen()

    const badges = screen.getAllByText('사용 중')
    expect(badges).toHaveLength(1)
    const card = badges[0].closest('[data-testid="release-note"]')
    expect(within(card as HTMLElement).getByTestId('release-note-version')).toHaveTextContent('1.0.3')
  })

  // `AppUpdateSection`·`SettingsScreen` 과 같은 폴백 — 네이티브 번들 버전을 못 읽는 환경(web)에서는
  // 빌드 시점 값이 곧 실행 중인 버전이다.
  it('currentVersion 이 없으면 package.json 버전으로 판정한다', () => {
    fixture = [{ version: packageJson.version, date: '2026-08-09', items: [{ text: '항목' }] }]
    mockLiveUpdateStore({ currentVersion: null })
    renderReleaseNotesScreen()

    expect(screen.getByText('사용 중')).toBeInTheDocument()
  })

  // 없는 것을 지어내지 않는다 — 1.0.2 이전 사용자는 자기 버전이 목록에 없다(ADR-119 결정 4).
  it('일치하는 버전이 없으면 배지를 하나도 붙이지 않는다', () => {
    fixture = [{ version: '1.0.4', date: '2026-08-20', items: [{ text: '항목' }] }]
    mockLiveUpdateStore({ currentVersion: '9.9.9' })
    renderReleaseNotesScreen()

    expect(screen.queryByText('사용 중')).not.toBeInTheDocument()
  })

  it('노트가 하나도 없으면 빈 상태를 그린다', () => {
    fixture = []
    mockLiveUpdateStore({ currentVersion: '1.0.3' })
    renderReleaseNotesScreen()

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('release-note')).not.toBeInTheDocument()
  })

  // ADR-119 결정 1: 이 화면은 이미 받은 번들 안의 데이터만 읽는다 — 매니페스트 조회는 업데이트
  // 모달의 몫이다. 현재 버전 로드(네이티브 조회)는 하지만 네트워크로 나가지 않는다.
  it('매니페스트를 조회하지 않는다 — 현재 버전만 읽는다', () => {
    renderReleaseNotesScreen()

    expect(checkMock).not.toHaveBeenCalled()
    expect(loadCurrentVersionMock).toHaveBeenCalledTimes(1)
  })
})
