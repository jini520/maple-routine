// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BossScreen } from '../BossScreen'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../../../types'
import type { MatchedBoss } from '../../../lib/boss-matching'

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
              ownComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
              isSeasonBoss: false,
            },
          ],
        }),
      ],
    })

    render(<BossScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
  })

  it('sticky 헤더가 top-0으로 화면 최상단부터 덮어 스크롤 시 안전영역 뒤로 카드가 비치지 않는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
    })

    render(<BossScreen />)
    const heading = await screen.findByRole('heading', { name: '보스 스케줄러' })
    const stickyEl = heading.closest('.sticky')

    expect(stickyEl).toHaveClass('top-0')
    expect(stickyEl).toHaveClass('pt-[calc(1rem+var(--sa-top))]')
    expect(stickyEl?.parentElement).toHaveClass('-mt-[var(--sa-top)]')
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
              ownComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
              isSeasonBoss: false,
            },
            {
              apiName: '미등록보스',
              difficulty: '노멀',
              cycle: 'weekly',
              isRegistered: false,
              isComplete: false,
              ownComplete: false,
              matchedBossName: null,
              portraitSlug: null,
              isSeasonBoss: false,
            },
          ],
          monthlyBosses: [
            {
              apiName: '검은 마법사',
              difficulty: '익스트림',
              cycle: 'monthly',
              isRegistered: true,
              isComplete: true,
              ownComplete: true,
              matchedBossName: '검은마법사',
              portraitSlug: 'blackMage',
              isSeasonBoss: false,
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

  it('미등록이어도 완료된 보스는 카드로 표시된다(ADR-031)', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyBosses: [
            {
              apiName: '완료된미등록보스',
              difficulty: '노멀',
              cycle: 'weekly',
              isRegistered: false,
              isComplete: true,
              ownComplete: true,
              matchedBossName: '완료된미등록보스',
              portraitSlug: null,
              isSeasonBoss: false,
            },
            {
              apiName: '미완료미등록보스',
              difficulty: '노멀',
              cycle: 'weekly',
              isRegistered: false,
              isComplete: false,
              ownComplete: false,
              matchedBossName: '미완료미등록보스',
              portraitSlug: null,
              isSeasonBoss: false,
            },
          ],
        }),
      ],
    })

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText('완료된미등록보스')).toBeInTheDocument()
    expect(screen.queryByText('미완료미등록보스')).not.toBeInTheDocument()
  })

  describe('챌린저스 시즌 보스 배지 (ADR-031)', () => {
    function seasonBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
      return {
        apiName: '시즌 보스 메이린',
        difficulty: '노멀',
        cycle: 'weekly',
        isRegistered: false,
        isComplete: false,
        ownComplete: false,
        matchedBossName: '시즌 보스 메이린',
        portraitSlug: 'maerin',
        isSeasonBoss: true,
        ...overrides,
      }
    }

    it('챌린저스 월드이고 시즌 보스 항목이 있으면, 등록 여부와 무관하게 season 배지를 보여준다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [
          character({ ocid: 'ocid-1', world: '챌린저스2', weeklyBosses: [seasonBoss({ isRegistered: false, isComplete: false })] }),
        ],
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      expect(screen.getByText('season 미완료')).toBeInTheDocument()
    })

    it('시즌 보스가 완료됐으면 season 배지가 완료 상태를 보여준다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [
          character({ ocid: 'ocid-1', world: '챌린저스', weeklyBosses: [seasonBoss({ isRegistered: true, isComplete: true })] }),
        ],
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      expect(screen.getByText('season 완료')).toBeInTheDocument()
    })

    it('챌린저스 월드가 아니면 시즌 보스 항목이 있어도 season 배지를 보여주지 않는다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [character({ ocid: 'ocid-1', world: '엘리시움', weeklyBosses: [seasonBoss()] })],
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      expect(screen.queryByText(/^season /)).not.toBeInTheDocument()
    })

    it('챌린저스 월드여도 시즌 보스 항목 자체가 없으면 season 배지를 보여주지 않는다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [character({ ocid: 'ocid-1', world: '챌린저스', weeklyBosses: [] })],
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      expect(screen.queryByText(/^season /)).not.toBeInTheDocument()
    })
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
              ownComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
              isSeasonBoss: false,
            },
          ],
          monthlyBosses: [
            {
              apiName: '검은 마법사',
              difficulty: '익스트림',
              cycle: 'monthly',
              isRegistered: true,
              isComplete: true,
              ownComplete: true,
              matchedBossName: '검은마법사',
              portraitSlug: 'blackMage',
              isSeasonBoss: false,
            },
            {
              apiName: '미등록월간보스',
              difficulty: '노멀',
              cycle: 'monthly',
              isRegistered: false,
              isComplete: false,
              ownComplete: false,
              matchedBossName: null,
              portraitSlug: null,
              isSeasonBoss: false,
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
              ownComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
              isSeasonBoss: false,
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
              ownComplete: false,
              matchedBossName: '루시드',
              portraitSlug: null,
              isSeasonBoss: false,
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
      expect(saveTrackedOcids).toHaveBeenCalledWith(['ocid-1', 'ocid-2'], expect.any(Function))
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
              ownComplete: false,
              matchedBossName: '자쿰',
              portraitSlug: null,
              isSeasonBoss: false,
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

  it('status가 loading이면 새로고침 아이콘이 회전하고 조회 중 텍스트를 보여준다', async () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
    })

    render(<BossScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText('조회 중...')).toBeInTheDocument()
    const icon = screen.getByRole('button', { name: '새로고침' }).querySelector('svg')
    expect(icon).toHaveClass('animate-spin')
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
              ownComplete: true,
              matchedBossName: '검은마법사',
              portraitSlug: 'blackMage',
              isSeasonBoss: false,
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
            ownComplete: false,
            matchedBossName: '자쿰',
            portraitSlug: null,
            isSeasonBoss: false,
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

    it('"파티 관리" 버튼 클릭 시 보스 드롭다운(기본값: 첫 보스)·등록된 난이도 뱃지·파티원 +/- 스테퍼가 있는 모달이 열리고, 증가시킨 뒤 저장하면 store의 setPartySize가 올바른 인자로 호출된다', async () => {
      const setPartySize = vi.fn().mockResolvedValue(undefined)
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
        setPartySize,
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '파티 관리' }))
      expect(await screen.findByRole('heading', { name: '파티 관리' })).toBeInTheDocument()

      // 등록된 보스가 하나(자쿰·카오스)뿐이라 드롭다운·난이도 뱃지 모두 자동 선택된다.
      expect(screen.getByLabelText('보스')).toHaveValue('자쿰')
      expect(screen.getByRole('button', { name: '카오스', pressed: true })).toBeInTheDocument()

      const increment = screen.getByRole('button', { name: '파티원 수 증가' })
      fireEvent.click(increment)
      fireEvent.click(increment)
      fireEvent.click(increment)
      fireEvent.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 4)
      })
    })

    it('파티원 수는 1 미만·보스의 최대 인원 초과로 조정할 수 없다 — 경계에서 -/+ 버튼이 비활성화된다', async () => {
      const setPartySize = vi.fn()
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
        setPartySize,
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '파티 관리' }))
      const modal = within(await screen.findByTestId('party-management-modal-overlay'))
      const decrement = modal.getByRole('button', { name: '파티원 수 감소' })
      const increment = modal.getByRole('button', { name: '파티원 수 증가' })

      // 초기값은 미설정(솔로) → 1이라 감소 버튼은 처음부터 비활성화돼있다.
      expect(decrement).toBeDisabled()
      expect(modal.getByText('1')).toBeInTheDocument()

      // 자쿰은 별도 maxPartySize 예외가 없어 기본값(6)이 상한이다 — 6까지 올리면 증가 버튼이 비활성화된다.
      for (let i = 0; i < 6; i += 1) {
        fireEvent.click(increment)
      }
      expect(modal.getByText('6')).toBeInTheDocument()
      expect(increment).toBeDisabled()

      // 비활성화된 버튼을 눌러도 값은 그대로다.
      fireEvent.click(increment)
      expect(modal.getByText('6')).toBeInTheDocument()

      fireEvent.click(modal.getByRole('button', { name: '저장' }))
      await waitFor(() => {
        expect(setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 6)
      })
    })

    it('등록된 보스가 하나도 없으면(기본 토글이 켜져 있어도) 전체 보스 목록으로 대체되며, 보스를 바꾸면 그 보스가 지원하는 난이도 뱃지로 바뀌고 첫 난이도가 기본 선택된다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        // 이 캐릭터는 어떤 보스도 등록해두지 않았다 — 그래도 파티 관리 보스 목록은 비어있지 않아야 한다.
        characters: [character({ ocid: 'ocid-1', weeklyBosses: [], monthlyBosses: [] })],
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '파티 관리' }))
      await screen.findByRole('heading', { name: '파티 관리' })

      // 전체 보스 목록의 첫 항목(자쿰)이 기본 선택되고, 자쿰은 카오스 하나만 지원한다.
      expect(screen.getByLabelText('보스')).toHaveValue('자쿰')
      expect(screen.getByRole('button', { name: '카오스', pressed: true })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '이지' })).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('보스'), { target: { value: '루시드' } })

      // 루시드는 이지/노멀/하드를 지원 — 첫 난이도(이지)가 기본 선택된다.
      expect(screen.getByRole('button', { name: '이지', pressed: true })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '노멀' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '하드' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '카오스' })).not.toBeInTheDocument()
    })

    describe('"스케줄러에 등록된 보스만 보기" 토글 (ADR-031)', () => {
      it('기본값은 ON이고, 등록된 보스만 드롭다운에 보인다', async () => {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
        })

        render(<BossScreen />)
        await screen.findByRole('combobox')

        fireEvent.click(screen.getByRole('button', { name: '파티 관리' }))
        await screen.findByRole('heading', { name: '파티 관리' })

        const toggle = screen.getByRole('switch', { name: '스케줄러에 등록된 보스만 보기' })
        expect(toggle).toHaveAttribute('aria-checked', 'true')

        const options = within(screen.getByLabelText('보스')).getAllByRole('option')
        expect(options.map((option) => option.textContent)).toEqual(['자쿰'])
      })

      it('토글을 끄면 전체 보스 목록이 드롭다운에 보인다', async () => {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
        })

        render(<BossScreen />)
        await screen.findByRole('combobox')

        fireEvent.click(screen.getByRole('button', { name: '파티 관리' }))
        await screen.findByRole('heading', { name: '파티 관리' })

        fireEvent.click(screen.getByRole('switch', { name: '스케줄러에 등록된 보스만 보기' }))

        const options = within(screen.getByLabelText('보스')).getAllByRole('option')
        expect(options.length).toBeGreaterThan(1)
        expect(options.map((option) => option.textContent)).toContain('루시드')
      })

      it('토글을 껐다가 다시 등록된 보스만 보기로 돌아오면, 선택 중이던 미등록 보스 대신 등록된 보스가 다시 선택된다', async () => {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
        })

        render(<BossScreen />)
        await screen.findByRole('combobox')

        fireEvent.click(screen.getByRole('button', { name: '파티 관리' }))
        await screen.findByRole('heading', { name: '파티 관리' })

        const toggle = screen.getByRole('switch', { name: '스케줄러에 등록된 보스만 보기' })
        fireEvent.click(toggle) // OFF — 전체 목록
        fireEvent.change(screen.getByLabelText('보스'), { target: { value: '루시드' } })
        expect(screen.getByLabelText('보스')).toHaveValue('루시드')

        fireEvent.click(toggle) // 다시 ON — 루시드는 미등록이라 목록에서 빠지므로 등록된 보스(자쿰)로 되돌아간다
        expect(screen.getByLabelText('보스')).toHaveValue('자쿰')
      })
    })

    it('선택한 보스가 스케줄러에 등록돼있으면 그 등록된 난이도가 기본 선택된다(첫 난이도가 아니어도)', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [
          character({
            ocid: 'ocid-1',
            weeklyBosses: [
              {
                apiName: '루시드',
                difficulty: '하드',
                cycle: 'weekly',
                isRegistered: true,
                isComplete: false,
                ownComplete: false,
                matchedBossName: '루시드',
                portraitSlug: null,
                isSeasonBoss: false,
              },
            ],
          }),
        ],
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '파티 관리' }))
      await screen.findByRole('heading', { name: '파티 관리' })

      // 루시드는 이지/노멀/하드를 지원하지만(첫 난이도는 이지), 이 캐릭터가 하드로 등록해뒀으므로
      // 하드가 기본 선택된다.
      fireEvent.change(screen.getByLabelText('보스'), { target: { value: '루시드' } })
      expect(screen.getByRole('button', { name: '하드', pressed: true })).toBeInTheDocument()

      // 자쿰은 이 캐릭터가 등록해두지 않아 기본(등록된 보스만 보기) 목록에는 없다 —
      // 토글을 꺼서 전체 목록으로 전환한 뒤에야 선택할 수 있다.
      fireEvent.click(screen.getByRole('switch', { name: '스케줄러에 등록된 보스만 보기' }))
      fireEvent.change(screen.getByLabelText('보스'), { target: { value: '자쿰' } })
      expect(screen.getByRole('button', { name: '카오스', pressed: true })).toBeInTheDocument()
    })
  })

  describe('솔로/파티 서브 필터 (ADR-019)', () => {
    function characterWithTwoBosses(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
      return character({
        ocid: 'ocid-1',
        weeklyBosses: [
          {
            apiName: '자쿰',
            difficulty: '카오스',
            cycle: 'weekly',
            isRegistered: true,
            isComplete: false,
            ownComplete: false,
            matchedBossName: '자쿰',
            portraitSlug: null,
            isSeasonBoss: false,
          },
          {
            apiName: '루시드',
            difficulty: '하드',
            cycle: 'weekly',
            isRegistered: true,
            isComplete: false,
            ownComplete: false,
            matchedBossName: '루시드',
            portraitSlug: null,
            isSeasonBoss: false,
          },
        ],
        monthlyBosses: [
          {
            apiName: '검은 마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            isRegistered: true,
            isComplete: false,
            ownComplete: false,
            matchedBossName: '검은마법사',
            portraitSlug: 'blackMage',
            isSeasonBoss: false,
          },
        ],
        ...overrides,
      })
    }

    it('필터를 "파티"로 선택하면 파티원 2인 이상인 보스만 보인다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithTwoBosses()],
        // 자쿰은 4인 파티, 루시드는 미설정(솔로 취급)
        partySizes: { 'ocid-1:자쿰:카오스': 4 },
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')
      fireEvent.click(screen.getByRole('button', { name: '파티' }))

      expect(screen.getByText('자쿰')).toBeInTheDocument()
      expect(screen.queryByText('루시드')).not.toBeInTheDocument()
    })

    it('필터를 "솔로"로 선택하면 미설정+1인 보스만 보인다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithTwoBosses()],
        // 자쿰은 4인 파티, 루시드는 1인으로 명시 설정
        partySizes: { 'ocid-1:자쿰:카오스': 4, 'ocid-1:루시드:하드': 1 },
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')
      fireEvent.click(screen.getByRole('button', { name: '솔로' }))

      expect(screen.getByText('루시드')).toBeInTheDocument()
      expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
    })

    it('주간 탭에서 필터를 바꾼 뒤 월간 탭으로 전환해도 월간 탭 필터는 "전체"로 유지된다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithTwoBosses()],
        partySizes: { 'ocid-1:자쿰:카오스': 4 },
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '파티' }))
      expect(screen.queryByText('루시드')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '월간' }))
      // 검은마법사는 파티 설정이 없어 솔로 취급이지만, 월간 탭 필터는 독립적으로 "전체"로
      // 유지되어야 하므로 그대로 보여야 한다.
      expect(screen.getByText('검은마법사')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '전체' })).toHaveClass('bg-primary/15')

      fireEvent.click(screen.getByRole('button', { name: '주간' }))
      // 주간 탭으로 되돌아오면 이전에 선택한 "파티" 필터가 그대로 유지된다.
      expect(screen.getByRole('button', { name: '파티' })).toHaveClass('bg-primary/15')
      expect(screen.getByText('자쿰')).toBeInTheDocument()
      expect(screen.queryByText('루시드')).not.toBeInTheDocument()
    })

    it('필터로 결과가 0개일 때와 등록된 보스 자체가 없을 때 서로 다른 빈 상태 문구가 보인다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [
          character({
            ocid: 'ocid-1',
            weeklyBosses: [],
            isStale: false,
          }),
        ],
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')

      // 등록된 보스 자체가 없는 경우
      expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()
      expect(screen.queryByText('이 조건에 해당하는 보스가 없습니다')).not.toBeInTheDocument()

      cleanup()

      // 등록된 보스는 있지만 필터 조건에 맞는 게 없는 경우
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithTwoBosses()],
        partySizes: {},
      })

      render(<BossScreen />)
      await screen.findByRole('combobox')
      fireEvent.click(screen.getByRole('button', { name: '파티' }))

      expect(screen.getByText('이 조건에 해당하는 보스가 없습니다')).toBeInTheDocument()
      expect(screen.queryByText(/게임에서 스케줄러에 등록해주세요/)).not.toBeInTheDocument()
    })
  })
})
