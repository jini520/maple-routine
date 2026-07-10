// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WeeklyScreen } from '../WeeklyScreen'
import { useWeeklySchedulerStore, type WeeklyCharacterView } from '../../../features/weekly-scheduler/store'

vi.mock('../../../features/weekly-scheduler/store', () => ({
  useWeeklySchedulerStore: vi.fn(),
}))

const mockedUseWeeklySchedulerStore = vi.mocked(useWeeklySchedulerStore)

function mockStore(overrides: Partial<ReturnType<typeof useWeeklySchedulerStore>>): void {
  mockedUseWeeklySchedulerStore.mockReturnValue({
    status: 'idle',
    characters: [],
    error: null,
    refresh: vi.fn(),
    ...overrides,
  })
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

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WeeklyScreen', () => {
  it('마운트 시 refresh가 정확히 1번 호출된다', () => {
    const refresh = vi.fn()
    mockStore({ refresh })

    render(<WeeklyScreen />)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('새로고침 버튼은 항상 존재하고 클릭하면 refresh가 다시 호출된다', () => {
    const refresh = vi.fn()
    mockStore({ refresh })

    render(<WeeklyScreen />)
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('status가 loading이면 로딩 표시를 보여준다', () => {
    mockStore({ status: 'loading' })

    render(<WeeklyScreen />)

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', () => {
    mockStore({ status: 'error', error: { kind: 'invalidApiKey' } })

    render(<WeeklyScreen />)

    expect(screen.getByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('캐릭터가 isStale이면 그 캐릭터 영역에 에러 문구와 동기화 시각이 보인다', () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          characterName: '낟낟',
          isStale: true,
          error: { kind: 'network' },
          syncedAt: null,
        }),
      ],
    })

    render(<WeeklyScreen />)

    expect(screen.getByText('낟낟')).toBeInTheDocument()
    expect(screen.getByText(/네트워크 오류가 발생했습니다/)).toBeInTheDocument()
    expect(screen.getByText(/동기화 기록 없음/)).toBeInTheDocument()
  })

  it('weeklyContents와 bosses가 둘 다 비어있고 isStale이 false면 빈 상태 안내가 보인다', () => {
    mockStore({
      status: 'loaded',
      characters: [character({ weeklyContents: [], bosses: [], isStale: false })],
    })

    render(<WeeklyScreen />)

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()
    expect(screen.queryByText(/네트워크 오류가 발생했습니다/)).not.toBeInTheDocument()
  })

  it('weeklyContents가 있으면 이름/등록 여부/진행도를 보여준다', () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0 },
          ],
        }),
      ],
    })

    render(<WeeklyScreen />)

    expect(screen.getByText(/에픽 던전 : 악몽선경/)).toBeInTheDocument()
    expect(screen.getByText(/5\/0/)).toBeInTheDocument()
  })

  it('보스는 matchedBossName이 있으면 그 이름을, null이면 apiName을 라벨로 보여준다', () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
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

    render(<WeeklyScreen />)

    expect(screen.getAllByText(/검은마법사/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/알수없는보스/).length).toBeGreaterThan(0)
  })

  it('weeklyBossClearCount/weeklyBossClearLimitCount가 둘 다 있으면 n/12 형태 텍스트가 보인다', () => {
    mockStore({
      status: 'loaded',
      characters: [character({ weeklyBossClearCount: 3, weeklyBossClearLimitCount: 12 })],
    })

    render(<WeeklyScreen />)

    expect(screen.getByText(/3\/12/)).toBeInTheDocument()
  })

  it('weeklyBossClearCount/weeklyBossClearLimitCount 중 하나라도 null이면 카운터가 보이지 않는다', () => {
    mockStore({
      status: 'loaded',
      characters: [character({ weeklyBossClearCount: null, weeklyBossClearLimitCount: 12 })],
    })

    render(<WeeklyScreen />)

    expect(screen.queryByText(/\/12/)).not.toBeInTheDocument()
  })
})
