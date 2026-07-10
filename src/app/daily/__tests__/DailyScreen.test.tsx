// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DailyScreen } from '../DailyScreen'
import { useDailySchedulerStore, type DailyCharacterView } from '../../../features/daily-scheduler/store'
import { getRegisteredCharacters } from '../../../features/schedule-sync/schedule-sync'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../../storage/character-selection'
import type { MapleCharacter } from '../../../types'

vi.mock('../../../features/daily-scheduler/store', () => ({
  useDailySchedulerStore: vi.fn(),
}))

vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
  getRegisteredCharacters: vi.fn(),
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: vi.fn(),
  setTrackedCharacterOcids: vi.fn(),
}))

const mockedUseDailySchedulerStore = vi.mocked(useDailySchedulerStore)
const mockedGetRegisteredCharacters = vi.mocked(getRegisteredCharacters)
const mockedGetTrackedCharacterOcids = vi.mocked(getTrackedCharacterOcids)
const mockedSetTrackedCharacterOcids = vi.mocked(setTrackedCharacterOcids)

function mockStore(overrides: Partial<ReturnType<typeof useDailySchedulerStore>>): void {
  mockedUseDailySchedulerStore.mockReturnValue({
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

describe('DailyScreen', () => {
  it('추적 목록이 로드되면 그 배열 그대로 refresh가 호출된다(계정 전체가 아니라)', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
  })

  it('추적 목록이 null이면 refresh가 호출되지 않는다', async () => {
    const refresh = vi.fn()
    mockStore({ refresh })
    mockTracked(null)

    render(<DailyScreen />)
    await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')

    expect(refresh).not.toHaveBeenCalled()
  })

  it('추적 목록이 null이면 캐릭터 데이터 상태와 무관하게 빈 상태 안내가 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })
    mockTracked(null)

    render(<DailyScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText('낟낟')).not.toBeInTheDocument()
  })

  it('추적 목록이 빈 배열이면 로딩 상태여도 빈 상태 안내가 보인다', async () => {
    mockStore({
      status: 'loading',
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })
    mockTracked([])

    render(<DailyScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument()
  })

  it('새로고침 버튼은 추적 캐릭터가 있으면 항상 존재하고 클릭하면 refresh가 다시 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1'])

    render(<DailyScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenLastCalledWith(['ocid-1'])
  })

  it('status가 loading이면 로딩 표시를 보여준다', async () => {
    mockStore({ status: 'loading', characters: [character({ ocid: 'ocid-1' })] })
    mockTracked(['ocid-1'])

    render(<DailyScreen />)

    expect(await screen.findByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', async () => {
    mockStore({
      status: 'error',
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })
    mockTracked(['ocid-1'])

    render(<DailyScreen />)

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

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByRole('option', { name: '낟낟' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '내옆에최성일' })).toBeInTheDocument()
  })

  it('기본으로 첫 번째 추적 캐릭터가 선택돼 그 dailyContents만 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          characterName: '낟낟',
          dailyContents: [{ name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 }],
        }),
        character({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          dailyContents: [{ name: '레브 던전', isRegistered: true, nowCount: 1, maxCount: 1 }],
        }),
      ],
    })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.queryByText(/레브 던전/)).not.toBeInTheDocument()
  })

  it('드롭다운에서 다른 캐릭터를 선택하면 그 캐릭터의 dailyContents로 화면이 바뀐다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          characterName: '낟낟',
          dailyContents: [{ name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 }],
        }),
        character({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          dailyContents: [{ name: '레브 던전', isRegistered: true, nowCount: 1, maxCount: 1 }],
        }),
      ],
    })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<DailyScreen />)
    const dropdown = await screen.findByRole('combobox')
    fireEvent.change(dropdown, { target: { value: 'ocid-2' } })

    expect(screen.getByText(/레브 던전/)).toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
  })

  it('선택된 캐릭터가 isStale이면 상단에 에러 안내가 보인다', async () => {
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

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/네트워크 오류가 발생했습니다/)).toBeInTheDocument()
    expect(screen.getByText(/동기화 기록 없음/)).toBeInTheDocument()
  })

  it('registeredContents가 비어있고 isStale이 false면 빈 상태 안내가 보이고 에러 문구는 없다', async () => {
    mockStore({
      status: 'loaded',
      characters: [character({ ocid: 'ocid-1', dailyContents: [], isStale: false })],
    })
    mockTracked(['ocid-1'])

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()
    expect(screen.queryByText(/네트워크 오류가 발생했습니다/)).not.toBeInTheDocument()
  })

  it('isRegistered: false인 dailyContents 항목은 화면에 렌더링되지 않는다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [
            { name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 },
            { name: '미등록 콘텐츠', isRegistered: false, nowCount: 0, maxCount: 1 },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.queryByText(/미등록 콘텐츠/)).not.toBeInTheDocument()
  })

  it('dailyContents가 있으면 이름/진행도와 진행바를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 }],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.getByText(/7\/14/)).toBeInTheDocument()

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '7')
    expect(progressBar).toHaveAttribute('aria-valuemax', '14')
  })

  it('maxCount가 0이면 진행바 없이 텍스트만 보여준다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '보스 물욕템', isRegistered: true, nowCount: 0, maxCount: 0 }],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/보스 물욕템/)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
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

    render(<DailyScreen />)
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

    render(<DailyScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '내옆에최성일' }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockedSetTrackedCharacterOcids).toHaveBeenCalledWith('daily', ['ocid-1', 'ocid-2'])
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

    render(<DailyScreen />)
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

    render(<DailyScreen />)

    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })
})
