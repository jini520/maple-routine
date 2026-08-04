// @vitest-environment jsdom
//
// ADR-094 결정 4의 안전장치 — 자세한 배경은 `__tests__/dom-snapshot.helper.ts` 주석 참고.
// 보스 카드는 일러스트 bleed·난이도 배지·진행 링을 겹쳐 그리므로(ADR-018) atoms 치환에서
// 클래스가 흔들리기 쉽다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { domSnapshot } from '../../../__tests__/dom-snapshot.helper'
import { BossScreen } from '../BossScreen'
import {
  useBossSchedulerStore,
  type BossCharacterView,
} from '../../../features/boss-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'

vi.mock('../../../features/toast/store', () => ({
  useToastStore: {
    getState: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }),
  },
}))

vi.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: vi.fn(),
  partySizeKey: (ocid: string, boss: string, difficulty: string) => `${ocid}:${boss}:${difficulty}`,
}))

vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: vi.fn(),
}))

const mockedUseBossSchedulerStore = vi.mocked(useBossSchedulerStore)
const mockedGetCharacterPickerRoster = vi.mocked(getCharacterPickerRoster)

function mockStore(overrides: Partial<ReturnType<typeof useBossSchedulerStore>>): void {
  mockedUseBossSchedulerStore.mockReturnValue({
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    partySizes: {},
    manualTrackedByOcid: {},
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    loadPartySizes: vi.fn(),
    setPartySize: vi.fn(),
    addManualBoss: vi.fn(),
    removeManualBoss: vi.fn(),
    ...overrides,
  })
}

function character(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터1',
    weeklyBosses: [],
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

function renderScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/boss']}>
      <Routes>
        <Route path="/boss" element={<BossScreen />} />
        <Route path="/boss/manage" element={<div>보스 관리 페이지 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BossScreen DOM 스냅샷 (ADR-094 결정 4)', () => {
  it('추적 캐릭터 없음 — 빈 상태', () => {
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([])
    })
    mockStore({ status: 'loaded', trackedOcids: [] })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  it('주간 탭 — 보스 카드(일러스트 bleed·난이도 배지)와 진행 링', () => {
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([])
    })
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      weeklyBossClearCount: 3,
      characters: [
        character({
          weeklyBossClearCount: 3,
          weeklyBossClearLimitCount: 12,
          weeklyBosses: [
            {
              apiName: '자쿰',
              difficulty: '카오스',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: true,
              ownComplete: true,
              matchedBossName: '자쿰',
              // 일러스트가 있는 쪽·없는 쪽을 함께 담는다 — bleed 레이어가 조건부라 DOM 이 갈린다.
              portraitSlug: 'zakum',
              isSeasonBoss: false,
            },
            {
              apiName: '스우',
              difficulty: '하드',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              ownComplete: false,
              matchedBossName: '스우',
              portraitSlug: null,
              isSeasonBoss: false,
            },
          ],
        }),
      ],
    })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })
})
