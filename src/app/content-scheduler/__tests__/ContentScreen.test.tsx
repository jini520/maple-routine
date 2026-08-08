// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentScreen } from '../ContentScreen'
import { PULL_SETTLE_TRANSITION } from '../../../lib/pull-to-refresh'
import { useContentSchedulerStore, type ContentCharacterView } from '../../../features/content-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { NexonAuthError } from '../../../nexon/errors'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import type { CharacterPickerEntry } from '../../../types'
// ADR-063: 동기화 실패·일부 캐릭터 실패·파티원 수 저장 실패는 인라인 문단이 아니라 토스트로 알린다.
const { showErrorMock, noticeApiKeyInvalidMock } = vi.hoisted(() => ({
  showErrorMock: vi.fn(),
  noticeApiKeyInvalidMock: vi.fn(),
}))
vi.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))

// ADR-115 결정 7: 401은 동기화 토스트도 피커 로스터도 이 진입점 하나로 위임한다.
vi.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyInvalid: noticeApiKeyInvalidMock }) },
}))


vi.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: vi.fn(),
}))

// ADR-062: 화면이 toScheduleSyncError로 reject를 원인으로 변환하므로, 그 매핑은 실물을 쓰고
// getCharacterPickerRoster만 대체한다(부분 모킹).
vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: vi.fn(),
}))

const mockedUseContentSchedulerStore = vi.mocked(useContentSchedulerStore)
const mockedGetCharacterPickerRoster = vi.mocked(getCharacterPickerRoster)

// ADR-096: 탭이 스토어로 올라가면서 정적 mockReturnValue로는 탭 전환이 렌더에 반영되지 않는다
// (setActiveTab을 불러도 다시 그릴 이유가 없다). 모킹된 훅도 컴포넌트 렌더 중에 불리므로,
// 여기서 useState로 실물 스토어와 같은 "값 + 세터" 쌍을 흉내 낸다. 탭 상태 자체의 수명은
// ContentScreen.view-state.test.tsx가 실물 스토어로 검증한다.
function mockStore(overrides: Partial<ReturnType<typeof useContentSchedulerStore>>): void {
  const base = {
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    manualTrackedByOcid: {},
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    addManualContent: vi.fn(),
    removeManualContent: vi.fn(),
    activeTab: 'daily' as const,
    setActiveTab: vi.fn(),
    ...overrides,
  } satisfies ReturnType<typeof useContentSchedulerStore>

  mockedUseContentSchedulerStore.mockImplementation(() => {
    const [activeTab, setActiveTab] = useState(base.activeTab)
    return { ...base, activeTab, setActiveTab }
  })
}

