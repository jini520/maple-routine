// 보스 스케줄러 화면이 지키는 것을 적는다.
// **명세를 읽어 다시 쓴 것**이다.
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { useState } from 'react'

import {
  useBossSchedulerStore,
  type BossCharacterView,
  type BossSchedulerStore,
} from '../../../features/boss-scheduler/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import weeklyBossesData from '../../../data/weekly-bosses.json'
import { WEEKLY_BOSS_CLEAR_LIMIT, type MatchedBoss } from '../../../lib/boss/boss-matching'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
import { BossScreen } from '../BossScreen'

// 이름이 `mock` 으로 시작해야 한다. babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다.
const mockShowError = jest.fn()
const mockShowInfo = jest.fn()
const mockNoticeApiKeyIssue = jest.fn()
const navigate = jest.fn()
// 층이 스택이 된 뒤로 **그룹 층으로 되돌리기** 는 액션이다. 화면이 이것도 부른다.
const dispatch = jest.fn()

// 동기화 실패·파티원 수 저장 실패는 인라인 문단이 아니라 토스트다.
jest.mock('../../../features/toast/store', () => ({
  useToastStore: {
    getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: mockShowInfo }),
  },
}))

// 401·429 는 토스트가 아니라 키 재입력 진입점으로 간다.
jest.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) },
}))

jest.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: jest.fn(),
  partySizeKey: (ocid: string, boss: string, difficulty: string) => `${ocid}:${boss}:${difficulty}`,
}))

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

// **로스터 조회 목도 라우트 목도 여기 없다**. 이 화면은 더 이상 피커를 열지 않고 `openPicker`
// 파라미터도 받지 않으므로 `schedule-sync` 와 `useRoute` 를 아예 부르지 않는다.
// 둘 다 설정 화면 테스트로 옮겨갔다.

const mockedStore = jest.mocked(useBossSchedulerStore)
const mockedNavigation = jest.mocked(useScreenNavigation)

// `ReturnType<typeof useBossSchedulerStore>` 은 **`unknown` 이 된다**(zustand 의 훅이 오버로드라
// tsc 가 셀렉터 시그니처를 집는다). 스토어가 그 타입을 이미 내보내므로 그것을 그대로 쓴다.
type Store = BossSchedulerStore

/**
 * 탭과 두 필터가 스토어 소유라 정적 목으로는 전환이 렌더에 반영되지 않는다.
 * 모킹된 훅도 렌더 중에 불리므로 여기서 `useState` 로 실물과 같은 "값 + 세터" 쌍을 흉내 낸다.
 */
function mockStore(overrides: Partial<Store> = {}): Store {
  const base = {
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    partySizes: {},
    manualTrackedByOcid: {},
    loadTrackedOcids: jest.fn(),
    saveTrackedOcids: jest.fn(),
    // 실물은 `Promise<void>` 다. 당김 훅이 회차의 **끝** 을 기다린다.
    refresh: jest.fn().mockResolvedValue(undefined),
    loadPartySizes: jest.fn(),
    setPartySize: jest.fn(),
    addManualBoss: jest.fn(),
    removeManualBoss: jest.fn(),
    setManualBossDifficulty: jest.fn(),
    partyFilter: 'all' as const,
    setPartyFilter: jest.fn(),
    ...overrides,
  } as Store

  mockedStore.mockImplementation(() => {
    const [partyFilter, setPartyFilter] = useState(base.partyFilter)
    return { ...base, partyFilter, setPartyFilter }
  })
  return base
}

/**
 * 화면에 **선** 섹션 헤더를 위에서 아래 순서로. `['monthly', 'weekly']`.
 *
 * 무리가 비면 헤더도 안 서므로 이 배열이 곧 지금 무엇이 보이는가 다.
 */
function sectionOrder(): string[] {
  return screen
    .queryAllByTestId(/^boss-section-header-/)
    .map((node) => String(node.props.testID).replace('boss-section-header-', ''))
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

// 보스 이름·난이도는 **참조 데이터에 실재하는 것만** 쓴다(게임 수치를 지어내지 않는다).
function boss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  return {
    apiName: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    matchedBossName: '자쿰',
    portraitSlug: 'zakum',
    isSeasonBoss: false,
    ...overrides,
  }
}

