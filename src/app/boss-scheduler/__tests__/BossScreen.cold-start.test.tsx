// @vitest-environment jsdom
// 콜드 스타트 직후 보스 탭에 처음 들어갈 때 화면이 지나가는 "프레임"을 실측한다.
// 실기기 관측(2026-08-06): 캐시도 있고 컨텐츠 스케줄러가 이미 동기화를 끝냈는데도
// [빈 상태("표시할 캐릭터가 없습니다") → 로딩("불러오고 있어요") → 목록] 순으로 두 프레임이 낀다.
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BossScreen } from '../BossScreen'
import { useBossSchedulerStore } from '../../../features/boss-scheduler/store'

vi.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))

// 저장소 읽기는 네이티브 브리지(Preferences·SQLite)를 건너는 실제 비동기다 — 마이크로태스크
// 하나로 끝나지 않고 매크로태스크 경계를 넘으므로, 그 사이에 React 커밋이 낀다. 실기기에서
// 프레임이 보이는 이유가 이것이라 모킹도 같은 모양으로 한다.
const { bridge } = vi.hoisted(() => ({
  bridge: <T,>(value: T): Promise<T> =>
    new Promise((resolve) => {
      setTimeout(() => resolve(value), 0)
    }),
}))

vi.mock('@core/storage/character-selection', () => ({
  getTrackedCharacterOcids: vi.fn(() => bridge(['ocid-1'])),
  getLastSelectedCharacter: vi.fn(() => bridge('ocid-1')),
  setTrackedCharacterOcids: vi.fn(() => bridge(undefined)),
  setLastSelectedCharacter: vi.fn(() => bridge(undefined)),
}))

vi.mock('@core/storage/scheduler-cache', () => ({
  getCachedSchedulerState: vi.fn(() =>
    bridge({
      state: {
        characterName: '캐릭터1',
        world: '스카니아',
        bossContents: [
          {
            name: '스우',
            difficulty: '하드',
            cycle: 'weekly',
            isRegistered: true,
            isComplete: false,
            ownComplete: false,
          },
        ],
      },
      syncedAt: '2026-08-06T00:00:00.000Z',
    }),
  ),
}))

vi.mock('@core/storage/character-basic-cache', () => ({
  getCachedCharacterBasic: vi.fn(() => bridge({ profile: { level: 275 } })),
}))

vi.mock('@core/storage/boss-party-settings', () => ({
  getBossPartySettings: vi.fn(() => bridge([])),
  setBossPartySize: vi.fn(() => bridge(undefined)),
}))

vi.mock('@core/storage/manual-tracked-content', () => ({
  getManualTrackedContent: vi.fn(() => bridge([])),
  setManualTrackedContent: vi.fn(() => bridge(undefined)),
}))

// 컨텐츠 스케줄러가 이번 실행에서 이미 동기화를 끝낸 상태 — ADR-097 TTL 게이트가 걸려
// 이 화면은 네트워크를 아예 타지 않는다(그래서 로딩이 뜰 이유가 더더욱 없다).
vi.mock('../../../features/schedule-sync/sync-run-state', () => ({
  hasSyncAttemptedThisRun: () => true,
  markSyncAttemptedThisRun: () => {},
}))

vi.mock('@core/lib/sync-freshness', () => ({ isSyncFresh: () => true }))

vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  syncSchedules: vi.fn(async () => {
    throw new Error('TTL 게이트가 걸려 있어 네트워크 동기화가 일어나면 안 된다')
  }),
  getCharacterPickerRoster: vi.fn(async () => []),
}))

const INITIAL_STATE = useBossSchedulerStore.getState()

/** 지금 화면이 어떤 상태를 그리고 있는지 한 단어로 요약한다. */
function currentFrame(): string {
  if (screen.queryByText('표시할 캐릭터가 없습니다') !== null) return 'empty'
  if (screen.queryByText('불러오고 있어요') !== null) return 'loading'
  if (screen.queryByText('스우') !== null) return 'list'
  return 'blank'
}

function renderBossScreen(): void {
  render(
    <MemoryRouter initialEntries={['/boss']}>
      <Routes>
        <Route path="/boss" element={<BossScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 태스크를 한 틱씩 흘려보내며 매 커밋의 화면을 기록하고, 연속 중복을 접어 시퀀스로 만든다. */
async function recordFrames(ticks = 30): Promise<string[]> {
  const frames = [currentFrame()]
  for (let tick = 0; tick < ticks; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    frames.push(currentFrame())
  }
  return frames.filter((frame, index) => frame !== frames[index - 1])
}

describe('BossScreen 콜드 스타트 프레임', () => {
  beforeEach(() => {
    useBossSchedulerStore.setState(INITIAL_STATE, true)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // [[ADR-101]] 결정 1 — 화면이 직접 보장하는 몫.
  it('하이드레이션 중에 빈 상태가 끼지 않는다', async () => {
    renderBossScreen()
    const sequence = await recordFrames()

    expect(sequence.at(-1)).toBe('list')
    // `trackedOcids === null` 은 "0명"이 아니라 "아직 안 읽음"이다 — 아직 모르는 사실을 단정하지 않는다.
    expect(sequence).not.toContain('empty')
  })

  // [[ADR-101]] 결정 2 — 부팅 선하이드레이션이 보장하는 몫. 화면이 하이드레이션된 스토어 위에
  // 마운트되면 **첫 프레임이 곧 목록**이라 로딩조차 지나가지 않는다.
  it('선하이드레이션이 끝난 뒤 마운트하면 첫 프레임이 목록이다', async () => {
    await useBossSchedulerStore.getState().loadTrackedOcids()

    renderBossScreen()
    const sequence = await recordFrames(5)

    expect(sequence).toEqual(['list'])
  })
})