// ContentScreen이 "컨텐츠 관리" 진입에 라우터 내비게이션을 쓰므로 MemoryRouter로 감싼다.
// /content/manage에는 프로브 요소를 둬 내비게이션 발생 여부를 검증할 수 있게 한다.
// rerender로 스토어 상태 변화(예: 재조회 시작)를 흘려보내려면 같은 트리를 다시 넘겨야 한다.
function contentScreenTree(): React.JSX.Element {
  return (
    <MemoryRouter initialEntries={['/content']}>
      <Routes>
        <Route path="/content" element={<ContentScreen />} />
        <Route path="/content/manage" element={<div>관리 페이지 프로브</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderContentScreen(): ReturnType<typeof render> {
  return render(contentScreenTree())
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
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('ContentScreen', () => {
  it('추적 목록이 빈 배열이면 빈 상태 안내만 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: [],
      characters: [
        character({
          ocid: 'ocid-1',
          dailyContents: [{ name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null }],
        }),
      ],
    })

    renderContentScreen()

    expect(await screen.findByText('표시할 캐릭터가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('캐릭터를 선택하면 일간·주간 컨텐츠를 확인할 수 있습니다')).toBeInTheDocument()
    expect(screen.queryByText(/몬스터파크/)).not.toBeInTheDocument()
  })

  // [[ADR-101]] 결정 1: `null` 은 "0명"이 아니라 "저장소를 아직 안 읽었다"다. 둘을 같이 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다.
  it('추적 목록이 null(미로드)이면 빈 상태가 아니라 로딩을 보여준다', async () => {
    mockStore({ status: 'idle', trackedOcids: null, characters: [] })

    renderContentScreen()

    expect(await screen.findByText(/불러오고 있어요/)).toBeInTheDocument()
    expect(screen.queryByText('표시할 캐릭터가 없습니다')).not.toBeInTheDocument()
  })

  it('빈 상태에서 중앙 CTA 버튼을 누르면 캐릭터 관리 피커가 열린다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: [],
      characters: [],
    })
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일', level: 211 })])
    })

    renderContentScreen()
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

    renderContentScreen()
    await screen.findByRole('combobox')

    expect(loadTrackedOcids).toHaveBeenCalledTimes(1)
  })

  // ADR-098 결정 2: 헤더는 `sticky` 가 아니라 `fixed` 다 — sticky 요소의 화면 위치는 스크롤
  // 오프셋의 함수라, iOS 스크롤 스레드가 옛 오프셋을 되돌려 보내는 프레임에 헤더가 화면 밖으로
  // 날아간다(탭 복귀 시 관측). 노치까지 bg-bg 로 덮는다는 원래 계약은 그대로다.
  it('고정 헤더가 top-0으로 화면 최상단부터 덮고, 흐름에는 실측 높이 spacer 가 남는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
    })

    renderContentScreen()
    const heading = await screen.findByRole('heading', { name: '컨텐츠 스케줄러' })
    const headerEl = heading.closest('.fixed')

    expect(headerEl).toHaveClass('top-0')
    expect(headerEl).toHaveClass('inset-x-0')
    expect(headerEl).toHaveClass('pt-[calc(1rem+var(--sa-top))]')
    expect(heading.closest('.sticky')).toBeNull()
    // 헤더가 흐름에서 빠진 자리는 래퍼 안 spacer 가 채운다.
    const wrapper = headerEl?.parentElement
    expect(wrapper?.lastElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  // ADR-099 — 이 화면은 문서가 아니라 **자기 스크롤 컨테이너**를 스크롤한다. 스크롤 상태가 그 DOM
  // 요소에 붙으므로 화면과 함께 사라지고, 다른 탭이 오프셋을 물려받을 수 없다. 컨테이너의 기하
  // (안전영역·탭바 인셋과 그 보정)는 공용 셸 ScreenScroll 이 갖는다 — 여기서는 연결만 본다.
  describe('화면 스크롤 컨테이너 (ADR-099)', () => {
    async function renderLoaded(): Promise<void> {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [character({ ocid: 'ocid-1' })],
      })
      renderContentScreen()
      await screen.findByRole('heading', { name: '컨텐츠 스케줄러' })
    }

    it('헤더와 목록이 공용 스크롤 셸 안에 있다', async () => {
      await renderLoaded()

      const scroller = screen.getByTestId('screen-scroll')
      expect(scroller).toContainElement(screen.getByTestId('pull-content'))
      expect(scroller).toContainElement(screen.getByRole('heading', { name: '컨텐츠 스케줄러' }))
    })

    it('모달은 셸 바깥에 그려진다 — 안에 두면 z-50 이 셸의 스태킹 컨텍스트에 갇힌다', async () => {
      await renderLoaded()

      fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))

      const modal = await screen.findByRole('heading', { name: '캐릭터 관리' })
      expect(screen.getByTestId('screen-scroll')).not.toContainElement(modal)
    })
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    fireEvent.click(await screen.findByRole('button', { name: /내옆에최성일/ }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('캐릭터 정보를 저장하고 있어요 (1/2)')).toBeInTheDocument()
  })

  it('status가 loading이고 캐시된 characters도 없으면 로딩 표시를 보여준다', async () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], characters: [] })

    renderContentScreen()

    expect(await screen.findByText(/불러오고 있어요/)).toBeInTheDocument()
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

    renderContentScreen()

    expect(await screen.findByText(/몬스터파크/)).toBeInTheDocument()
    expect(screen.queryByText(/불러오고 있어요/)).not.toBeInTheDocument()
  })

  // ADR-115 결정 1·7: 401은 이 화면이 토스트로 알리지 않는다 — 문구·이동·저장소 삭제가 전부
  // noticeApiKeyInvalid() 안에 있다. 여기서 확인할 것은 그 진입점에 도달하는가뿐이다.
  it('status가 error이고 401이면 토스트 대신 키 무효화 경로로 넘긴다', async () => {
    mockStore({
      status: 'error',
      trackedOcids: ['ocid-1'],
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })

    renderContentScreen()

    await waitFor(() => expect(noticeApiKeyInvalidMock).toHaveBeenCalledTimes(1))
    expect(showErrorMock).not.toHaveBeenCalled()
    expect(screen.queryByText('API 키가 유효하지 않습니다')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '설정 열기' })).not.toBeInTheDocument()
  })

  it('network 실패는 토스트에 다시 시도 액션을 붙이고, 누르면 refresh가 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'error',
      trackedOcids: ['ocid-1'],
      error: { kind: 'network' },
      characters: [character({ ocid: 'ocid-1' })],
      refresh,
    })

    renderContentScreen()

    await waitFor(() => expect(showErrorMock).toHaveBeenCalled())
    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('네트워크 오류가 발생했습니다')
    expect(action.label).toBe('다시 시도')

    action.onClick()
    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  it('새로고침 버튼을 클릭하면 refresh가 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      refresh,
    })

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
    await screen.findByRole('combobox')

    expect(screen.getByText('등록된 일간 컨텐츠가 없습니다')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    expect(screen.queryByText('등록된 일간 컨텐츠가 없습니다')).not.toBeInTheDocument()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
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

    renderContentScreen()
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByText('지하 수로')).toBeInTheDocument()
    expect(screen.getByText('13416점')).toBeInTheDocument()
    expect(screen.queryByText('주간 미션 포인트')).not.toBeInTheDocument()
    expect(screen.queryByText('플래그 레이스')).not.toBeInTheDocument()
  })

  describe('ADR-035: 수동 트래킹 모드', () => {
    it('수동 모드: 게임 등록 여부(isRegistered)와 무관하게 추적 중인 항목을 동기화 값과 함께 표시한다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }] },
        characters: [
          character({
            ocid: 'ocid-1',
            // isRegistered: false여도 수동 모드에서는 추적 목록에 있으면 보인다
            dailyContents: [
              { name: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 9, maxCount: 14, questState: null },
            ],
          }),
        ],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      expect(screen.getByText('몬스터파크')).toBeInTheDocument()
      expect(screen.getByText('9/14')).toBeInTheDocument()
    })

    it('수동 모드: 표시 순서는 추가한 순서가 아니라 컨텐츠 관리(템플릿) 순서로 고정된다 (ADR-035 결정 20)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      // 멤버십은 템플릿 역순으로 추가(세르니움=템플릿 10번째가 먼저, 소멸의 여로=1번째가 나중).
      // 표시는 템플릿 순서(소멸의 여로 → 세르니움)로 나와야 한다.
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: {
          'ocid-1': [
            { contentName: '[일일 퀘스트] 세르니움 조사', kind: 'daily' },
            { contentName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'daily' },
          ],
        },
        characters: [character({ ocid: 'ocid-1', dailyContents: [] })],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      const rows = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
      const idxSomyeol = rows.findIndex((t) => t.includes('소멸의 여로 조사'))
      const idxSereu = rows.findIndex((t) => t.includes('세르니움 조사'))
      expect(idxSomyeol).toBeGreaterThanOrEqual(0)
      expect(idxSereu).toBeGreaterThan(idxSomyeol)
    })

    it('수동 모드 주간 탭: 표시 순서도 컨텐츠 관리(카테고리 정렬) 순서로 고정된다 (ADR-035 결정 20)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      // 멤버십은 [무릉도장, 에픽던전 하이마운틴]로 추가하지만, 컨텐츠 관리 순서상 에픽 던전이
      // 무릉도장보다 앞이므로 "하이마운틴"이 "무릉도장"보다 먼저 나와야 한다.
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: {
          'ocid-1': [
            { contentName: '무릉도장', kind: 'weekly' },
            { contentName: '에픽 던전 : 하이마운틴', kind: 'weekly' },
          ],
        },
        characters: [character({ ocid: 'ocid-1', weeklyContents: [] })],
      })

      renderContentScreen()
      await screen.findByRole('combobox')
      fireEvent.click(screen.getByRole('button', { name: '주간' }))

      const rows = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
      const idxEpic = rows.findIndex((t) => t.includes('하이마운틴'))
      const idxMulung = rows.findIndex((t) => t.includes('무릉도장'))
      expect(idxEpic).toBeGreaterThanOrEqual(0)
      expect(idxMulung).toBeGreaterThan(idxEpic)
    })

    it('수동 모드: 한 번도 동기화된 적 없는 항목은 템플릿 기본값으로 표시한다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [{ contentName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'daily' }] },
        characters: [character({ ocid: 'ocid-1', dailyContents: [] })],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      // 접두어 제거된 이름 + 템플릿의 quest_state 0("시작 안함")
      expect(screen.getByText('소멸의 여로 조사')).toBeInTheDocument()
      expect(screen.getByText('시작 안함')).toBeInTheDocument()
    })

    it('수동 모드: 항목은 자기 kind의 탭에만 나온다 — 일간/주간 섞임 회귀 방지 (ADR-035 결정 19)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: {
          'ocid-1': [
            { contentName: '몬스터파크', kind: 'daily' },
            { contentName: '무릉도장', kind: 'weekly' },
          ],
        },
        characters: [character({ ocid: 'ocid-1' })],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      // 일간 탭: 일간 항목만
      expect(screen.getByText('몬스터파크')).toBeInTheDocument()
      expect(screen.queryByText('무릉도장')).not.toBeInTheDocument()

      // 주간 탭: 주간 항목만
      fireEvent.click(screen.getByRole('button', { name: '주간' }))
      expect(screen.getByText('무릉도장')).toBeInTheDocument()
      expect(screen.queryByText('몬스터파크')).not.toBeInTheDocument()
    })

    it('수동 모드: 헤더의 "컨텐츠 관리"를 누르면 관리 페이지로 이동한다 (ADR-035 결정 18)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [] },
        characters: [character({ ocid: 'ocid-1' })],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      // 추적 항목이 0건이라 빈 상태 CTA(ADR-060)도 같은 라벨을 쓴다 — 첫 번째가 헤더 버튼이다.
      fireEvent.click(screen.getAllByRole('button', { name: '컨텐츠 관리' })[0])

      expect(await screen.findByText('관리 페이지 프로브')).toBeInTheDocument()
    })

    // ADR-060: 빈 상태 문구가 "컨텐츠 관리에서 골라주세요"라고 지시하면 실제로 그리로 데려가야 한다.
    it('수동 모드: 빈 상태의 "컨텐츠 관리" CTA를 누르면 관리 페이지로 이동한다 (ADR-060)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [] },
        characters: [character({ ocid: 'ocid-1' })],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      const buttons = screen.getAllByRole('button', { name: '컨텐츠 관리' })
      expect(buttons).toHaveLength(2) // 헤더 + 빈 상태 CTA
      fireEvent.click(buttons[1])

      expect(await screen.findByText('관리 페이지 프로브')).toBeInTheDocument()
    })

    it('수동 모드에서도 카드 위 삭제 버튼과 "+ 항목 추가"는 렌더링되지 않는다 (ADR-035 결정 18 — 편집은 관리 페이지 전용)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }] },
        characters: [
          character({
            ocid: 'ocid-1',
            dailyContents: [
              { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
            ],
          }),
        ],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      expect(screen.queryByRole('button', { name: '+ 항목 추가' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '몬스터파크 삭제' })).not.toBeInTheDocument()
    })

    it('수동 모드: 추적 항목이 없으면 "컨텐츠 관리" 안내 빈 상태를 보여준다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [] },
        characters: [character({ ocid: 'ocid-1' })],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      expect(screen.getByText('추적할 일간 컨텐츠가 없습니다')).toBeInTheDocument()
    })

    it('자동 모드에서는 "컨텐츠 관리" 버튼이 렌더링되지 않는다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        characters: [
          character({
            ocid: 'ocid-1',
            dailyContents: [
              { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
            ],
          }),
        ],
      })

      renderContentScreen()
      await screen.findByRole('combobox')

      expect(screen.queryByRole('button', { name: '컨텐츠 관리' })).not.toBeInTheDocument()
    })
  })
})