async function renderScreen(): Promise<ReturnType<typeof renderOverlay>> {
  return renderOverlay(<BossScreen />)
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 글자에서 위로 올라가 실제로 눌리는 조상을 찾는다. */
function button(label: string, index = 0): AtomElement {
  let node: AtomElement | null = screen.getAllByText(label)[index]
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

/** 스크롤 셸에 붙은 당겨서 새로고침 컨트롤. */
function refreshControl(): { refreshing: boolean; onRefresh: () => void } {
  return screen.getByTestId('screen-scroll').props.refreshControl.props
}

/** 두 노드를 **같은 줄**로 묶는 가장 작은 상자(아래 케이스가 그것으로 자리를 본다). */
function nearestCommonAncestor(a: AtomElement, b: AtomElement): AtomElement {
  const ancestors = new Set<AtomElement>()
  for (let node: AtomElement | null = a; node !== null; node = node.parent) ancestors.add(node)
  for (let node: AtomElement | null = b; node !== null; node = node.parent) {
    if (ancestors.has(node)) return node
  }
  throw new Error('공통 조상이 없다. 두 노드가 같은 트리에 있지 않다')
}

function contains(ancestor: AtomElement, node: AtomElement): boolean {
  for (let current: AtomElement | null = node; current !== null; current = current.parent) {
    if (current === ancestor) return true
  }
  return false
}

beforeEach(() => {
  mockShowError.mockClear()
  mockShowInfo.mockClear()
  mockNoticeApiKeyIssue.mockClear()
  navigate.mockClear()
  dispatch.mockClear()
  mockedNavigation.mockReturnValue({ navigate, dispatch, goBack: jest.fn() } as never)
  useTrackingModeStore.setState({ mode: 'auto' })
})

// 선택은 이제 화면 스토어가 아니라 `useCharacterSelectionStore` 가 갖는다.
// 실물 스토어라 값이 파일 안에서 넘어가므로 테스트마다 되돌린다.
beforeEach(() => {
  useCharacterSelectionStore.setState({ selectedOcid: null })
})

describe('BossScreen: 빈 상태와 마운트', () => {
  it('마운트하면 loadTrackedOcids 를 부른다', async () => {
    const store = mockStore()

    await renderScreen()

    expect(store.loadTrackedOcids).toHaveBeenCalled()
  })

  it('추적 목록이 빈 배열이면 빈 상태 안내만 보인다', async () => {
    mockStore({ trackedOcids: [] })

    await renderScreen()

    expect(screen.getByText('표시할 캐릭터가 없습니다')).toBeTruthy()
    expect(screen.queryByTestId('screen-scroll')).toBeNull()
  })

  // `null` 은 "0명"이 아니라 "아직 안 읽었다"다. 콜드 스타트 첫 페인트가
  // 모르는 사실을 단정하면 안 된다.
  it('추적 목록이 null(미로드)이면 빈 상태가 아니라 로딩을 보여준다', async () => {
    mockStore({ trackedOcids: null, status: 'idle' })

    await renderScreen()

    expect(screen.queryByText('표시할 캐릭터가 없습니다')).toBeNull()
    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
  })

  // 이 화면은 피커를 열지 않는다. 설정 탭을 **열린 채로** 연다.
// 피커를 여는 파라미터를 받던 자리도 그리로 옮겨갔다(`SettingsScreen.test.tsx`).
  it('빈 상태 CTA 를 누르면 설정 탭을 피커가 열린 채로 연다', async () => {
    mockStore({ trackedOcids: [] })
    await renderScreen()

    await press(button('캐릭터 선택하기'))

    // 층이 스택이 되면서 이동이 두 단 중첩이 됐다. 설정은 **그룹 층**에
    // 살고, 파라미터는 가장 안쪽 화면에 붙는다.
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'Groups',
      params: { screen: 'Settings', params: { openPicker: true } },
    })
    expect(screen.queryByTestId('character-tracking-picker-modal')).toBeNull()
  })
})

