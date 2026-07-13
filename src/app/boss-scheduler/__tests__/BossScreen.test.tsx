// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BossScreen } from '../BossScreen'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../../../types'

vi.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: vi.fn(),
  partySizeKey: (ocid: string, boss: string, difficulty: string) => `${ocid}:${boss}:${difficulty}`,
}))

vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
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
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    loadPartySizes: vi.fn(),
    setPartySize: vi.fn(),
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

function pickerEntry(overrides: Partial<CharacterPickerEntry> = {}): CharacterPickerEntry {
  return {
    ocid: 'roster-ocid',
    name: '로스터캐릭터',
    level: 200,
    imageUrl: null,
    ...overrides,
  }
}

beforeEach(() => {
  mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
    onUpdate([])
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BossScreen', () => {
  it('추적 목록이 null이면 빈 상태 안내만 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: null,
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

    render(<BossScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
  })

  it('마운트 시 loadTrackedOcids가 호출된다', async () => {
    const loadTrackedOcids = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      loadTrackedOcids,
    })

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(loadTrackedOcids).toHaveBeenCalledTimes(1)
  })

  it('기본 탭은 주간이고, weeklyBosses 중 등록된 것만 보이며 n/12 배지가 표시된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
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

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText('자쿰')).toBeInTheDocument()
    expect(screen.getByText('카오스')).toBeInTheDocument()
    expect(screen.queryByText('완료')).not.toBeInTheDocument()
    expect(screen.queryByText(/미등록보스/)).not.toBeInTheDocument()
    expect(screen.queryByText(/검은마법사/)).not.toBeInTheDocument()
    expect(screen.getByText(/3\/12/)).toBeInTheDocument()
  })

  it('"월간" 탭으로 전환하면 monthlyBosses 중 등록된 것만 보이고, n/12 배지는 렌더링되지 않는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
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

    render(<BossScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '월간' }))

    expect(screen.getByText('검은마법사')).toBeInTheDocument()
    expect(screen.getByText('익스트림')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
    expect(screen.queryByText(/미등록월간보스/)).not.toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
    expect(screen.queryByText(/3\/12/)).not.toBeInTheDocument()
    expect(screen.queryByText(/12/)).not.toBeInTheDocument()
  })

  it('드롭다운에서 캐릭터를 바꾸면 store의 selectCharacter가 호출된다(ADR-017)', async () => {
    const selectCharacter = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      selectedOcid: 'ocid-1',
      characters: [
        character({ ocid: 'ocid-1', characterName: '낟낟' }),
        character({ ocid: 'ocid-2', characterName: '내옆에최성일' }),
      ],
      selectCharacter,
    })

    render(<BossScreen />)
    const dropdown = await screen.findByRole('combobox')
    fireEvent.change(dropdown, { target: { value: 'ocid-2' } })

    expect(selectCharacter).toHaveBeenCalledWith('ocid-2')
  })

  it('탭을 전환해도 store의 selectedOcid로 선택된 캐릭터가 유지된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      selectedOcid: 'ocid-2',
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

    render(<BossScreen />)
    await screen.findByRole('combobox')
    expect(screen.getByText(/루시드/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByRole('combobox')).toHaveValue('ocid-2')
    expect(screen.getByText(/루시드/)).toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
  })

  it('캐릭터 관리 피커로 저장하면 saveTrackedOcids가 호출된다', async () => {
    const saveTrackedOcids = vi.fn().mockResolvedValue(undefined)
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
      saveTrackedOcids,
    })
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([
        pickerEntry({ ocid: 'ocid-1', name: '낟낟', level: 293 }),
        pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일', level: 211 }),
      ])
    })

    render(<BossScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('button', { name: /내옆에최성일/ }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(saveTrackedOcids).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
    })
  })

  it('status가 loading이고 캐시된 characters도 없으면 로딩 표시를 보여준다', async () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], characters: [] })

    render(<BossScreen />)

    expect(await screen.findByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('ADR-016: status가 loading이어도 캐시된 characters가 있으면 로딩 표시 대신 목록을 계속 보여준다', async () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
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

    render(<BossScreen />)

    expect(await screen.findByText(/자쿰/)).toBeInTheDocument()
    expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', async () => {
    mockStore({
      status: 'error',
      trackedOcids: ['ocid-1'],
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })

    render(<BossScreen />)

    expect(await screen.findByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('새로고침 버튼을 클릭하면 refresh가 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      refresh,
    })

    render(<BossScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  it('주간 탭에서 등록된 보스가 없고 isStale이 false면 그 탭에만 빈 상태 안내가 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
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

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    expect(screen.queryByText(/게임에서 스케줄러에 등록해주세요/)).not.toBeInTheDocument()
    expect(screen.getByText(/검은마법사/)).toBeInTheDocument()
  })

  describe('파티 관리 (ADR-019)', () => {
    function characterWithZakum(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
      return character({
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
        ...overrides,
      })
    }

    it('파티원 2인 이상 설정된 보스 카드에 "n인" 배지가 보인다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
        partySizes: { 'ocid-1:자쿰:카오스': 4 },
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      expect(screen.getByText('4인')).toBeInTheDocument()
    })

    it('1인/미설정 보스 카드에는 파티 배지가 없다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
        partySizes: { 'ocid-1:자쿰:카오스': 1 },
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      expect(screen.queryByText(/^\d+인$/)).not.toBeInTheDocument()
    })

    it('진입 버튼 클릭 시 모달이 열리고, 저장하면 store의 setPartySize가 올바른 인자로 호출된다', async () => {
      const setPartySize = vi.fn().mockResolvedValue(undefined)
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
        setPartySize,
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '자쿰 파티 인원 설정' }))
      expect(await screen.findByText('파티 인원 설정')).toBeInTheDocument()

      const input = screen.getByLabelText('파티원 수')
      fireEvent.change(input, { target: { value: '4' } })
      fireEvent.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 4)
      })
    })

    it('잘못된 값(0, 최대 초과, 소수) 입력 시 인라인 에러가 보이고 setPartySize가 호출되지 않는다', async () => {
      const setPartySize = vi.fn()
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
        setPartySize,
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '자쿰 파티 인원 설정' }))
      const input = await screen.findByLabelText('파티원 수')

      fireEvent.change(input, { target: { value: '0' } })
      fireEvent.click(screen.getByRole('button', { name: '저장' }))
      expect(await screen.findByText(/파티원 수는 1 이상/)).toBeInTheDocument()
      expect(setPartySize).not.toHaveBeenCalled()

      // 자쿰은 별도 maxPartySize 예외가 없어 기본값(6)이 상한이다
      fireEvent.change(input, { target: { value: '7' } })
      fireEvent.click(screen.getByRole('button', { name: '저장' }))
      expect(setPartySize).not.toHaveBeenCalled()

      fireEvent.change(input, { target: { value: '1.5' } })
      fireEvent.click(screen.getByRole('button', { name: '저장' }))
      expect(setPartySize).not.toHaveBeenCalled()
    })
  })
})