// ADR-053 결정 3: 후보 목록 조회의 로딩·실패는 화면(app/)이 getCharacterPickerRoster의 Promise로
// 판정해 피커에 props로 내려준다 — 컴포넌트는 조회하지 않는다.
describe('ContentScreen — 캐릭터 관리 피커 후보 목록 로딩 (ADR-053)', () => {
  // resolve/reject 시점을 테스트가 제어할 수 있도록 미해결 Promise를 반환하는 모의 구현.
  // 피커를 다시 열면 mockImplementation이 다시 불려 새 Promise로 교체된다.
  function deferRoster(): {
    emit: (entries: CharacterPickerEntry[]) => void
    resolve: () => Promise<void>
    reject: (error: unknown) => Promise<void>
  } {
    let onUpdateRef: (entries: CharacterPickerEntry[]) => void = () => {}
    let resolveRef: () => void = () => {}
    let rejectRef: (error: unknown) => void = () => {}

    mockedGetCharacterPickerRoster.mockImplementation((onUpdate) => {
      onUpdateRef = onUpdate
      return new Promise<void>((resolve, reject) => {
        resolveRef = resolve
        rejectRef = reject
      })
    })

    return {
      emit: (entries) => act(() => onUpdateRef(entries)),
      resolve: () => act(async () => resolveRef()),
      reject: (error) => act(async () => rejectRef(error)),
    }
  }

  async function renderAndOpenPicker(): Promise<void> {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1', characterName: '낟낟' })],
    })

    renderContentScreen()
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
  }

  it('조회 중이고 보여줄 항목이 없으면 스피너를 보여준다', async () => {
    deferRoster()

    await renderAndOpenPicker()

    expect(await screen.findByTestId('maple-sweep-spinner')).toBeInTheDocument()
    expect(screen.queryByText('표시할 캐릭터가 없어요')).not.toBeInTheDocument()
  })

  it('콜드 스타트: 조회가 끝나면 스피너가 사라지고 목록이 보인다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await screen.findByTestId('maple-sweep-spinner')

    roster.emit([pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일', level: 211 })])
    await roster.resolve()

    expect(screen.getByRole('button', { name: /내옆에최성일/ })).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  it('ADR-016 웜 캐시: 조회가 끝나기 전에 항목이 도착하면 스피너 없이 바로 목록을 보여준다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    roster.emit([pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일', level: 211 })])

    expect(screen.getByRole('button', { name: /내옆에최성일/ })).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  it('전역 실패(401/429)로 reject되면 스피너가 걷히고 실패 안내를 보여준다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await screen.findByTestId('maple-sweep-spinner')

    await roster.reject(new Error('401'))

    expect(screen.getByText('캐릭터 목록을 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  it('피커를 닫았다 다시 열면 실패 상태가 초기화되고 다시 조회한다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new Error('401'))
    await screen.findByText('캐릭터 목록을 불러오지 못했습니다')

    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))

    expect(await screen.findByTestId('maple-sweep-spinner')).toBeInTheDocument()
    expect(screen.queryByText('캐릭터 목록을 불러오지 못했습니다')).not.toBeInTheDocument()
    expect(mockedGetCharacterPickerRoster).toHaveBeenCalledTimes(2)
  })

  // ADR-115 결정 7: 감지 지점은 동기화 토스트만이 아니다 — 피커 로스터가 맞는 401도 같은 키
  // 무효화이므로 같은 진입점을 부른다(위 케이스들의 `new Error('401')`은 network로 떨어진다).
  it('로스터 조회가 401로 실패하면 키 무효화 경로로 넘긴다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new NexonAuthError('Nexon API 키가 유효하지 않습니다'))

    await waitFor(() => expect(noticeApiKeyInvalidMock).toHaveBeenCalledTimes(1))
  })

  it('로스터 조회가 401이 아닌 실패면 키 무효화 경로를 타지 않는다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new Error('network'))
    await screen.findByText('캐릭터 목록을 불러오지 못했습니다')

    expect(noticeApiKeyInvalidMock).not.toHaveBeenCalled()
  })
})