describe('BossScreen: 목록', () => {
  const withBosses = (): Store =>
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          weeklyBosses: [
            boss(),
            boss({ apiName: '매그너스', matchedBossName: '매그너스', difficulty: '하드', isRegistered: false }),
          ],
          monthlyBosses: [
            boss({
              apiName: '검은 마법사',
              matchedBossName: '검은마법사',
              difficulty: '하드',
              cycle: 'monthly',
              portraitSlug: 'blackMage',
              isComplete: true,
              ownComplete: true,
            }),
          ],
          weeklyBossClearCount: 3,
          weeklyBossClearLimitCount: 12,
        }),
      ],
    })

  // 탭이 없다. 한 목록에 월간이 먼저 서고 주간이 뒤따르며, 무리마다
  // 섹션 헤더가 붙는다.
  it('탭 없이 월간·주간이 한 목록에 서고, 등록된 보스만 보인다', async () => {
    withBosses()

    await renderScreen()

    expect(screen.getByText('검은마법사')).toBeTruthy()
    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.getByText('카오스')).toBeTruthy()
    expect(screen.queryByText('매그너스')).toBeNull()
    // 탭 버튼이 있던 자리는 이제 섹션 헤더다. 누르는 것이 아니라 읽는 것이다.
    expect(screen.queryByRole('button', { name: '월간' })).toBeNull()
  })

  // 화면에 그려진 순서를 직접 못 박는다. **둘 다 보인다** 만으로는 위아래가 안 잡힌다.
  it('월간 무리가 주간 무리보다 위에 있다', async () => {
    withBosses()

    await renderScreen()

    expect(sectionOrder()).toEqual(['monthly', 'weekly'])
  })

  // 탭이 사라지며 갈 곳을 잃는 표시가 `주간` 헤더에 붙는다. 12 는 주간
  // 한도이므로 그 수치가 어느 무리의 것인지 헤더가 대신 말한다.
  it('n/12 배지는 `주간` 섹션 헤더에 붙는다', async () => {
    withBosses()

    await renderScreen()

    expect(screen.getByTestId('boss-section-header-weekly')).toBeTruthy()
    expect(within(screen.getByTestId('boss-section-header-weekly')).getByText('3/12')).toBeTruthy()
    expect(within(screen.getByTestId('boss-section-header-monthly')).queryByText('3/12')).toBeNull()
  })

  it('완료된 보스에만 완료 배지가 붙는다', async () => {
    withBosses()

    await renderScreen()

    // 검마만 완료다(위 fixture). 자쿰은 미완료라 배지가 하나뿐이다.
    expect(screen.getAllByText('완료')).toHaveLength(1)
  })

  // 미등록이어도 완료된 보스는 목록에 남는다(게임에서 지웠어도 잡은 것은 사실).
  it('미등록이어도 완료된 보스는 카드로 표시된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          weeklyBosses: [
            boss({ apiName: '자쿰', matchedBossName: '자쿰', isRegistered: false, isComplete: true }),
            boss({ apiName: '매그너스', matchedBossName: '매그너스', difficulty: '하드', isRegistered: false }),
          ],
        }),
      ],
    })

    await renderScreen()

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('매그너스')).toBeNull()
  })

  // 캐시가 있으면 재검증 중에도 계속 보여준다(셸 승계 카드는 보여줄 게 없을 때만).
  it('status 가 loading 이어도 캐시된 목록이 있으면 로딩 대신 목록을 보여준다', async () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], characters: [character({ weeklyBosses: [boss()] })] })

    await renderScreen()

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('불러오고 있어요')).toBeNull()
  })

  it('헤더와 목록이 공용 스크롤 셸 안에 있다', async () => {
    withBosses()
    await renderScreen()

    // **모달이 셸 바깥인지를 묻던 짝은 함께 사라졌다**. 이 화면에 캐릭터 관리 모달이 없다
    // 파티 인원 모달은 아래 절이 따로 본다.
    expect(screen.getByTestId('page-header')).toBeTruthy()
    expect(screen.getByTestId('screen-scroll')).toBeTruthy()
  })

  //  이 "캐릭터 관리"를 걷었고 이 남은 "보스 관리"마저 걷는다
  // (그쪽은 하단바의 하위 탭이 됐다). 목록이 있는 화면에서 제목 줄에 남는 것은 상태와 새로고침뿐이다.
  it('헤더에 "캐릭터 관리"도 "보스 관리"도 없다', async () => {
    withBosses()

    await renderScreen()

    expect(screen.queryByText('캐릭터 관리')).toBeNull()
    expect(screen.queryByText('보스 관리')).toBeNull()
  })

  // 스토어는 레벨 내림차순으로 준다. 그 위에 사용자가
  // 정한 저장 배열 순서를 얹는다. 그래서 **입력 순서와 다른 순서**로 주는 것이 이 케이스의 요점이다.
  it('레일 순서는 스토어 순서가 아니라 trackedOcids 저장 순서다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-2', 'ocid-1'],
      characters: [character(), character({ ocid: 'ocid-2', characterName: '캐릭터2' })],
    })

    await renderScreen()

    expect(screen.getAllByTestId('character-portrait').map((node) => node.props.accessibilityLabel)).toEqual([
      expect.stringContaining('캐릭터2'),
      expect.stringContaining('캐릭터1'),
    ])
  })

  // 순서를 정하는 함수가 목록의 크기를 바꾸면 안 된다. 저장 직후·동기화 중간 커밋에서 두 목록이
  // 한순간 어긋나는데, 그때 카드가 통째로 사라지는 것이 가장 나쁜 실패다.
  it('저장 목록에 없는 캐릭터도 레일에서 사라지지 않는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-2'],
      characters: [character(), character({ ocid: 'ocid-2', characterName: '캐릭터2' })],
    })

    await renderScreen()

    expect(screen.getAllByTestId('character-portrait').map((node) => node.props.accessibilityLabel)).toEqual([
      expect.stringContaining('캐릭터2'),
      expect.stringContaining('캐릭터1'),
    ])
  })
})

