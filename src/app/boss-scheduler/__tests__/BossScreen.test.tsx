// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BossScreen } from '../BossScreen'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { NexonAuthError, NexonRateLimitError } from '@core/nexon/errors'
import { PULL_SETTLE_TRANSITION } from '../../../lib/pull-to-refresh'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import type { CharacterPickerEntry } from '@core/types'
import type { MatchedBoss } from '../../../lib/boss-matching'
// ADR-063: 동기화 실패·일부 캐릭터 실패·파티원 수 저장 실패는 인라인 문단이 아니라 토스트로 알린다.
const { showErrorMock, noticeApiKeyIssueMock } = vi.hoisted(() => ({
  showErrorMock: vi.fn(),
  noticeApiKeyIssueMock: vi.fn(),
}))
vi.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))

// ADR-115 결정 7: 401은 동기화 토스트도 피커 로스터도 이 진입점 하나로 위임한다.
vi.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: noticeApiKeyIssueMock }) },
}))


vi.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: vi.fn(),
  partySizeKey: (ocid: string, boss: string, difficulty: string) => `${ocid}:${boss}:${difficulty}`,
}))

// ADR-062: 화면이 toScheduleSyncError로 reject를 원인으로 변환하므로, 그 매핑은 실물을 쓰고
// getCharacterPickerRoster만 대체한다(부분 모킹).
vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: vi.fn(),
}))

const mockedUseBossSchedulerStore = vi.mocked(useBossSchedulerStore)
const mockedGetCharacterPickerRoster = vi.mocked(getCharacterPickerRoster)