// ADR-083 결정 1: 캐릭터별 실패도 인라인 문단이 아니라 토스트다(보스 스케줄러와 동일).
describe('선택 캐릭터 실패 (ADR-083 결정 1)', () => {
  it('isStale이지만 error가 없으면(캐시 우선 표시) 아무것도 알리지 않는다', () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      characters: [character({ isStale: true, error: null })],
    })

    renderContentScreen()

    // 문구가 없을 뿐 아니라 빈 <p>도 없어야 한다(레이아웃이 튀는 원인이었다)
    expect(document.querySelectorAll('p.text-error-ink')).toHaveLength(0)
    expect(showErrorMock).not.toHaveBeenCalled()
  })

  it('실제 실패는 인라인 문단이 아니라 토스트로 알린다', () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      characters: [character({ isStale: true, error: { kind: 'network' } })],
      refresh,
    })

    renderContentScreen()

    expect(screen.queryByText('네트워크 오류가 발생했습니다')).not.toBeInTheDocument()
    expect(document.querySelectorAll('p.text-error-ink')).toHaveLength(0)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('네트워크 오류가 발생했습니다')
    expect(action.label).toBe('다시 시도')
    action.onClick()
    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  it('characterUnavailable 토스트에는 액션을 붙이지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      characters: [character({ isStale: true, error: { kind: 'characterUnavailable' } })],
    })

    renderContentScreen()

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('이 캐릭터는 조회할 수 없습니다')
    expect(action).toBeUndefined()
  })
})