// 판정은 화면이 아니라 `isChallengersWorld` 가 한다.
describe('BossScreen: 챌린저스 시즌 보스 배지', () => {
  const seasonBoss = (overrides: Partial<MatchedBoss> = {}): MatchedBoss =>
    boss({
      apiName: '시즌 보스 메이린',
      matchedBossName: '시즌 보스 메이린',
      difficulty: '하드',
      portraitSlug: 'maerin',
      isSeasonBoss: true,
      isRegistered: false,
      ...overrides,
    })

  const withWorld = (world: string | undefined, bosses: MatchedBoss[]): void => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ world, weeklyBosses: bosses })],
    })
  }

  it('챌린저스 월드면 등록 여부와 무관하게 season 배지를 보여준다', async () => {
    withWorld('챌린저스2', [seasonBoss()])

    await renderScreen()

    expect(screen.getByText('season 미완료')).toBeTruthy()
  })

  //  의 **빈 무리는 헤더도 걷는다** 에 예외가 하나 있다. **배지를 싣고 있으면
  // 남긴다.** 탭 시절 이 배지들은 목록이 비어도 탭 줄에 떠 있었고, 무리가 비었다는 이유로 지우면
  // **이번 주 몇 마리 잡았나** 를 말할 자리가 아예 없어진다.
  it('주간 카드가 하나도 안 서도 배지를 실은 `주간` 헤더는 남는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          world: '챌린저스2',
          // 미등록·미완료라 카드로는 안 선다.
          weeklyBosses: [seasonBoss()],
          monthlyBosses: [
            boss({
              apiName: '검은 마법사',
              matchedBossName: '검은마법사',
              difficulty: '하드',
              cycle: 'monthly',
              portraitSlug: 'blackMage',
              isRegistered: true,
            }),
          ],
          weeklyBossClearCount: 3,
          weeklyBossClearLimitCount: 12,
        }),
      ],
    })

    await renderScreen()

    expect(sectionOrder()).toEqual(['monthly', 'weekly'])
    const header = screen.getByTestId('boss-section-header-weekly')
    expect(within(header).getByText('3/12')).toBeTruthy()
    expect(within(header).getByText('season 미완료')).toBeTruthy()
    expect(screen.queryByText('시즌 보스 메이린')).toBeNull()
  })

  it('시즌 보스가 완료됐으면 배지가 완료를 말한다', async () => {
    withWorld('챌린저스', [seasonBoss({ isComplete: true })])

    await renderScreen()

    expect(screen.getByText('season 완료')).toBeTruthy()
  })

  it('일반 월드면 시즌 보스 항목이 있어도 배지가 없다', async () => {
    withWorld('스카니아', [seasonBoss()])

    await renderScreen()

    expect(screen.queryByText(/season/)).toBeNull()
  })

  // 월드를 모르는 구버전 캐시는 비-챌린저스로 취급한다. 관리 페이지의 목록 판정과 같아야 한다.
  it('월드를 모르면 배지가 없다', async () => {
    withWorld(undefined, [seasonBoss()])

    await renderScreen()

    expect(screen.queryByText(/season/)).toBeNull()
  })

  it('챌린저스 월드여도 시즌 보스 항목이 없으면 배지가 없다', async () => {
    withWorld('챌린저스', [boss()])

    await renderScreen()

    expect(screen.queryByText(/season/)).toBeNull()
  })
})