function mockStore(overrides: Partial<ReturnType<typeof useBossSchedulerStore>>): void {
  // ADR-096: 탭·필터가 스토어로 올라가 정적 mockReturnValue로는 전환이 렌더에 반영되지 않는다.
  // 모킹된 훅도 렌더 중에 불리므로 useState로 실물과 같은 "값 + 세터" 쌍을 흉내 낸다.
  const base = {
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    partySizes: {},
    manualTrackedByOcid: {},
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    loadPartySizes: vi.fn(),
    setPartySize: vi.fn(),
    setManualBossDifficulty: vi.fn(),
    addManualBoss: vi.fn(),
    removeManualBoss: vi.fn(),
    activeTab: 'weekly' as const,
    setActiveTab: vi.fn(),
    weeklyFilter: 'all' as const,
    setWeeklyFilter: vi.fn(),
    monthlyFilter: 'all' as const,
    setMonthlyFilter: vi.fn(),
    ...overrides,
  } satisfies ReturnType<typeof useBossSchedulerStore>

  mockedUseBossSchedulerStore.mockImplementation(() => {
    const [activeTab, setActiveTab] = useState(base.activeTab)
    const [weeklyFilter, setWeeklyFilter] = useState(base.weeklyFilter)
    const [monthlyFilter, setMonthlyFilter] = useState(base.monthlyFilter)
    return {
      ...base,
      activeTab,
      setActiveTab,
      weeklyFilter,
      setWeeklyFilter,
      monthlyFilter,
      setMonthlyFilter,
    }
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

// BossScreen이 "보스 관리" 진입에 라우터 내비게이션을 쓰므로 /boss/manage에 프로브 요소를 둔다.
// 트리를 함수로 빼둔 것은 store를 바꿔 rerender하는 테스트(재조회 중 목록 위치)가 같은 트리를 다시 넘겨야 하기 때문.
function bossScreenTree(initialEntries: string[] = ['/boss']): React.JSX.Element {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/boss" element={<BossScreen />} />
        <Route path="/boss/manage" element={<div>보스 관리 페이지 프로브</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderBossScreen(initialEntries: string[] = ['/boss']): ReturnType<typeof render> {
  return render(bossScreenTree(initialEntries))
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

describe('BossScreen', () => {
  it('추적 목록이 빈 배열이면 빈 상태 안내만 보인다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: [],
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

    renderBossScreen()

    expect(await screen.findByText('표시할 캐릭터가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('캐릭터를 선택하면 주간·월간 보스 스케줄을 확인할 수 있습니다')).toBeInTheDocument()
    expect(screen.queryByText(/자쿰/)).not.toBeInTheDocument()
  })

  // [[ADR-101]] 결정 1: `null` 은 "0명"이 아니라 "저장소를 아직 안 읽었다"다. 둘을 같이 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다(실기기 2026-08-06).
  it('추적 목록이 null(미로드)이면 빈 상태가 아니라 로딩을 보여준다', async () => {
    mockStore({ status: 'idle', trackedOcids: null, characters: [] })

    renderBossScreen()

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

    renderBossScreen()
    await screen.findByText('표시할 캐릭터가 없습니다')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 선택하기' }))

    expect(await screen.findByRole('button', { name: /내옆에최성일/ })).toBeInTheDocument()
  })

  // ADR-116 결정 4(이슈 #178의 두 번째 증상): 컨텐츠 스케줄러와 구조가 같다 — 빈 상태의 유일한
  // 액션이 피커 열기라, 피커가 429로 0건이면 닫아도 같은 EmptyState로 돌아오는 루프였다. 여는
  // 순간 진입점이 불려 안내 모달이 덮이므로 루프가 끊긴다.
  it('빈 상태에서 연 피커가 429면 EmptyState 루프가 아니라 키 재입력 경로로 나간다', async () => {
    mockStore({ status: 'loaded', trackedOcids: [], characters: [] })
    mockedGetCharacterPickerRoster.mockRejectedValue(new NexonRateLimitError('rate limited'))

    renderBossScreen()
    await screen.findByText('표시할 캐릭터가 없습니다')

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 선택하기' }))

    await waitFor(() => expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith('rateLimited'))
  })

  it('openPicker 쿼리 파라미터로 진입하면 캐릭터 관리 피커가 자동으로 열린다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: null,
      characters: [],
    })
    mockedGetCharacterPickerRoster.mockImplementation(async (onUpdate) => {
      onUpdate([pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일', level: 211 })])
    })

    renderBossScreen(['/boss?openPicker=1'])

    expect(await screen.findByRole('button', { name: /내옆에최성일/ })).toBeInTheDocument()
  })

  // ADR-099 — 이 화면도 문서가 아니라 자기 스크롤 컨테이너를 스크롤한다(컨텐츠 스케줄러에서 실기기
  // 검증 후 확산). 기하는 공용 셸 ScreenScroll 이 갖고, 여기서는 연결만 본다.
  describe('화면 스크롤 컨테이너 (ADR-099)', () => {
    async function renderLoaded(): Promise<void> {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [character({ ocid: 'ocid-1' })],
      })
      renderBossScreen()
      await screen.findByRole('heading', { name: '보스 스케줄러' })
    }

    it('헤더와 목록이 공용 스크롤 셸 안에 있다', async () => {
      await renderLoaded()

      const scroller = screen.getByTestId('screen-scroll')
      expect(scroller).toContainElement(screen.getByTestId('pull-content'))
      expect(scroller).toContainElement(screen.getByRole('heading', { name: '보스 스케줄러' }))
    })

    it('모달은 셸 바깥에 그려진다 — 안에 두면 z-50 이 셸의 스태킹 컨텍스트에 갇힌다', async () => {
      await renderLoaded()

      fireEvent.click(screen.getByRole('button', { name: '캐릭터 관리' }))

      const modal = await screen.findByRole('heading', { name: '캐릭터 관리' })
      expect(screen.getByTestId('screen-scroll')).not.toContainElement(modal)
    })
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

    renderBossScreen()
    const heading = await screen.findByRole('heading', { name: '보스 스케줄러' })
    const headerEl = heading.closest('.fixed')

    expect(headerEl).toHaveClass('top-0')
    expect(headerEl).toHaveClass('inset-x-0')
    expect(headerEl).toHaveClass('pt-[calc(1rem+var(--sa-top))]')
    expect(heading.closest('.sticky')).toBeNull()
    // 헤더가 흐름에서 빠진 자리는 래퍼 안 spacer 가 채우고, 그 래퍼가 화면 루트의 첫 자식이다.
    const wrapper = headerEl?.parentElement
    expect(wrapper?.parentElement).toHaveClass('-mt-[var(--sa-top)]')
    expect(wrapper?.lastElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('마운트 시 loadTrackedOcids가 호출된다', async () => {
    const loadTrackedOcids = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ ocid: 'ocid-1' })],
      loadTrackedOcids,
    })

    renderBossScreen()
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

    renderBossScreen()
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

    renderBossScreen()
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

      renderBossScreen()
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

      renderBossScreen()
      await screen.findByRole('combobox')

      expect(screen.getByText('season 완료')).toBeInTheDocument()
    })

    it('챌린저스 월드가 아니면 시즌 보스 항목이 있어도 season 배지를 보여주지 않는다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [character({ ocid: 'ocid-1', world: '엘리시움', weeklyBosses: [seasonBoss()] })],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      expect(screen.queryByText(/^season /)).not.toBeInTheDocument()
    })

    it('챌린저스 월드여도 시즌 보스 항목 자체가 없으면 season 배지를 보여주지 않는다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [character({ ocid: 'ocid-1', world: '챌린저스', weeklyBosses: [] })],
      })

      renderBossScreen()
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

    renderBossScreen()
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

    renderBossScreen()
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

    renderBossScreen()
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

    renderBossScreen()
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

    renderBossScreen()

    expect(await screen.findByText(/불러오고 있어요/)).toBeInTheDocument()
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

    renderBossScreen()

    expect(await screen.findByText(/자쿰/)).toBeInTheDocument()
    expect(screen.queryByText(/불러오고 있어요/)).not.toBeInTheDocument()
  })

  // ADR-115 결정 1·7: 401은 이 화면이 토스트로 알리지 않는다 — 문구·이동·저장소 삭제가 전부
  // noticeApiKeyIssue() 안에 있다. 여기서 확인할 것은 그 진입점에 도달하는가뿐이다.
  it('status가 error이고 401이면 토스트 대신 키 무효화 경로로 넘긴다', async () => {
    mockStore({
      status: 'error',
      trackedOcids: ['ocid-1'],
      error: { kind: 'invalidApiKey' },
      characters: [character({ ocid: 'ocid-1' })],
    })

    renderBossScreen()

    await waitFor(() => expect(noticeApiKeyIssueMock).toHaveBeenCalledTimes(1))
    expect(showErrorMock).not.toHaveBeenCalled()
    expect(screen.queryByText('API 키가 유효하지 않습니다')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '설정 열기' })).not.toBeInTheDocument()
  })

  // ADR-116 결정 1: 429도 같은 사슬이다 — 전에는 액션 없는 토스트 한 줄이라 그 자리에서 할 수
  // 있는 일이 없었다. 이제 모달이 원인과 처방("서비스 단계 키로 다시 입력")을 함께 말한다.
  it('status가 error이고 429면 토스트 대신 키 재입력 경로로 넘긴다', async () => {
    mockStore({
      status: 'error',
      trackedOcids: ['ocid-1'],
      error: { kind: 'rateLimited' },
      characters: [character({ ocid: 'ocid-1' })],
    })

    renderBossScreen()

    await waitFor(() => expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith('rateLimited'))
    expect(showErrorMock).not.toHaveBeenCalled()
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

    renderBossScreen()

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

    renderBossScreen()
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

    renderBossScreen()
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

    renderBossScreen()
    await screen.findByRole('combobox')

    expect(screen.getByText('등록된 주간 보스가 없습니다')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    expect(screen.queryByText('등록된 주간 보스가 없습니다')).not.toBeInTheDocument()
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

      renderBossScreen()
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

      renderBossScreen()
      await screen.findByRole('combobox')

      expect(screen.queryByText(/^\d+인$/)).not.toBeInTheDocument()
    })

    // ADR-121: 카드 전면이 버튼이고 탭하면 파티 인원·난이도 모달이 열린다. ADR-019 결정 4가
    // "카드 인터랙션 충돌"로 폐기했던 방식인데, ADR-035 결정 18이 카드의 인터랙션을 0개로 만들며
    // 그 전제가 사라졌다.
    describe('카드 탭 → 파티 인원 모달 (ADR-121)', () => {
      function openModal(): void {
        fireEvent.click(screen.getByRole('button', { name: /자쿰/ }))
      }

      it('보스 카드를 탭하면 파티 인원 모달이 열린다', async () => {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
          partySizes: { 'ocid-1:자쿰:카오스': 3 },
        })

        renderBossScreen()
        await screen.findByRole('combobox')
        expect(screen.queryByTestId('party-size-modal')).not.toBeInTheDocument()

        openModal()

        expect(screen.getByTestId('party-size-modal')).toBeInTheDocument()
        expect(screen.getByText('3 / 6')).toBeInTheDocument()
      })

      it('완료된 보스도 탭할 수 있다 (파티 인원은 완료와 무관한 상시 데이터)', async () => {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [
            characterWithZakum({
              weeklyBosses: [
                {
                  apiName: '자쿰',
                  difficulty: '카오스',
                  cycle: 'weekly',
                  isRegistered: true,
                  isComplete: true,
                  ownComplete: true,
                  matchedBossName: '자쿰',
                  portraitSlug: null,
                  isSeasonBoss: false,
                },
              ],
            }),
          ],
        })

        renderBossScreen()
        await screen.findByRole('combobox')
        openModal()

        expect(screen.getByTestId('party-size-modal')).toBeInTheDocument()
      })

      it('스테퍼를 누르면 setPartySize 가 그 (보스, 난이도)로 즉시 호출된다', async () => {
        const setPartySize = vi.fn().mockResolvedValue(undefined)
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
          partySizes: { 'ocid-1:자쿰:카오스': 3 },
          setPartySize,
        })

        renderBossScreen()
        await screen.findByRole('combobox')
        openModal()
        fireEvent.click(screen.getByRole('button', { name: '자쿰 파티원 수 증가' }))

        expect(setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 4)
      })

      it('저장이 실패하면 관리 페이지와 같은 문구로 토스트를 띄운다', async () => {
        const setPartySize = vi.fn().mockRejectedValue(new Error('write failed'))
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
          partySizes: { 'ocid-1:자쿰:카오스': 3 },
          setPartySize,
        })

        renderBossScreen()
        await screen.findByRole('combobox')
        openModal()
        fireEvent.click(screen.getByRole('button', { name: '자쿰 파티원 수 증가' }))

        await vi.waitFor(() => {
          expect(showErrorMock).toHaveBeenCalledWith('파티원 수를 저장하지 못했습니다')
        })
      })

      it('닫기를 누르면 모달이 사라진다', async () => {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
        })

        renderBossScreen()
        await screen.findByRole('combobox')
        openModal()
        fireEvent.click(screen.getByRole('button', { name: '닫기' }))

        expect(screen.queryByTestId('party-size-modal')).not.toBeInTheDocument()
      })

      // 자동 모드에서 난이도 전환은 멤버십이 아니라 "어느 난이도의 파티 인원을 편집할지" 스위치다
      // (ADR-121 결정 3 — 모드 통합 대비해 세그먼트를 그리되 멤버십은 안 건드린다).
      it('자동 모드에서 난이도를 바꿔도 멤버십 API를 부르지 않고 그 난이도의 인원을 편집한다', async () => {
        const setPartySize = vi.fn().mockResolvedValue(undefined)
        const setManualBossDifficulty = vi.fn()
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          characters: [characterWithZakum()],
          partySizes: { 'ocid-1:자쿰:카오스': 3 },
          setPartySize,
          setManualBossDifficulty,
        })

        renderBossScreen()
        await screen.findByRole('combobox')
        openModal()
        // 자쿰은 카오스 하나뿐이라 세그먼트에 다른 난이도가 없다 — 멤버십 호출이 없음만 확인한다.
        fireEvent.click(screen.getByRole('button', { name: '자쿰 파티원 수 증가' }))

        expect(setManualBossDifficulty).not.toHaveBeenCalled()
        expect(setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 4)
      })
    })

    it('"보스 관리" 버튼을 누르면 관리 페이지로 이동한다 (ADR-035 결정 18 — 파티 관리 모달 대체)', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '보스 관리' }))

      expect(await screen.findByText('보스 관리 페이지 프로브')).toBeInTheDocument()
    })

    it('기존 "파티 관리" 버튼은 더 이상 렌더링되지 않는다', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithZakum()],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      expect(screen.queryByRole('button', { name: '파티 관리' })).not.toBeInTheDocument()
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

      renderBossScreen()
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

      renderBossScreen()
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

      renderBossScreen()
      await screen.findByRole('combobox')

      fireEvent.click(screen.getByRole('button', { name: '파티' }))
      expect(screen.queryByText('루시드')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '월간' }))
      // 검은마법사는 파티 설정이 없어 솔로 취급이지만, 월간 탭 필터는 독립적으로 "전체"로
      // 유지되어야 하므로 그대로 보여야 한다.
      expect(screen.getByText('검은마법사')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '전체' })).toHaveClass('bg-primary-tint')

      fireEvent.click(screen.getByRole('button', { name: '주간' }))
      // 주간 탭으로 되돌아오면 이전에 선택한 "파티" 필터가 그대로 유지된다.
      expect(screen.getByRole('button', { name: '파티' })).toHaveClass('bg-primary-tint')
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

      renderBossScreen()
      await screen.findByRole('combobox')

      // 등록된 보스 자체가 없는 경우
      expect(screen.getByText('등록된 주간 보스가 없습니다')).toBeInTheDocument()
      expect(screen.queryByText('이 조건에 해당하는 보스가 없습니다')).not.toBeInTheDocument()

      cleanup()

      // 등록된 보스는 있지만 필터 조건에 맞는 게 없는 경우
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithTwoBosses()],
        partySizes: {},
      })

      renderBossScreen()
      await screen.findByRole('combobox')
      fireEvent.click(screen.getByRole('button', { name: '파티' }))

      expect(screen.getByText('이 조건에 해당하는 보스가 없습니다')).toBeInTheDocument()
      expect(screen.queryByText('등록된 주간 보스가 없습니다')).not.toBeInTheDocument()
    })

    // ADR-060: 필터가 가린 상태라 CTA는 "관리 페이지"가 아니라 필터 초기화다.
    it('필터 결과가 0개면 "필터 초기화" CTA가 그 탭의 필터를 전체로 되돌린다 (ADR-060)', async () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        characters: [characterWithTwoBosses()],
        partySizes: {},
      })

      renderBossScreen()
      await screen.findByRole('combobox')
      fireEvent.click(screen.getByRole('button', { name: '파티' }))
      expect(screen.getByText('이 조건에 해당하는 보스가 없습니다')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))

      expect(screen.queryByText('이 조건에 해당하는 보스가 없습니다')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '전체' })).toHaveClass('bg-primary-tint')
    })
  })

  describe('ADR-035: 수동 트래킹 모드', () => {
    function unregisteredIncompleteBoss(): MatchedBoss {
      return {
        apiName: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        // 게임에 등록도 안 됐고 완료도 안 된 보스 — auto라면 selectDisplayBosses가 숨긴다.
        isRegistered: false,
        isComplete: false,
        ownComplete: false,
        matchedBossName: '자쿰',
        portraitSlug: null,
        isSeasonBoss: false,
      }
    }

    it('수동 모드: 게임 등록·완료 여부와 무관하게 추적 중인 보스를 표시한다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }] },
        characters: [character({ ocid: 'ocid-1', weeklyBosses: [unregisteredIncompleteBoss()] })],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      expect(screen.getByText('자쿰')).toBeInTheDocument()
    })

    it('수동 모드: 한 번도 동기화된 적 없는 보스도 참조 테이블 cycle로 표시한다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [{ contentName: '검은마법사', kind: 'boss', difficulty: '하드' }] },
        characters: [character({ ocid: 'ocid-1', weeklyBosses: [], monthlyBosses: [] })],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      // 검은마법사는 월간 보스 — 주간 탭에는 안 보이고 월간 탭에 보인다.
      expect(screen.queryByText('검은마법사')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '월간' }))
      expect(screen.getByText('검은마법사')).toBeInTheDocument()
    })

    it('수동 모드에서도 "보스 추가" 버튼과 카드 삭제 버튼은 렌더링되지 않는다 (ADR-035 결정 18 — 편집은 관리 페이지 전용)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }] },
        characters: [character({ ocid: 'ocid-1', weeklyBosses: [unregisteredIncompleteBoss()] })],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      expect(screen.queryByRole('button', { name: '보스 추가' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '자쿰 카오스 삭제' })).not.toBeInTheDocument()
      // "보스 관리" 진입은 수동 모드에서도 그대로 보인다(두 모드 공통).
      expect(screen.getByRole('button', { name: '보스 관리' })).toBeInTheDocument()
    })

    it('수동 모드: 추적 보스가 없으면 "보스 관리" 안내 빈 상태를 보여준다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [] },
        characters: [character({ ocid: 'ocid-1', weeklyBosses: [] })],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      expect(screen.getByText('추적할 주간 보스가 없습니다')).toBeInTheDocument()
    })

    // ADR-060: 빈 상태 문구가 "보스 관리에서 골라주세요"라고 지시하면 실제로 그리로 데려가야 한다.
    it('수동 모드: 빈 상태의 "보스 관리" CTA를 누르면 관리 페이지로 이동한다 (ADR-060)', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        selectedOcid: 'ocid-1',
        manualTrackedByOcid: { 'ocid-1': [] },
        characters: [character({ ocid: 'ocid-1', weeklyBosses: [] })],
      })

      renderBossScreen()
      await screen.findByRole('combobox')

      // 헤더 버튼과 빈 상태 CTA가 같은 라벨을 쓴다 — 두 번째가 CTA다.
      const buttons = screen.getAllByRole('button', { name: '보스 관리' })
      expect(buttons).toHaveLength(2)
      fireEvent.click(buttons[1])

      expect(await screen.findByText('보스 관리 페이지 프로브')).toBeInTheDocument()
    })
  })
})

