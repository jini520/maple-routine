// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WeeklyScreen } from '../WeeklyScreen'
import { useWeeklySchedulerStore, type WeeklyCharacterView } from '../../../features/weekly-scheduler/store'
import { getRegisteredCharacters } from '../../../features/schedule-sync/schedule-sync'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../../storage/character-selection'
import type { MapleCharacter } from '../../../types'

vi.mock('../../../features/weekly-scheduler/store', () => ({
  useWeeklySchedulerStore: vi.fn(),
}))

vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
  getRegisteredCharacters: vi.fn(),
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: vi.fn(),
  setTrackedCharacterOcids: vi.fn(),
}))

const mockedUseWeeklySchedulerStore = vi.mocked(useWeeklySchedulerStore)
const mockedGetRegisteredCharacters = vi.mocked(getRegisteredCharacters)
const mockedGetTrackedCharacterOcids = vi.mocked(getTrackedCharacterOcids)
const mockedSetTrackedCharacterOcids = vi.mocked(setTrackedCharacterOcids)

function mockStore(overrides: Partial<ReturnType<typeof useWeeklySchedulerStore>>): void {
  mockedUseWeeklySchedulerStore.mockReturnValue({
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

function character(overrides: Partial<WeeklyCharacterView> = {}): WeeklyCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터1',
    weeklyContents: [],
    bosses: [],
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

describe('WeeklyScreen', () => {
  it('추적 목록이 로드되면 그 배열 그대로 refresh가 호출된다(계정 전체가 아니라)', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
  })

  it('추적 목록이 null이면 refresh가 호출되지 않는다', async () => {
    const refresh = vi.fn()
    mockStore({ refresh })
    mockTracked(null)

    render(<WeeklyScreen />)
    await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')

    expect(refresh).not.toHaveBeenCalled()
  })

  it('추적 목록이 null이면 캐릭터 데이터 상태와 무관하게 빈 상태 안내가 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })
    mockTracked(null)

    render(<WeeklyScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText('낟낟')).not.toBeInTheDocument()
  })

  it('추적 목록이 빈 배열이면 로딩 상태여도 빈 상태 안내가 보인다', async () => {
    mockStore({
      status: 'loading',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })
    mockTracked([])

    render(<WeeklyScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument()
  })

  it('새로고침 버튼은 추적 캐릭터가 있으면 항상 존재하고 클릭하면 refresh가 다시 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenLastCalledWith(['ocid-1'])
  })

  it('status가 loading이면 로딩 표시를 보여준다', async () => {
    mockStore({ status: 'loading', characters: [character({ ocid: 'ocid-1' })] })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)

    expect(await screen.findByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', async () => {
    mockStore({
      status: 'error',
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)

    expect(await screen.findByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('드롭다운에 스토어가 반환한 추적 캐릭터들이 옵션으로 나온다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({ ocid: 'ocid-1', characterName: '낟낟' }),
        character({ ocid: 'ocid-2', characterName: '내옆에최성일' }),
      ],
    })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByRole('option', { name: '낟낟' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '내옆에최성일' })).toBeInTheDocument()
  })

  it('기본으로 첫 번째 추적 캐릭터가 선택돼 그 weeklyContents만 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          characterName: '낟낟',
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0 },
          ],
        }),
        character({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          weeklyContents: [
            { name: '[메이플 유니온] 주간 드래곤 퇴치', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0 },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/에픽 던전 : 악몽선경/)).toBeInTheDocument()
    expect(screen.queryByText(/주간 드래곤 퇴치/)).not.toBeInTheDocument()
  })

  it('드롭다운에서 다른 캐릭터를 선택하면 그 캐릭터의 weeklyContents로 화면이 바뀐다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          characterName: '낟낟',
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0 },
          ],
        }),
        character({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          weeklyContents: [
            { name: '[메이플 유니온] 주간 드래곤 퇴치', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0 },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<WeeklyScreen />)
    const dropdown = await screen.findByRole('combobox')
    fireEvent.change(dropdown, { target: { value: 'ocid-2' } })

    expect(screen.getByText(/주간 드래곤 퇴치/)).toBeInTheDocument()
    expect(screen.queryByText(/에픽 던전 : 악몽선경/)).not.toBeInTheDocument()
  })

  it('선택된 캐릭터가 isStale이면 상단에 에러 안내와 동기화 시각이 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          characterName: '낟낟',
          isStale: true,
          error: { kind: 'network' },
          syncedAt: null,
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/네트워크 오류가 발생했습니다/)).toBeInTheDocument()
    expect(screen.getByText(/동기화 기록 없음/)).toBeInTheDocument()
  })

  it('등록된 weeklyContents와 bosses가 둘 다 없고 isStale이 false면 빈 상태 안내가 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', weeklyContents: [], bosses: [], isStale: false })],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()
    expect(screen.queryByText(/네트워크 오류가 발생했습니다/)).not.toBeInTheDocument()
  })

  it('weeklyContents가 있으면 이름과 진행도를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0 },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/에픽 던전 : 악몽선경/)).toBeInTheDocument()
    expect(screen.getByText(/5\/0/)).toBeInTheDocument()
  })

  it('isRegistered: false인 weeklyContents 항목은 화면에 렌더링되지 않는다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0 },
            {
              name: '[메이플 유니온] 주간 드래곤 퇴치',
              kind: 'quest',
              isRegistered: false,
              nowCount: 0,
              maxCount: 0,
            },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/에픽 던전 : 악몽선경/)).toBeInTheDocument()
    expect(screen.queryByText(/주간 드래곤 퇴치/)).not.toBeInTheDocument()
  })

  it('보스는 matchedBossName이 있으면 그 이름을, null이면 apiName을 라벨로 보여주고 난이도를 함께 표시한다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          bosses: [
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
              apiName: '알수없는보스',
              difficulty: '노멀',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              matchedBossName: null,
              portraitSlug: null,
            },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/검은마법사 · 익스트림/)).toBeInTheDocument()
    expect(screen.getByText(/알수없는보스 · 노멀/)).toBeInTheDocument()
  })

  it('isComplete: true인 보스는 완료 아이콘, false인 보스는 미완료 아이콘으로 구분된다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          bosses: [
            {
              apiName: '보스A',
              difficulty: '노멀',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: true,
              matchedBossName: null,
              portraitSlug: null,
            },
            {
              apiName: '보스B',
              difficulty: '하드',
              cycle: 'weekly',
              isRegistered: true,
              isComplete: false,
              matchedBossName: null,
              portraitSlug: null,
            },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByRole('img', { name: '완료' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '미완료' })).toBeInTheDocument()
  })

  it('isRegistered: false인 보스 항목은 화면에 렌더링되지 않는다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          bosses: [
            {
              apiName: '자쿰',
              difficulty: '카오스',
              cycle: 'weekly',
              isRegistered: false,
              isComplete: false,
              matchedBossName: null,
              portraitSlug: null,
            },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.queryByText(/자쿰 · 카오스/)).not.toBeInTheDocument()
  })

  it('weeklyBossClearCount/weeklyBossClearLimitCount가 둘 다 있으면 n/12 형태 텍스트가 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', weeklyBossClearCount: 3, weeklyBossClearLimitCount: 12 })],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/3\/12/)).toBeInTheDocument()
  })

  it('weeklyBossClearCount/weeklyBossClearLimitCount 중 하나라도 null이면 카운터가 보이지 않는다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', weeklyBossClearCount: null, weeklyBossClearLimitCount: 12 })],
    })
    mockTracked(['ocid-1'])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    expect(screen.queryByText(/\/12/)).not.toBeInTheDocument()
  })

  it('캐릭터 관리 피커는 스토어의 characters가 아니라 getRegisteredCharacters의 전체 후보를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })
    mockTracked(['ocid-1'])
    mockedGetRegisteredCharacters.mockResolvedValue([
      mapleCharacter({ ocid: 'ocid-1', name: '낟낟' }),
      mapleCharacter({ ocid: 'ocid-2', name: '내옆에최성일' }),
    ])

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))

    expect(await screen.findByRole('checkbox', { name: '내옆에최성일' })).toBeInTheDocument()
  })

  it('캐릭터 관리 버튼으로 피커를 열고 저장하면 setTrackedCharacterOcids와 refresh가 새 목록으로 호출된다', async () => {
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

    render(<WeeklyScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '내옆에최성일' }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockedSetTrackedCharacterOcids).toHaveBeenCalledWith('weekly', ['ocid-1', 'ocid-2'])
    })
    await waitFor(() => {
      expect(refresh).toHaveBeenLastCalledWith(['ocid-1', 'ocid-2'])
    })
  })

  it('빈 상태 화면에서도 캐릭터 관리 버튼으로 피커를 열 수 있다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })
    mockTracked(null)

    render(<WeeklyScreen />)
    await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))

    expect(screen.getByTestId('character-tracking-picker-overlay')).toBeInTheDocument()
  })

  it('getRegisteredCharacters 호출이 실패해도 화면 전체는 정상 렌더링된다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })
    mockTracked(['ocid-1'])
    mockedGetRegisteredCharacters.mockRejectedValue(new Error('network'))

    render(<WeeklyScreen />)

    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })
})