describe('BossScreen: 재조회', () => {
  const loaded = (status: Store['status'] = 'loaded'): Store =>
    mockStore({ status, trackedOcids: ['ocid-1'], characters: [character({ weeklyBosses: [boss()] })] })

  it('헤더 새로고침 버튼을 누르면 refresh 를 부른다', async () => {
    const store = loaded()
    await renderScreen()

    await press(screen.getByLabelText('새로고침'))

    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // 당김과 버튼이 **같은 재조회**를 부른다. 컨텐츠
  // 스케줄러와 같은 배선이어야 한다.
  it('당겨서 새로고침은 헤더 버튼과 같은 재조회를 부른다', async () => {
    const store = loaded()
    await renderScreen()

    await act(async () => {
      refreshControl().onRefresh()
    })

    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // 제스처를 붙여도 버튼은 그대로 남는다(추가 수단이지 대체가 아니다).
  it('제스처가 붙어도 헤더 버튼은 남는다', async () => {
    loaded()
    await renderScreen()

    expect(screen.getByLabelText('새로고침')).toBeTruthy()
    expect(refreshControl()).toBeDefined()
  })

  // 회귀 가드. 조회 중 과 당겼다 는 다른 사실이다.
  //
  // `refreshing = status === 'loading'` 으로 두면 화면 마운트 하이드레이션만으로 인디케이터가
  // 프로그램적으로 열린다. 조회 중… 은 그대로 뜬다. 그쪽이 조회를 말하는 자리다.
  it('조회 중이어도 인디케이터는 안 돈다. "조회 중..." 만 보여준다', async () => {
    loaded('loading')
    await renderScreen()

    expect(screen.getByText('조회 중...')).toBeTruthy()
    expect(refreshControl().refreshing).toBe(false)
  })

  // 동기화 상태는 드롭다운 줄이 아니라 **제목 줄**에 있다(컨텐츠 스케줄러와
  // 같은 케이스. 그 파일이 판정 방법을 적는다).
  it('새로고침과 동기화 시각이 제목과 같은 줄에 있다', async () => {
    loaded()
    await renderScreen()

    const titleRow = nearestCommonAncestor(
      screen.getByText('보스 스케줄러'),
      screen.getByLabelText('새로고침'),
    )

    expect(contains(titleRow, screen.getByText('동기화 기록 없음'))).toBe(true)
    // 아래 줄에 있어야 하는 것은 이제 초상화 레일이다.
    expect(contains(titleRow, screen.getByTestId('character-rail'))).toBe(false)
    // **관리 버튼과 겨루던 짝은 사라졌다**. 그 줄에 남은 것이 제목·상태·
    // 새로고침 셋뿐이라, 폭을 다투는 상대가 없다.
  })
})

describe('BossScreen: 실패의 목적지', () => {
  const failWith = (error: Store['error']): Store =>
    mockStore({ status: 'error', error, trackedOcids: ['ocid-1'], characters: [character()] })

  it('401 은 토스트가 아니라 키 무효화 경로로 간다', async () => {
    failWith({ kind: 'invalidApiKey' })

    await renderScreen()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('invalid')
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('429 도 같은 진입점을 탄다. 토스트는 아예 없다', async () => {
    failWith({ kind: 'rateLimited' })

    await renderScreen()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('rateLimited')
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('네트워크 실패는 다시 시도 액션이 붙은 토스트다', async () => {
    const store = failWith({ kind: 'network' })
    await renderScreen()

    expect(mockShowError).toHaveBeenCalledTimes(1)
    const action = mockShowError.mock.calls[0][1] as { label: string; onClick: () => void }
    expect(action.label).toBe('다시 시도')
    action.onClick()
    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // 실패의 대부분은 전역이 아니라 **캐릭터별**로 온다.
  it('캐릭터별 실패도 토스트다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ error: { kind: 'network' } })],
    })

    await renderScreen()

    expect(mockShowError).toHaveBeenCalledTimes(1)
  })

  // 영구 실패라 "다시 시도"는 눌러도 같은 400 이다.
  it('characterUnavailable 토스트에는 액션이 없다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ error: { kind: 'characterUnavailable' } })],
    })

    await renderScreen()

    expect(mockShowError).toHaveBeenCalledTimes(1)
    expect(mockShowError.mock.calls[0][1]).toBeUndefined()
  })

  it('isStale 이지만 error 가 없으면(캐시 우선 표시) 아무것도 알리지 않는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ isStale: true, error: null })],
    })

    await renderScreen()

    expect(mockShowError).not.toHaveBeenCalled()
    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
  })
})

describe('BossScreen: 솔로/파티 필터', () => {
  const 스우 = boss({ apiName: '스우', matchedBossName: '스우', difficulty: '하드', portraitSlug: 'lucid' })

  const withFilterFixture = (): Store =>
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      // 자쿰만 4인 파티. 나머지는 설정이 없어 솔로로 친다.
      partySizes: { 'ocid-1:자쿰:카오스': 4 },
      characters: [character({ weeklyBosses: [boss(), 스우] })],
    })

  it('파티원 2인 이상 설정된 카드에만 "n인" 배지가 붙는다', async () => {
    withFilterFixture()

    await renderScreen()

    expect(screen.getByText('4인')).toBeTruthy()
    expect(screen.queryByText('1인')).toBeNull()
  })

  it('필터를 "파티"로 고르면 2인 이상만 남는다', async () => {
    withFilterFixture()
    await renderScreen()

    await press(button('파티'))

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('스우')).toBeNull()
  })

  it('필터를 "솔로"로 고르면 미설정·1인만 남는다', async () => {
    withFilterFixture()
    await renderScreen()

    await press(button('솔로'))

    expect(screen.getByText('스우')).toBeTruthy()
    expect(screen.queryByText('자쿰')).toBeNull()
  })

  // 목록이 하나라 필터도 하나다. `파티` 를 고르면
  // 두 무리 모두에 걸린다(전에는 주간 필터가 월간 목록을 건드리지 않았다).
  it('필터 하나가 두 무리에 함께 걸린다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      partySizes: { 'ocid-1:자쿰:카오스': 4 },
      characters: [
        character({
          weeklyBosses: [boss(), 스우],
          monthlyBosses: [
            boss({
              apiName: '검은 마법사',
              matchedBossName: '검은마법사',
              difficulty: '하드',
              cycle: 'monthly',
              portraitSlug: 'blackMage',
            }),
          ],
        }),
      ],
    })
    await renderScreen()

    await press(button('파티'))

    // 자쿰만 파티 설정(4인)이 있다. 검마와 스우는 미설정이라 솔로로 취급돼 함께 사라진다.
    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('검은마법사')).toBeNull()
    expect(screen.queryByText('스우')).toBeNull()
    // 무리가 비면 그 헤더도 함께 사라진다.
    expect(sectionOrder()).toEqual(['weekly'])
  })

  // 보스가 0건인 빈 상태와 **다른 문구·다른 CTA** 다.
  it('필터 결과가 0개면 필터 빈 상태를 보여주고 CTA 가 필터를 되돌린다', async () => {
    // 파티 설정이 하나도 없으므로 "파티" 필터의 결과가 0이다. 보스 자체는 있다.
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ weeklyBosses: [boss(), 스우] })],
    })
    await renderScreen()

    await press(button('파티'))

    expect(screen.getByText('이 조건에 해당하는 보스가 없습니다')).toBeTruthy()
    // 보스가 0건인 빈 상태의 문구가 아니다.
    expect(screen.queryByText('등록된 보스가 없습니다')).toBeNull()

    await press(button('필터 초기화'))

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('이 조건에 해당하는 보스가 없습니다')).toBeNull()
  })
})