// ADR-072: 목록 최상단에서 당기면 헤더 새로고침 버튼과 같은 재조회가 돈다(제스처는 추가 수단이다).
// jsdom에는 TouchEvent 생성자가 없으므로 훅이 읽는 필드(touches[].clientY)만 가진 합성 이벤트를 만든다.
// window.scrollY는 jsdom 기본값이 0이라 최상단 판정(window.scrollY <= 0)을 그대로 통과한다.
function touchEvent(type: string, clientY?: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: clientY === undefined ? [] : [{ clientY }],
  })
  return event
}

describe('당겨서 새로고침 (ADR-072)', () => {
  it('최상단에서 임계값을 넘겨 당겼다 놓으면 refresh가 호출된다', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      refresh,
    })

    renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 200)) // 200 * 0.5 = 100 → 상한 80 ≥ 임계 56
    fireEvent(document, touchEvent('touchend'))

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  it('임계값 미만으로 당겼다 놓으면 refresh가 호출되지 않는다', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      refresh,
    })

    renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40)) // 40 * 0.5 = 20 < 56
    fireEvent(document, touchEvent('touchend'))

    expect(refresh).not.toHaveBeenCalled()
  })

  it('당기는 동안 배너가 고정 헤더 안 경계 페이드 다음 형제로 그려진다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
    })

    renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40))

    const indicator = screen.getByTestId('pull-to-refresh-indicator')
    expect(screen.getByTestId('pull-to-refresh-indicator')).toBeInTheDocument()
    // 인디케이터와 페이드가 같은 자리(absolute top-full)를 쓰므로 DOM 순서로 인디케이터가 위에 와야 한다.
    expect(indicator.previousElementSibling).toHaveClass('backdrop-blur-sm')
    expect(indicator.parentElement).toHaveClass('fixed')
  })

  it('제스처를 붙여도 헤더 새로고침 버튼은 그대로 남는다(ADR-072 결정 10)', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      refresh,
    })

    renderContentScreen()
    await screen.findByRole('combobox')

    const button = screen.getByRole('button', { name: '새로고침' })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })
})

