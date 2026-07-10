// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailyScreen } from '../DailyScreen'
import { useDailySchedulerStore, type DailyCharacterView } from '../../../features/daily-scheduler/store'

vi.mock('../../../features/daily-scheduler/store', () => ({
  useDailySchedulerStore: vi.fn(),
}))

const mockedUseDailySchedulerStore = vi.mocked(useDailySchedulerStore)

function mockStore(overrides: Partial<ReturnType<typeof useDailySchedulerStore>>): void {
  mockedUseDailySchedulerStore.mockReturnValue({
    status: 'idle',
    characters: [],
    error: null,
    refresh: vi.fn(),
    ...overrides,
  })
}

function character(overrides: Partial<DailyCharacterView> = {}): DailyCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터1',
    dailyContents: [],
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

describe('DailyScreen', () => {
  it('마운트 시 refresh가 정확히 1번 호출된다', () => {
    const refresh = vi.fn()
    mockStore({ refresh })

    render(<DailyScreen />)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('새로고침 버튼은 항상 존재하고 클릭하면 refresh가 다시 호출된다', () => {
    const refresh = vi.fn()
    mockStore({ refresh })

    render(<DailyScreen />)
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('status가 loading이면 로딩 표시를 보여준다', () => {
    mockStore({ status: 'loading' })

    render(<DailyScreen />)

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', () => {
    mockStore({ status: 'error', error: { kind: 'invalidApiKey' } })

    render(<DailyScreen />)

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

    render(<DailyScreen />)

    expect(screen.getByText('낟낟')).toBeInTheDocument()
    expect(screen.getByText(/네트워크 오류가 발생했습니다/)).toBeInTheDocument()
    expect(screen.getByText(/동기화 기록 없음/)).toBeInTheDocument()
  })

  it('dailyContents가 비어있고 isStale이 false면 빈 상태 안내가 보이고 에러 문구는 없다', () => {
    mockStore({
      status: 'loaded',
      characters: [character({ dailyContents: [], isStale: false })],
    })

    render(<DailyScreen />)

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()
    expect(screen.queryByText(/네트워크 오류가 발생했습니다/)).not.toBeInTheDocument()
  })

  it('dailyContents가 있으면 이름/등록 여부/진행도를 보여준다', () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          dailyContents: [{ name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 }],
        }),
      ],
    })

    render(<DailyScreen />)

    expect(screen.getByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.getByText(/7\/14/)).toBeInTheDocument()
  })
})