// ADR-053 결정 3: 후보 목록 조회의 로딩·실패는 화면(app/)이 getCharacterPickerRoster의 Promise로
// 판정해 피커에 props로 내려준다 — ContentScreen과 동일한 배선이다(한쪽만 고치는 실수 방지).
describe('BossScreen — 캐릭터 관리 피커 후보 목록 로딩 (ADR-053)', () => {
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

    renderBossScreen()
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

  // ADR-062: 재시도가 피커를 여는 것과 같은 초기화(reloadRoster)를 타므로, 모달을 닫지 않고도
  // 재조회된다 — ADR-053의 "닫았다 다시 열기" 안내를 대체하는 지점이다.
  it('실패 상태에서 다시 시도를 누르면 모달을 닫지 않고 재조회한다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new Error('network'))
    await screen.findByText('캐릭터 목록을 불러오지 못했습니다')
    expect(mockedGetCharacterPickerRoster).toHaveBeenCalledTimes(1)

    deferRoster()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    // 모달은 그대로 열려 있고 스피너로 돌아간다.
    expect(await screen.findByTestId('maple-sweep-spinner')).toBeInTheDocument()
    expect(screen.getByTestId('character-tracking-picker-overlay')).toBeInTheDocument()
    expect(screen.queryByText('캐릭터 목록을 불러오지 못했습니다')).not.toBeInTheDocument()
    expect(mockedGetCharacterPickerRoster).toHaveBeenCalledTimes(2)
  })

  // ADR-062 결정 3 + ADR-115 결정 1·7: 401은 재시도로 풀리지 않고, 이제 설정으로 보내지도
  // 않는다(설정에는 키를 바꿀 자리가 없다) — 아래 테스트가 확인하듯 이 실패는 곧 키 무효화라
  // 화면이 스스로 키 입력으로 이동한다. 그래서 누를 것이 없다.
  it('401 실패는 재시도도 설정 열기도 주지 않고 이동을 알린다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new NexonAuthError('Nexon API 키가 유효하지 않습니다'))

    expect(await screen.findByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
    expect(screen.getByText('키 입력 화면으로 이동합니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '설정 열기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  // ADR-115 결정 7: 감지 지점은 동기화 토스트만이 아니다 — 피커 로스터가 맞는 401도 같은 키
  // 무효화이므로 같은 진입점을 부른다(다른 케이스들의 `new Error('401')`은 network로 떨어진다).
  it('로스터 조회가 401로 실패하면 키 무효화 경로로 넘긴다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new NexonAuthError('Nexon API 키가 유효하지 않습니다'))

    await waitFor(() => expect(noticeApiKeyIssueMock).toHaveBeenCalledTimes(1))
  })

  // ADR-116 결정 1: 429도 같은 진입점을 탄다 — 피커 본문은 목록이 없는 자리라 액션을 빼면 아무
  // 길도 남지 않는데, 그 출구를 모달이 준다(이슈 #178).
  it('로스터 조회가 429로 실패하면 키 재입력 경로로 넘긴다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new NexonRateLimitError('rate limited'))

    await waitFor(() => expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith('rateLimited'))
  })

  it('로스터 조회가 401·429가 아닌 실패면 키 재입력 경로를 타지 않는다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    await roster.reject(new Error('network'))
    await screen.findByText('캐릭터 목록을 불러오지 못했습니다')

    expect(noticeApiKeyIssueMock).not.toHaveBeenCalled()
  })

  // ADR-062 결정 4: 캐시 stub이 방출된 뒤 실패하면(예열이 끝난 정상 경로의 기본 분기) 목록을
  // 지우지 않고 배너만 얹는다 — 배너가 없으면 이 실패가 무음이 된다.
  it('보여줄 항목이 있는 채로 실패하면 목록을 지우지 않고 스탈 배너를 얹는다', async () => {
    const roster = deferRoster()

    await renderAndOpenPicker()
    roster.emit([pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일', level: 211 })])
    await roster.reject(new Error('network'))

    expect(await screen.findByText('목록이 최신이 아닙니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /내옆에최성일/ })).toBeInTheDocument()
    expect(screen.queryByText('캐릭터 목록을 불러오지 못했습니다')).not.toBeInTheDocument()
  })
})


// ADR-083 결정 1: 캐릭터별 실패도 인라인 문단이 아니라 토스트다. syncSchedules가 캐릭터 단위
// 실패를 던지지 않고 결과에 실어 반환하므로, 401/429/네트워크 실패의 대부분이 전역 error가 아니라
// 이 경로로 온다 — 인라인으로 두면 액션 없는 빨간 줄이 실패의 유일한 신호가 된다.
describe('선택 캐릭터 실패 (ADR-083 결정 1)', () => {
  it('isStale이지만 error가 없으면(캐시 우선 표시) 아무것도 알리지 않는다', () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      characters: [character({ isStale: true, error: null })],
    })

    renderBossScreen()

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

    renderBossScreen()

    expect(screen.queryByText('네트워크 오류가 발생했습니다')).not.toBeInTheDocument()
    expect(document.querySelectorAll('p.text-error-ink')).toHaveLength(0)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('네트워크 오류가 발생했습니다')
    expect(action.label).toBe('다시 시도')
    action.onClick()
    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // ADR-083 결정 2: 영구 실패라 눌러도 같은 400이다.
  it('characterUnavailable 토스트에는 액션을 붙이지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      selectedOcid: 'ocid-1',
      characters: [character({ isStale: true, error: { kind: 'characterUnavailable' } })],
    })

    renderBossScreen()

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

    renderBossScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 200)) // 200 * 0.5 = 100 → 상한 80 ≥ 임계 56
    fireEvent(document, touchEvent('touchend'))

    // 결정 3: 보스 store의 refresh는 onProgress를 받을 수 있지만 세 화면이 같은 1인자 형태를 쓴다.
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

    renderBossScreen()
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

    renderBossScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40))

    const indicator = screen.getByTestId('pull-to-refresh-indicator')
    expect(screen.getByTestId('pull-to-refresh-indicator')).toBeInTheDocument()
    // 인디케이터와 페이드가 같은 자리(absolute top-full)를 쓰므로 DOM 순서로 인디케이터가 위에 와야 한다.
    expect(indicator.previousElementSibling).toHaveClass('top-full', 'from-bg')
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

    renderBossScreen()
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
  function mockLoadedStore(overrides: Partial<ReturnType<typeof useBossSchedulerStore>> = {}): void {
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

    renderBossScreen()
    await screen.findByRole('combobox')

    expect(screen.getByTestId('pull-content').style.transform).toBe('')
  })

  it('임계값 미만으로 당기는 중에는 목록 블록이 당긴 만큼 내려간다', async () => {
    mockLoadedStore()

    renderBossScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40)) // 40 * 0.5 = 20 < 56

    expect(screen.getByTestId('pull-content').style.transform).toBe('translateY(20px)')
  })

  // 결정 4 — 손가락이 붙어 있는데 전환이 걸리면 목록이 전환 시간만큼 늘 뒤처져 그려진다.
  it('당기는 중에는 전환이 꺼진다', async () => {
    mockLoadedStore()

    renderBossScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 40))

    expect(screen.getByTestId('pull-content').style.transition).toBe('none')
  })

  // 결정 5 — 대기 신호가 문구뿐 아니라 위치로도 남는다. 손을 뗀 뒤라 정착 애니메이션이 전환을 타야 한다.
  it('재조회가 도는 동안 목록이 임계 위치에 머물고 전환은 살아 있다', async () => {
    const refresh = vi.fn()
    mockLoadedStore({ refresh })

    const { rerender } = renderBossScreen()
    await screen.findByRole('combobox')

    fireEvent(document, touchEvent('touchstart', 0))
    fireEvent(document, touchEvent('touchmove', 200)) // 200 * 0.5 = 100 → 상한 80 ≥ 임계 56
    fireEvent(document, touchEvent('touchend'))
    expect(refresh).toHaveBeenCalledTimes(1)

    mockLoadedStore({ status: 'loading', refresh })
    rerender(bossScreenTree())

    const list = screen.getByTestId('pull-content')
    expect(list.style.transform).toBe('translateY(56px)')
    expect(list.style.transition).toBe(PULL_SETTLE_TRANSITION)
  })
})
