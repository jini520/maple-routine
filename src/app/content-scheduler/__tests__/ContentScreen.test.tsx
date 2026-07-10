// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentScreen } from '../ContentScreen'
import { useContentSchedulerStore, type ContentCharacterView } from '../../../features/content-scheduler/store'
import { getRegisteredCharacters } from '../../../features/schedule-sync/schedule-sync'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../../storage/character-selection'
import type { MapleCharacter } from '../../../types'

vi.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: vi.fn(),
}))

vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
  getRegisteredCharacters: vi.fn(),
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: vi.fn(),
  setTrackedCharacterOcids: vi.fn(),
}))

const mockedUseContentSchedulerStore = vi.mocked(useContentSchedulerStore)
const mockedGetRegisteredCharacters = vi.mocked(getRegisteredCharacters)
const mockedGetTrackedCharacterOcids = vi.mocked(getTrackedCharacterOcids)
const mockedSetTrackedCharacterOcids = vi.mocked(setTrackedCharacterOcids)

function mockStore(overrides: Partial<ReturnType<typeof useContentSchedulerStore>>): void {
  mockedUseContentSchedulerStore.mockReturnValue({
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

describe('ContentScreen', () => {
  it('추적 목록이 null이면 빈 상태 안내만 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 }],
        }),
      ],
    })
    mockTracked(null)

    render(<ContentScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
  })

  it('추적 목록이 로드되면 그 배열 그대로 refresh가 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1', 'ocid-2'])

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
  })

  it('기본 탭은 일간이고 등록된 dailyContents만 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [
            { name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 },
            { name: '미등록 콘텐츠', isRegistered: false, nowCount: 0, maxCount: 1 },
          ],
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0 },
          ],
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.queryByText(/미등록 콘텐츠/)).not.toBeInTheDocument()
    expect(screen.queryByText(/에픽 던전 : 악몽선경/)).not.toBeInTheDocument()
  })

  it('"주간" 탭 버튼을 클릭하면 등록된 weeklyContents만 보이고 dailyContents는 안 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '몬스터파크', isRegistered: true, nowCount: 7, maxCount: 14 }],
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

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText(/에픽 던전 : 악몽선경/)).toBeInTheDocument()
    expect(screen.queryByText(/주간 드래곤 퇴치/)).not.toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
  })

  it('탭을 전환해도 선택된 캐릭터(드롭다운 상태)가 유지된다', async () => {
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

    render(<ContentScreen />)
    const dropdown = await screen.findByRole('combobox')
    fireEvent.change(dropdown, { target: { value: 'ocid-2' } })
    expect(screen.getByText(/레브 던전/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    fireEvent.click(screen.getByRole('button', { name: '일간' }))

    expect(screen.getByRole('combobox')).toHaveValue('ocid-2')
    expect(screen.getByText(/레브 던전/)).toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
  })

  it('캐릭터 관리 피커로 저장하면 setTrackedCharacterOcids가 content로 호출된다', async () => {
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

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '내옆에최성일' }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockedSetTrackedCharacterOcids).toHaveBeenCalledWith('content', ['ocid-1', 'ocid-2'])
    })
    await waitFor(() => {
      expect(refresh).toHaveBeenLastCalledWith(['ocid-1', 'ocid-2'])
    })
  })

  it('status가 loading이면 로딩 표시를 보여준다', async () => {
    mockStore({ status: 'loading', characters: [character({ ocid: 'ocid-1' })] })
    mockTracked(['ocid-1'])

    render(<ContentScreen />)

    expect(await screen.findByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', async () => {
    mockStore({
      status: 'error',
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })
    mockTracked(['ocid-1'])

    render(<ContentScreen />)

    expect(await screen.findByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('새로고침 버튼을 클릭하면 refresh가 다시 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', characters: [character({ ocid: 'ocid-1' })], refresh })
    mockTracked(['ocid-1'])

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenLastCalledWith(['ocid-1'])
  })

  it('일간 탭에서 등록된 dailyContents가 없고 isStale이 false면 빈 상태 안내가 그 탭에만 보인다', async () => {
    mockStore({
      status: 'loaded',
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [],
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0 },
          ],
          isStale: false,
        }),
      ],
    })
    mockTracked(['ocid-1'])

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    expect(screen.queryByText(/게임에서 스케줄러에 등록해주세요/)).not.toBeInTheDocument()
    expect(screen.getByText(/에픽 던전 : 악몽선경/)).toBeInTheDocument()
  })
})
