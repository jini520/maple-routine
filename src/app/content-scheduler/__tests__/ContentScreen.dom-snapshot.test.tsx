// @vitest-environment jsdom
//
// ADR-094 결정 4의 안전장치 — 자세한 배경은 `__tests__/dom-snapshot.helper.ts` 주석 참고.
// 이 화면은 atoms 치환(2단계)과 templates 추출(4단계)이 함께 건드리므로 대조가 필요하다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { domSnapshot } from '../../../__tests__/dom-snapshot.helper'
import { ContentScreen } from '../ContentScreen'
import {
  useContentSchedulerStore,
  type ContentCharacterView,
} from '../../../features/content-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'

vi.mock('../../../features/toast/store', () => ({
  useToastStore: {
    getState: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }),
  },
}))

vi.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: vi.fn(),
}))

vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: vi.fn(),
}))

const mockedUseContentSchedulerStore = vi.mocked(useContentSchedulerStore)
const mockedGetCharacterPickerRoster = vi.mocked(getCharacterPickerRoster)

function mockStore(overrides: Partial<ReturnType<typeof useContentSchedulerStore>>): void {
  mockedUseContentSchedulerStore.mockReturnValue({
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    manualTrackedByOcid: {},
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    addManualContent: vi.fn(),
    removeManualContent: vi.fn(),
    ...overrides,
  })
}

function character(overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터1',
    dailyContents: [],
    weeklyContents: [],
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

function renderScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/content']}>
      <Routes>
        <Route path="/content" element={<ContentScreen />} />
        <Route path="/content/manage" element={<div>관리 페이지 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // 트래킹 모드는 실제 zustand 스토어라 케이스를 건너 산다 — 수동 모드 케이스가 뒤 케이스로
  // 새지 않게 되돌린다(이 파일은 지금 수동 케이스가 마지막이지만, 케이스가 늘면 곧 문제가 된다).
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('ContentScreen DOM 스냅샷 (ADR-094 결정 4)', () => {
  it('추적 캐릭터 없음 — 빈 상태', () => {
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([])
    })
    mockStore({ status: 'loaded', trackedOcids: [] })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  it('일간 탭 — 컨텐츠 카드와 진행률 바', () => {
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([])
    })
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      characters: [
        character({
          dailyContents: [
            {
              name: '몬스터파크',
              kind: 'contents',
              isRegistered: true,
              nowCount: 7,
              maxCount: 14,
              questState: null,
            },
            {
              name: '일일 퀘스트 - 레헬른',
              kind: 'quest',
              isRegistered: true,
              nowCount: 0,
              maxCount: 1,
              questState: null,
            },
          ],
        }),
      ],
    })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  it('수동 추적 모드 — 자동 모드와 다른 카드 구성', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([])
    })
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      characters: [character({})],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }] },
    })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })
})