// ADR-073: 인디케이터가 불투명 배너로 열리는 대신, 헤더는 고정된 채 목록 블록만 손가락을 따라 내려간다.
describe('당겨서 새로고침 — 목록 이동 (ADR-073)', () => {
  function mockLoadedStore(overrides: Partial<ReturnType<typeof useContentSchedulerStore>> = {}): void {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      ...overrides,
    })
  }

  // 결정 3 회귀 방지 — translateY(0px) 조차 containing block·stacking context를 만들어
  // sticky 후손(ADR-047 중첩 카드 헤더)의 기준을 바꾼다. 당기지 않는 동안 DOM은 이 기능 도입 전과 같아야 한다.
  it('쉬는 상태에서는 목록 블록에 transform 인라인 스타일이 없다', async () => {
    mockLoadedStore()

    renderContentScreen()
    await screen.findByRole('combobox')

    expect(screen.getByTestId('pull-content').style.transform).toBe('')
  })

  it('임계값 미만으로 당기는 중에는 목록 블록이 당긴 만큼 내려간다', async () => {
    mockLoadedStore()

    renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40)) // 40 * 0.5 = 20 < 56

    expect(screen.getByTestId('pull-content').style.transform).toBe('translateY(20px)')
  })

  // 결정 4 — 손가락이 붙어 있는데 전환이 걸리면 목록이 전환 시간만큼 늘 뒤처져 그려진다.
  it('당기는 중에는 전환이 꺼진다', async () => {
    mockLoadedStore()

    renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40))

    expect(screen.getByTestId('pull-content').style.transition).toBe('none')
  })

  // 결정 5 — 대기 신호가 문구뿐 아니라 위치로도 남는다. 손을 뗀 뒤라 정착 애니메이션이 전환을 타야 한다.
  it('재조회가 도는 동안 목록이 임계 위치에 머물고 전환은 살아 있다', async () => {
    const refresh = vi.fn()
    mockLoadedStore({ refresh })

    const { rerender } = renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 200)) // 200 * 0.5 = 100 → 상한 80 ≥ 임계 56
    fireEvent(document, touchEvent('touchend'))
    expect(refresh).toHaveBeenCalledTimes(1)

    mockLoadedStore({ status: 'loading', refresh })
    rerender(contentScreenTree())

    const list = screen.getByTestId('pull-content')
    expect(list.style.transform).toBe('translateY(56px)')
    expect(list.style.transition).toBe(PULL_SETTLE_TRANSITION)
  })

  it('모달은 목록 블록 밖에 있어 당겨도 움직이지 않는다', async () => {
    mockLoadedStore()

    renderContentScreen()
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))
    const overlay = await screen.findByTestId('character-tracking-picker-overlay')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40))

    const list = screen.getByTestId('pull-content')
    expect(list.style.transform).toBe('translateY(20px)')
    expect(list.contains(overlay)).toBe(false)
    expect(overlay.style.transform).toBe('')
  })
})
