// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentScreen } from '../ContentScreen'
import { useContentSchedulerStore, type ContentCharacterView } from '../../../features/content-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../../../types'

vi.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: vi.fn(),
}))

vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
  getCharacterPickerRoster: vi.fn(),
}))

const mockedUseContentSchedulerStore = vi.mocked(useContentSchedulerStore)
const mockedGetCharacterPickerRoster = vi.mocked(getCharacterPickerRoster)

function mockStore(overrides: Partial<ReturnType<typeof useContentSchedulerStore>>): void {
  mockedUseContentSchedulerStore.mockReturnValue({
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    ...overrides,
  })
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

describe('ContentScreen', () => {
  it('추적 목록이 null이면 빈 상태 안내만 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: null,
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null }],
        }),
      ],
    })

    render(<ContentScreen />)

    expect(await screen.findByText('표시할 캐릭터가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('캐릭터를 선택하면 일간·주간 컨텐츠를 확인할 수 있습니다')).toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
  })

  it('빈 상태에서 중앙 CTA 버튼을 누르면 캐릭터 관리 피커가 열린다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: null,
      characters: [],
    })
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일', level: 211 })])
    })

    render(<ContentScreen />)
    await screen.findByText('표시할 캐릭터가 없습니다')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 선택하기' }))

    expect(await screen.findByRole('button', { name: /내옆에최성일/ })).toBeInTheDocument()
  })

  it('마운트 시 loadTrackedOcids가 호출된다', async () => {
    const loadTrackedOcids = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      loadTrackedOcids,
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(loadTrackedOcids).toHaveBeenCalledTimes(1)
  })

  it('sticky 헤더가 top-0으로 화면 최상단부터 덮어 스크롤 시 안전영역 뒤로 카드가 비치지 않는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
    })

    render(<ContentScreen />)
    const heading = await screen.findByRole('heading', { name: '컨텐츠 스케줄러' })
    const stickyEl = heading.closest('.sticky')

    expect(stickyEl).toHaveClass('top-0')
    expect(stickyEl).toHaveClass('pt-[calc(1rem+var(--sa-top))]')
    expect(stickyEl?.parentElement).toHaveClass('-mt-[var(--sa-top)]')
  })

  it('기본 탭은 일간이고 등록된 dailyContents만 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [
            { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
            { name: '미등록 콘텐츠', kind: 'contents', isRegistered: false, nowCount: 0, maxCount: 1, questState: null },
          ],
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.queryByText(/미등록 콘텐츠/)).not.toBeInTheDocument()
    expect(screen.queryByText(/에픽 던전 : 악몽선경/)).not.toBeInTheDocument()
  })

  it('"주간" 탭 버튼을 클릭하면 등록된 weeklyContents만 보이고 dailyContents는 안 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null }],
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0, questState: null },
            {
              name: '[메이플 유니온] 주간 드래곤 퇴치',
              kind: 'quest',
              isRegistered: false,
              nowCount: 0,
              maxCount: 0,
              questState: 0,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('악몽선경')).toBeInTheDocument()
    expect(screen.queryByText(/주간 드래곤 퇴치/)).not.toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
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

    render(<ContentScreen />)
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
          dailyContents: [{ name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null }],
        }),
        character({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          dailyContents: [{ name: '레브 던전', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 1, questState: null }],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    expect(screen.getByText(/레브 던전/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    fireEvent.click(screen.getByRole('button', { name: '일간' }))

    expect(screen.getByRole('combobox')).toHaveValue('ocid-2')
    expect(screen.getByText(/레브 던전/)).toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
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

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('button', { name: /내옆에최성일/ }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(saveTrackedOcids).toHaveBeenCalledWith(['ocid-1', 'ocid-2'], expect.any(Function))
    })
  })

  it('저장을 누르면 진행률 모달을 표시한다', async () => {
    // onProgress를 호출한 뒤 미해결 Promise를 반환해 "저장 중" 상태를 유지시킨다.
    const saveTrackedOcids = vi.fn((_ocids: string[], onProgress?: (c: number, t: number) => void) => {
      onProgress?.(1, 2)
      return new Promise<void>(() => {})
    })
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

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('button', { name: /내옆에최성일/ }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('캐릭터 정보를 저장하고 있어요 (1/2)')).toBeInTheDocument()
  })

  it('status가 loading이고 캐시된 characters도 없으면 로딩 표시를 보여준다', async () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], characters: [] })

    render(<ContentScreen />)

    expect(await screen.findByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('ADR-016: status가 loading이어도 캐시된 characters가 있으면 로딩 표시 대신 목록을 계속 보여준다', async () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null }],
        }),
      ],
    })

    render(<ContentScreen />)

    expect(await screen.findByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', async () => {
    mockStore({
      status: 'error',
      trackedOcids: ['ocid-1'],
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })

    render(<ContentScreen />)

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

    render(<ContentScreen />)
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

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText('조회 중...')).toBeInTheDocument()
    const icon = screen.getByRole('button', { name: '새로고침' }).querySelector('svg')
    expect(icon).toHaveClass('animate-spin')
  })

  it('ADR-020: kind가 quest인 일간 항목은 접두어를 제거한 이름과 quest_state 뱃지를 보여주고 now/max 표기는 없다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [
            {
              name: '[일일 퀘스트] 레헬른의 평온한 밤',
              kind: 'quest',
              isRegistered: true,
              nowCount: 0,
              maxCount: 0,
              questState: 1,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText('레헬른의 평온한 밤')).toBeInTheDocument()
    expect(screen.queryByText(/\[일일 퀘스트\]/)).not.toBeInTheDocument()
    expect(screen.getByText('진행 중')).toBeInTheDocument()
    expect(screen.getByAltText('')).toHaveAttribute('src', expect.stringContaining('lacheln'))
  })

  it('ADR-020: 몬스터파크는 배경+아이콘 카드로 렌더링되고 진행률 뱃지·진행률 바를 유지한다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [
            { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText('몬스터파크')).toBeInTheDocument()
    expect(screen.getByText('7/14')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7')
    expect(screen.getByAltText('')).toHaveAttribute('src', expect.stringContaining('monsterPark'))
  })

  it('일간 탭에서 등록된 dailyContents가 없고 isStale이 false면 빈 상태 안내가 그 탭에만 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [],
          weeklyContents: [
            { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0, questState: null },
          ],
          isStale: false,
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')

    expect(screen.getByText(/게임에서 스케줄러에 등록해주세요/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    expect(screen.queryByText(/게임에서 스케줄러에 등록해주세요/)).not.toBeInTheDocument()
    expect(screen.getByText('악몽선경')).toBeInTheDocument()
  })

  it('ADR-021: 에픽 던전 항목은 접두어가 뱃지로 분리되고 now_count에 따라 시작 안함/완료 뱃지를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '에픽 던전 : 하이마운틴', kind: 'contents', isRegistered: true, nowCount: 0, maxCount: 0, questState: null },
            { name: '에픽 던전 : 앵글러 컴퍼니', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getAllByText('에픽 던전')).toHaveLength(2)
    expect(screen.getByText('하이마운틴')).toBeInTheDocument()
    expect(screen.getByText('앵글러 컴퍼니')).toBeInTheDocument()
    expect(screen.getByText('시작 안함')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('ADR-021: 주간 지역 콘텐츠는 지역 아이콘·배경과 now_count 기반 완료 뱃지를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '에르다 스펙트럼', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 1, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('에르다 스펙트럼')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
    expect(screen.getByAltText('')).toHaveAttribute('src', expect.stringContaining('roadOfVanishing'))
  })

  it('무릉도장은 전용 아이콘·배경과 함께 now_count를 "N층"으로 보여준다(quest_state가 아닌 도달 층수)', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '무릉도장', kind: 'contents', isRegistered: true, nowCount: 37, maxCount: 100, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('무릉도장')).toBeInTheDocument()
    expect(screen.getByText('37층')).toBeInTheDocument()
    expect(screen.queryByText('완료')).not.toBeInTheDocument()
    expect(screen.getByAltText('')).toHaveAttribute('src', expect.stringContaining('muruengRaid'))
  })

  it('무릉도장은 참여 전(now_count 0)이면 "시작 안함"을 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '무릉도장', kind: 'contents', isRegistered: true, nowCount: 0, maxCount: 100, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('시작 안함')).toBeInTheDocument()
  })

  it('"[주간 퀘스트] " 접두어가 붙은 지역 콘텐츠는 접두어 없이 지역 아이콘·배경으로 표시된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[주간 퀘스트] 크리티아스 주간 임무',
              kind: 'contents',
              isRegistered: true,
              nowCount: 0,
              maxCount: 0,
              questState: 1,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('크리티아스 주간 임무')).toBeInTheDocument()
    expect(screen.queryByText(/\[주간 퀘스트\]/)).not.toBeInTheDocument()
    expect(screen.getByText('진행 중')).toBeInTheDocument()
    expect(screen.getByAltText('')).toHaveAttribute('src', expect.stringContaining('critias'))
  })

  it('보상형 주간 퀘스트("꾸준한 의뢰에 대한 보답")는 지역명이 포함되지 않아도 헤이븐으로 매칭된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[주간 퀘스트] 꾸준한 의뢰에 대한 보답',
              kind: 'contents',
              isRegistered: true,
              nowCount: 0,
              maxCount: 0,
              questState: 0,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('꾸준한 의뢰에 대한 보답')).toBeInTheDocument()
    expect(screen.getByText('시작 안함')).toBeInTheDocument()
    expect(screen.getByAltText('')).toHaveAttribute('src', expect.stringContaining('haven'))
  })

  it('성실한 조사에 대한 보답은 quest_state=1일 때 now_count를 "N회 완료"로 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[주간 퀘스트] 성실한 조사에 대한 보답',
              kind: 'contents',
              isRegistered: true,
              nowCount: 0,
              maxCount: 2,
              questState: 1,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('0회 완료')).toBeInTheDocument()
  })

  it('성실한 조사에 대한 보답은 now_count가 1일 때 "1회 완료"로 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[주간 퀘스트] 성실한 조사에 대한 보답',
              kind: 'contents',
              isRegistered: true,
              nowCount: 1,
              maxCount: 2,
              questState: 1,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('1회 완료')).toBeInTheDocument()
  })

  it('성실한 조사에 대한 보답은 now_count가 max_count와 같으면 "완료"로 전환된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[주간 퀘스트] 성실한 조사에 대한 보답',
              kind: 'contents',
              isRegistered: true,
              nowCount: 2,
              maxCount: 2,
              questState: 1,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('완료')).toBeInTheDocument()
    expect(screen.queryByText(/회 완료/)).not.toBeInTheDocument()
  })

  it('"[메이플 유니온] " 항목은 접두어 없이 드래곤 보스 배경의 카테고리 카드로 표시된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[메이플 유니온] 주간 드래곤 퇴치',
              kind: 'contents',
              isRegistered: true,
              nowCount: 0,
              maxCount: 0,
              questState: 0,
            },
            {
              name: '[메이플 유니온] PC방 주간 드래곤 퇴치',
              kind: 'contents',
              isRegistered: true,
              nowCount: 0,
              maxCount: 0,
              questState: 2,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getAllByText('유니온')).toHaveLength(2)
    expect(screen.getByText('주간 드래곤 퇴치')).toBeInTheDocument()
    expect(screen.getByText('PC방 주간 드래곤 퇴치')).toBeInTheDocument()
    expect(screen.getByText('시작 안함')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('"[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?"는 접두어 없이 몬스터파크 아이콘·배경과 quest_state 뱃지로 표시된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?',
              kind: 'contents',
              isRegistered: true,
              nowCount: 0,
              maxCount: 0,
              questState: 1,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('익스트림 몬스터파커에 도전해보겠나?')).toBeInTheDocument()
    expect(screen.queryByText(/\[몬스터파크\]/)).not.toBeInTheDocument()
    expect(screen.getByText('진행 중')).toBeInTheDocument()
    expect(screen.getByAltText('')).toHaveAttribute('src', expect.stringContaining('monsterPark'))
  })

  it.each([
    [0, '시작 안함'],
    [2, '완료'],
  ] as const)('익스트림 몬스터파커는 quest_state=%i면 "%s"을 보여준다', async (questState, label) => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            {
              name: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?',
              kind: 'contents',
              isRegistered: true,
              nowCount: 0,
              maxCount: 0,
              questState,
            },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('ADR-021 정정: 길드 지하 수로는 독립 카드로 표시되고 점수 뱃지를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '[길드] 지하 수로', kind: 'contents', isRegistered: true, nowCount: 13416, maxCount: 0, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('길드')).toBeInTheDocument()
    expect(screen.getByText('지하 수로')).toBeInTheDocument()
    expect(screen.getByText('13416점')).toBeInTheDocument()
    expect(screen.queryByText('[길드] 지하 수로')).not.toBeInTheDocument()
  })

  it('ADR-021 정정: 길드 주간 미션 포인트는 독립 카드로 표시되고 진행률 바를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '[길드] 주간 미션 포인트', kind: 'contents', isRegistered: true, nowCount: 10, maxCount: 10, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('길드')).toBeInTheDocument()
    expect(screen.getByText('주간 미션 포인트')).toBeInTheDocument()
    expect(screen.getByText('10/10')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('ADR-021 정정: 길드 플래그 레이스는 독립 카드로 표시되고 완료 뱃지를 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '[길드] 플래그 레이스', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 0, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('길드')).toBeInTheDocument()
    expect(screen.getByText('플래그 레이스')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('ADR-021 정정: 길드 항목은 서로 독립적으로 표시되어 일부만 등록돼도 나머지에 영향 없다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          ocid: 'ocid-1',
          weeklyContents: [
            { name: '[길드] 주간 미션 포인트', kind: 'contents', isRegistered: false, nowCount: 0, maxCount: 0, questState: null },
            { name: '[길드] 지하 수로', kind: 'contents', isRegistered: true, nowCount: 13416, maxCount: 0, questState: null },
            { name: '[길드] 플래그 레이스', kind: 'contents', isRegistered: false, nowCount: 0, maxCount: 0, questState: null },
          ],
        }),
      ],
    })

    render(<ContentScreen />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('지하 수로')).toBeInTheDocument()
    expect(screen.getByText('13416점')).toBeInTheDocument()
    expect(screen.queryByText('주간 미션 포인트')).not.toBeInTheDocument()
    expect(screen.queryByText('플래그 레이스')).not.toBeInTheDocument()
  })
})