describe('BossScreen: 빈 상태 문구', () => {
  it('자동 모드는 게임 등록을 안내하고 CTA 가 없다. 목적지가 앱 밖이다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })

    await renderScreen()

    expect(screen.getByText('등록된 보스가 없습니다')).toBeTruthy()
    // 헤더 버튼이 사라졌으므로 이 화면에 "보스 관리"라는 글자는 **하나도 없다**.
    // 자동 모드에는 CTA 도 없다.
    expect(screen.queryByText('보스 관리')).toBeNull()
  })

  // CTA 는 남되 목적지가 하위 페이지가 아니라 **형제 탭**이다. 헤더 버튼이
  // 사라져 같은 라벨을 다투는 상대도 없어졌다.
  it('수동 모드는 "보스 관리" CTA 를 주고, 누르면 그 탭으로 간다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })
    await renderScreen()

    expect(screen.getByText('추적할 보스가 없습니다')).toBeTruthy()
    await press(button('보스 관리'))

    // 보스 관리는 이 화면과 **같은 스케줄러 단**에 산다. 층은 안 바뀌고 그 안에서 옆걸음한다
    //
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'ScheduleSubs',
      params: { screen: 'BossManage' },
    })
  })

  // 캐시 우선 표시 중(`isStale`)에는 자동 모드에서 "없다"고 단정하지 않는다.
  it('자동 모드에서 isStale 이면 빈 상태 문구를 그리지 않는다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character({ isStale: true })] })

    await renderScreen()

    expect(screen.queryByText('등록된 보스가 없습니다')).toBeNull()
  })

  //  의 헤더 진입점이 로 폐기됐다. 목록이 있는 화면에는
  // 관리로 가는 자리가 **하나도 없다**(하단바가 진다). 그 부재를 여기서 못 박는다.
  it('목록이 있으면 "보스 관리"로 가는 자리가 화면에 없다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character({ weeklyBosses: [boss()] })] })

    await renderScreen()

    expect(screen.queryByText('보스 관리')).toBeNull()
  })
})

describe('BossScreen: 카드 탭 → 파티 인원 모달', () => {
  const opened = async (overrides: Partial<Store> = {}): Promise<Store> => {
    const store = mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ weeklyBosses: [boss()] })],
      ...overrides,
    })
    await renderScreen()
    await press(screen.getByLabelText('자쿰 파티 설정'))
    return store
  }

  it('보스 카드를 탭하면 파티 인원 모달이 열린다', async () => {
    await opened()

    expect(screen.getByTestId('party-size-modal')).toBeTruthy()
    expect(screen.getByText('주간 보스')).toBeTruthy()
  })

  // 파티 인원은 완료 여부와 무관한 상시 데이터다.
  it('완료된 보스도 탭할 수 있다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ weeklyBosses: [boss({ isComplete: true })] })],
    })
    await renderScreen()

    await press(screen.getByLabelText('자쿰 파티 설정'))

    expect(screen.getByTestId('party-size-modal')).toBeTruthy()
  })

  it('스테퍼를 누르면 그 (보스, 난이도)로 setPartySize 를 부른다', async () => {
    const store = await opened()

    await press(screen.getByLabelText('자쿰 파티원 수 증가'))

    expect(store.setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 2)
  })

  it('저장이 실패하면 관리 페이지와 같은 문구로 토스트를 띄운다', async () => {
    await opened({ setPartySize: jest.fn(async () => Promise.reject(new Error('boom'))) as Store['setPartySize'] })

    await press(screen.getByLabelText('자쿰 파티원 수 증가'))

    expect(mockShowError).toHaveBeenCalledWith('파티원 수를 저장하지 못했습니다')
  })

  it('닫기를 누르면 모달이 사라진다', async () => {
    await opened()

    await press(screen.getByLabelText('닫기'))

    expect(screen.queryByTestId('party-size-modal')).toBeNull()
  })

  // 자동 모드의 난이도 전환은 멤버십이 아니라 "편집 대상" 전환이다.
  // 자쿰은 참조표에 카오스 하나뿐이라 세그먼트에 고를 것이 없다. 셋을 가진 스우로 연다.
  it('자동 모드에서 난이도를 바꿔도 멤버십 API 를 부르지 않고 그 난이도의 인원을 편집한다', async () => {
    const store = mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          weeklyBosses: [
            boss({ apiName: '스우', matchedBossName: '스우', difficulty: '하드', portraitSlug: 'lucid' }),
          ],
        }),
      ],
    })
    await renderScreen()
    await press(screen.getByLabelText('스우 파티 설정'))

    await press(button('익스트림'))

    expect(store.setManualBossDifficulty).not.toHaveBeenCalled()

    // 편집 대상이 옮겨졌다는 증거. 이제 스테퍼가 그 난이도로 저장한다.
    await press(screen.getByLabelText('스우 파티원 수 증가'))
    expect(store.setPartySize).toHaveBeenCalledWith('ocid-1', '스우', '익스트림', 2)
  })

  it('수동 모드에서 난이도를 바꾸면 단일 액션으로 멤버십을 교체한다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const store = mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: {
        'ocid-1': [{ kind: 'boss', contentName: '스우', difficulty: '하드' }],
      },
      characters: [character()],
    })
    await renderScreen()

    await press(screen.getByLabelText('스우 파티 설정'))
    await press(button('노멀'))

    expect(store.setManualBossDifficulty).toHaveBeenCalledWith('ocid-1', '스우', '노멀')
  })
})

