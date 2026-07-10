// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BossScreen } from '../BossScreen'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { getRegisteredCharacters } from '../../../features/schedule-sync/schedule-sync'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../../storage/character-selection'
import type { MapleCharacter } from '../../../types'

vi.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: vi.fn(),
}))

vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
  getRegisteredCharacters: vi.fn(),
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: vi.fn(),
  setTrackedCharacterOcids: vi.fn(),
}))

const mockedUseBossSchedulerStore = vi.mocked(useBossSchedulerStore)
const mockedGetRegisteredCharacters = vi.mocked(getRegisteredCharacters)
const mockedGetTrackedCharacterOcids = vi.mocked(getTrackedCharacterOcids)
const mockedSetTrackedCharacterOcids = vi.mocked(setTrackedCharacterOcids)

function mockStore(overrides: Partial<ReturnType<typeof useBossSchedulerStore>>): void {
  mockedUseBossSchedulerStore.mockReturnValue({
    status: 'idle',
    characters: [],
    error: null,
    refresh: vi.fn(),
    ...overrides,
  })
}

function mockTracked(ocids: string[] | null): void {
  mockedGetTrackedCharacterOcids.mockResolvedValue(ocids)
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

function mapleCharacter(overrides: Partial<MapleCharacter> = {}): MapleCharacter {
  return {
    ocid: 'roster-ocid',
    name: '로스터캐릭터',
    world: '엘리시움',
    jobClass: '렌',
    level: 200,
    ...overrides,
  }
}

beforeEach(() => {
  mockedGetRegisteredCharacters.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BossScreen', () => {
  it('추적 목록이 null이면 빈 상태 안내만 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyBosses: [
            {
              apiName: '자쿰',
              difficulty: '카오스',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
            },
          ],
        }),
      ],
    })
    mockTracked(null)

    render(<BossScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
  })

  it('추적 목록이 로드되면 그 배열 그대로 refresh가 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
  })

  it('기본 탭은 주간이고, weeklyBosses 중 등록된 것만 보이며 n/12 배지가 표시된다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyBosses: [
            {
              apiName: '자쿰',
              difficulty: '카오스',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
            },
            {
              apiName: '미등록보스',
              difficulty: '노멀',
              cycle: 'weekly',
              isRegistered: false,
              isComplete: false,
              matchedBossName: null,
              portraitSlug: null,
            },
          ],
          monthlyBosses: [
            {
              apiName: '검은 마법사',
              difficulty: '익스트림',
              cycle: 'monthly',
              isRegistered: true,
              isComplete: true,
              matchedBossName: '검은마법사',
              portraitSlug: 'blackMage',
            },
          ],
          weeklyBossClearCount: 3,
          weeklyBossClearLimitCount: 12,
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/자쿰 · 카오스/)).toBeInTheDocument()
    expect(screen.queryByText(/미등록보스/)).not.toBeInTheDocument()
    expect(screen.queryByText(/검은마법사/)).not.toBeInTheDocument()
    expect(screen.getByText(/3\/12/)).toBeInTheDocument()
  })

  it('"월간" 탭으로 전환하면 monthlyBosses 중 등록된 것만 보이고, n/12 배지는 렌더링되지 않는다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyBosses: [
            {
              apiName: '자쿰',
              difficulty: '카오스',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
            },
          ],
          monthlyBosses: [
            {
              apiName: '검은 마법사',
              difficulty: '익스트림',
              cycle: 'monthly',
              isRegistered: true,
              isComplete: true,
              matchedBossName: '검은마법사',
              portraitSlug: 'blackMage',
            },
            {
              apiName: '미등록월간보스',
              difficulty: '노멀',
              cycle: 'monthly',
              isRegistered: false,
              isComplete: false,
              matchedBossName: null,
              portraitSlug: null,
            },
          ],
          weeklyBossClearCount: 3,
          weeklyBossClearLimitCount: 12,
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<BossScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '월간' }))

    expect(screen.getByText(/검은마법사 · 익스트림/)).toBeInTheDocument()
    expect(screen.queryByText(/미등록월간보스/)).not.toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
    expect(screen.queryByText(/3\/12/)).not.toBeInTheDocument()
    expect(screen.queryByText(/12/)).not.toBeInTheDocument()
  })

  it('탭을 전환해도 선택된 캐릭터(드롭다운 상태)가 유지된다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          characterName: '낟낟',
          weeklyBosses: [
            {
              apiName: '자쿰',
              difficulty: '카오스',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
            },
          ],
        }),
        character({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          weeklyBosses: [
            {
              apiName: '루시드',
              difficulty: '하드',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              matchedBossName: '루시드',
              portraitSlug: null,
            },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<BossScreen />)
    const dropdown = await screen.findByRole('combobox')
    fireEvent.change(dropdown, { target: { value: 'ocid-2' } })
    expect(screen.getByText(/루시드/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByRole('combobox')).toHaveValue('ocid-2')
    expect(screen.getByText(/루시드/)).toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
  })

  it('캐릭터 관리 피커로 저장하면 setTrackedCharacterOcids가 boss로 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
      refresh,
    })
    mockTracked(['ocid-1'])
    mockedGetRegisteredCharacters.mockResolvedValue([
      mapleCharacter({ ocid: 'ocid-1', name: '낟낟' }),
      mapleCharacter({ ocid: 'ocid-2', name: '내옆에최성일' }),
    ])
    mockedSetTrackedCharacterOcids.mockResolvedValue(undefined)

    render(<BossScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '내옆에최성일' }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockedSetTrackedCharacterOcids).toHaveBeenCalledWith('boss', ['ocid-1', 'ocid-2'])
    })
    await waitFor(() => {
      expect(refresh).toHaveBeenLastCalledWith(['ocid-1', 'ocid-2'])
    })
  })

  it('status가 loading이면 로딩 표시를 보여준다', async () => {
    mockStore({ status: 'loading', characters: [character({ ocid: 'ocid-1' })] })
    mockTracked(['ocid-1'])

    render(<BossScreen />)

    expect(await screen.findByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', async () => {
    mockStore({
      status: 'error',
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })
    mockTracked(['ocid-1'])

    render(<BossScreen />)

    expect(await screen.findByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('새로고침 버튼을 클릭하면 refresh가 다시 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1'])

    render(<BossScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenLastCalledWith(['ocid-1'])
  })

  it('주간 탭에서 등록된 보스가 없고 isStale이 false면 그 탭에만 빈 상태 안내가 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyBosses: [],
          monthlyBosses: [
            {
              apiName: '검은 마법사',
              difficulty: '익스트림',
              cycle: 'monthly',
              isRegistered: true,
              isComplete: true,
              matchedBossName: '검은마법사',
              portraitSlug: 'blackMage',
            },
          ],
          isStale: false,
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    expect(screen.queryByText(/게임에서 스케줄러에 등록해주세요/)).not.toBeInTheDocument()
    expect(screen.getByText(/검은마법사/)).toBeInTheDocument()
  })
})