describe('BossScreen: 수동 모드', () => {
  beforeEach(() => {
    useTrackingModeStore.setState({ mode: 'manual' })
  })

  it('게임 등록·완료와 무관하게 추적 중인 보스를 표시한다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: { 'ocid-1': [{ kind: 'boss', contentName: '스우', difficulty: '하드' }] },
      // 게임에는 자쿰이 등록돼 있지만 추적 목록에는 없다.
      characters: [character({ weeklyBosses: [boss()] })],
    })

    await renderScreen()

    expect(screen.getByText('스우')).toBeTruthy()
    expect(screen.queryByText('자쿰')).toBeNull()
  })

  it('한 번도 동기화된 적 없는 보스도 참조 테이블 cycle 로 표시한다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: { 'ocid-1': [{ kind: 'boss', contentName: '검은마법사', difficulty: '하드' }] },
      characters: [character()],
    })
    await renderScreen()

    // 월간 참조표의 보스라 `월간` 무리에 선다. 탭을 누를 필요가 없다.
    expect(screen.getByText('검은마법사')).toBeTruthy()
    expect(sectionOrder()).toEqual(['monthly'])
  })
})

// 주간 12마리를 채우면 남은 미처치 주간 보스는 `완료` 자리에 `마감`을 단다.
// 완료로 칠하지 않는 것이 핵심이다: 안 잡은 보스를 완료로 두면 그 거짓이 보스 수익의 금액이 된다.
describe('BossScreen: 주간 한도 마감 배지', () => {
  const WEEKLY_NAMES = (weeklyBossesData.weekly as { boss: string }[]).map((entry) => entry.boss)
  const PENDING = WEEKLY_NAMES[0]

  /** 끝에서부터 실제로 처치한 주간 보스들. `PENDING` 과 겹치지 않게 뒤에서 뽑는다. */
  function cleared(count: number): MatchedBoss[] {
    return WEEKLY_NAMES.slice(-count).map((name) =>
      boss({
        apiName: name,
        matchedBossName: name,
        difficulty: '하드',
        isRegistered: true,
        isComplete: true,
        ownComplete: true,
      }),
    )
  }

  function withClearCount(count: number): Store {
    return mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          weeklyBosses: [
            boss({ apiName: PENDING, matchedBossName: PENDING, difficulty: '하드' }),
            ...cleared(count),
          ],
          weeklyBossClearCount: count,
          weeklyBossClearLimitCount: WEEKLY_BOSS_CLEAR_LIMIT,
        }),
      ],
    })
  }

  it('한도를 채우면 미처치 카드가 `마감` 배지를 단다', async () => {
    withClearCount(WEEKLY_BOSS_CLEAR_LIMIT)

    await renderScreen()

    expect(screen.getByText('마감')).toBeTruthy()
    // 처치한 열두 장은 그대로 `완료`다. 마감이 완료를 대체하지 않는다.
    expect(screen.getAllByText('완료')).toHaveLength(WEEKLY_BOSS_CLEAR_LIMIT)
  })

  it('한 마리 모자라면 마감 배지가 없다', async () => {
    withClearCount(WEEKLY_BOSS_CLEAR_LIMIT - 1)

    await renderScreen()

    expect(screen.queryByText('마감')).toBeNull()
  })

  // `완료` 자리를 대신하는 배지라 **상자가 같아야** 한다. 크기가 다르면 같은 자리에서
  // 배지가 커졌다 작아졌다 하며 카드 오른쪽 끝이 흔들린다. 색만 갈린다.
  it('마감 배지는 완료 배지와 같은 크기다', async () => {
    withClearCount(WEEKLY_BOSS_CLEAR_LIMIT)

    await renderScreen()

    // NativeWind 가 `className` 을 스타일로 컴파일하므로 **결과 스타일**을 본다. 클래스 문자열을
    // 비교하면 같은 값을 다른 표기로 쓴 것도 **다르다** 가 된다.
    const boxOf = (label: string): Record<string, unknown> => {
      const { color, backgroundColor, ...box } = screen.getAllByText(label)[0].props.style as Record<
        string,
        unknown
      >
      void color
      void backgroundColor
      return box
    }

    expect(boxOf('마감')).toEqual(boxOf('완료'))
  })
})

//  후속. 한도를 채웠으면 진행 링도 꽉 찬다. 마감은 **이번 주에 더 할
// 것이 없다** 이므로 링이 100%에 못 닿으면 링이 거짓을 말한다.
describe('BossScreen: 한도 마감과 진행 링', () => {
  const WEEKLY_NAMES = (weeklyBossesData.weekly as { boss: string }[]).map((entry) => entry.boss)

  /** 링의 접근성 이름에 실린 주간 n/m. 링을 나타내는 것이 이것뿐이라 계약이 여기 있다. */
  function ringLabel(): string {
    const label = String(screen.getAllByTestId('character-portrait')[0].props.accessibilityLabel)
    return label.slice(label.indexOf('주간'))
  }

  /**
   * 이 결정이 겨누는 실제 상황. 열둘을 추적해 두고 **그중 열만** 잡은 뒤 목록 밖 둘로 한도를 채웠다.
   * 추적 목록은 열두 개 그대로이므로 링의 분모도 12다.
   */
  function withTrackedTwelveAndOutsideKills(): void {
    const tracked = WEEKLY_NAMES.slice(0, WEEKLY_BOSS_CLEAR_LIMIT)
    const outside = WEEKLY_NAMES.slice(-2)
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: {
        'ocid-1': tracked.map((name) => ({ contentName: name, kind: 'boss' as const, difficulty: '하드' })),
      },
      characters: [
        character({
          weeklyBosses: [
            // 추적한 열둘 중 열은 잡았다.
            ...tracked.slice(0, 10).map((name) =>
              boss({
                apiName: name,
                matchedBossName: name,
                difficulty: '하드',
                isComplete: true,
                ownComplete: true,
              }),
            ),
            // 나머지 둘은 미처치.
            ...tracked.slice(10).map((name) =>
              boss({ apiName: name, matchedBossName: name, difficulty: '하드', isComplete: false }),
            ),
            // 목록 밖 둘로 한도를 채웠다. 합이 12 처치다.
            ...outside.map((name) =>
              boss({
                apiName: name,
                matchedBossName: name,
                difficulty: '하드',
                isRegistered: false,
                isComplete: true,
                ownComplete: true,
              }),
            ),
          ],
          weeklyBossClearCount: WEEKLY_BOSS_CLEAR_LIMIT,
          weeklyBossClearLimitCount: WEEKLY_BOSS_CLEAR_LIMIT,
        }),
      ],
    })
  }

  it('한도를 채우면 링이 12/12로 꽉 찬다. 마감도 **다 한 것** 이다', async () => {
    withTrackedTwelveAndOutsideKills()

    await renderScreen()

    expect(ringLabel()).toBe(`주간 ${WEEKLY_BOSS_CLEAR_LIMIT}/${WEEKLY_BOSS_CLEAR_LIMIT}`)
  })

  // 회귀 가드. 한도 전에는 미처치가 그대로 분자에서 빠진다.
  it('한도 전에는 미처치가 링에서 빠진다', async () => {
    const tracked = WEEKLY_NAMES.slice(0, WEEKLY_BOSS_CLEAR_LIMIT)
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: {
        'ocid-1': tracked.map((name) => ({ contentName: name, kind: 'boss' as const, difficulty: '하드' })),
      },
      characters: [
        character({
          weeklyBosses: tracked
            .slice(0, 10)
            .map((name) =>
              boss({
                apiName: name,
                matchedBossName: name,
                difficulty: '하드',
                isComplete: true,
                ownComplete: true,
              }),
            ),
          weeklyBossClearCount: 10,
          weeklyBossClearLimitCount: WEEKLY_BOSS_CLEAR_LIMIT,
        }),
      ],
    })

    await renderScreen()

    expect(ringLabel()).toBe(`주간 10/${WEEKLY_BOSS_CLEAR_LIMIT}`)
  })
})
