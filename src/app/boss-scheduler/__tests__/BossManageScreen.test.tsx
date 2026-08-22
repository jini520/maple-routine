// 웹판(`BossManageScreen.test.tsx` 574줄)의 **명세를 읽어 다시 쓴 것**이다.
//
// ── 갈린 것 넷 ───────────────────────────────────────────────────────────────────────
//
// ① **라우터 프로브가 없다** — 뒤로는 `navigation.goBack()` 이 불렸는가로 봤다(`StackScreen` 이
//    통째로 사라지고 루트 스택이 그 자리를 맡는다, [[ADR-120]]). **[[ADR-145]] 결정 1 로 그 계약이
//    없어졌다** — 이 화면은 탭이라 pop 할 스택이 없고, 남은 것은 «화면 안에 ← 가 없다» 하나다.
// ② `closest('li')` 로 행을 잡던 자리가 **`aria-label` 로 잡는 토글 버튼**이다 — RN 에 DOM 조회가
//    없고, 웹도 이미 그 버튼에 보스명을 `aria-label` 로 박아 두었다.
// ③ `aria-pressed` → **`accessibilityState.selected`**(RN 접근성 상태에 *pressed* 가 없다).
// ④ **보스 목록·난이도·상한은 전부 참조 데이터에서 온다** — 이 파일에도 게임 수치를 손으로 적지
//    않는다([[ADR-006]]). 12개 한도 케이스의 보스 이름도 `weekly-bosses.json` 에서 뽑아 쓴다.
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { act, fireEvent, screen, within } from '@testing-library/react-native'

import weeklyBossesData from '../../../data/weekly-bosses.json'
import {
  useBossSchedulerStore,
  type BossCharacterView,
  type BossSchedulerStore,
} from '../../../features/boss-scheduler/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss-matching'
import type { MatchedBoss } from '../../../lib/boss-matching'
import type { ManualTrackedItem } from '../../../types'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
import { BossManageScreen } from '../BossManageScreen'

const mockShowError = jest.fn()
const mockShowInfo = jest.fn()
const goBack = jest.fn()

jest.mock('../../../features/toast/store', () => ({
  useToastStore: {
    getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: mockShowInfo }),
  },
}))

jest.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: jest.fn(),
  partySizeKey: (ocid: string, boss: string, difficulty: string) => `${ocid}:${boss}:${difficulty}`,
}))

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedStore = jest.mocked(useBossSchedulerStore)
const mockedNavigation = jest.mocked(useScreenNavigation)

type Store = BossSchedulerStore

/** 참조표에서 뽑은 이름 — 손으로 적으면 데이터가 바뀔 때 조용히 어긋난다([[ADR-006]]). */
const WEEKLY_NAMES = weeklyBossesData.weekly
  .filter((entry) => (entry as { status?: string }).status !== 'unreleased')
  .map((entry) => entry.boss)
const SEASON_NAME = weeklyBossesData.eventWeekly[0].boss
const MONTHLY_NAME = weeklyBossesData.monthly[0].boss
// 미출시 보스는 있을 때도 없을 때도 있다 — 벨로나 출시로 현재는 0개다([[ADR-151]] 결정 4·5).
// `!` 로 단정하면 표본이 사라진 순간 `undefined` 를 찾는 검증이 되어 조용히 통과한다.
const UNRELEASED_NAME = (weeklyBossesData.weekly as { boss: string; status?: string }[]).find(
  (entry) => entry.status === 'unreleased',
)?.boss

function mockStore(overrides: Partial<Store> = {}): Store {
  const base = {
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: ['ocid-1'],
    partySizes: {},
    manualTrackedByOcid: {},
    loadTrackedOcids: jest.fn(),
    saveTrackedOcids: jest.fn(),
    // 실물은 `Promise<void>` 다 — 당김 훅이 회차의 «끝» 을 기다린다([[ADR-160]] 결정 1).
    refresh: jest.fn().mockResolvedValue(undefined),
    loadPartySizes: jest.fn(),
    setPartySize: jest.fn(),
    addManualBoss: jest.fn(async () => 'added'),
    removeManualBoss: jest.fn(),
    setManualBossDifficulty: jest.fn(),
    partyFilter: 'all' as const,
    setPartyFilter: jest.fn(),
    ...overrides,
  } as Store

  // [[ADR-164]] 결정 4: 탭이 걷혔다 — 목이 흉내 낼 탭 상태가 없다.
  mockedStore.mockImplementation(() => base)
  return base
}

/** 화면에 선 섹션 헤더를 위에서 아래 순서로 — 스케줄러 화면의 같은 이름 헬퍼와 같은 규칙이다. */
function sectionOrder(): string[] {
  return screen
    .queryAllByTestId(/^boss-section-header-/)
    .map((node) => String(node.props.testID).replace('boss-section-header-', ''))
}

function character(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
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

function registeredBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
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

function trackedBoss(contentName: string, difficulty: string): ManualTrackedItem {
  return { kind: 'boss', contentName, difficulty } as ManualTrackedItem
}

async function renderScreen(): Promise<ReturnType<typeof renderOverlay>> {
  return renderOverlay(<BossManageScreen />)
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 수동 모드 행의 추적 토글 — 웹도 이 버튼에 보스명을 `aria-label` 로 박아 두었다. */
function rowToggle(bossName: string): AtomElement {
  return screen.getByLabelText(bossName)
}

function stateOf(node: AtomElement): { selected?: boolean; disabled?: boolean; checked?: boolean } {
  return (node.props.accessibilityState ?? {}) as {
    selected?: boolean
    disabled?: boolean
    checked?: boolean
  }
}

/** 글자에서 위로 올라가 실제로 눌리는 조상을 찾는다. */
function button(label: string, index = 0): AtomElement {
  let node: AtomElement | null = screen.getAllByText(label)[index]
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

beforeEach(() => {
  mockShowError.mockClear()
  mockShowInfo.mockClear()
  goBack.mockClear()
  mockedNavigation.mockReturnValue({ navigate: jest.fn(), goBack, setParams: jest.fn() } as never)
  useTrackingModeStore.setState({ mode: 'auto' })
})

// 선택은 이제 화면 스토어가 아니라 `useCharacterSelectionStore` 가 갖는다([[ADR-159]]).
// 실물 스토어라 값이 파일 안에서 넘어가므로 테스트마다 되돌린다.
beforeEach(() => {
  useCharacterSelectionStore.setState({ selectedOcid: null })
})

describe('BossManageScreen — 공통', () => {
  // [[ADR-142]] 정정 8: 제목 줄 우측의 compact 드롭다운이 **초상화 레일**이 됐다. 캐릭터 이름은
  // 이제 SVG 곡선 글자라 `getByText` 로 안 잡힌다 — 레일이 섰는지로 본다.
  //
  // **뒤로 버튼을 묻던 짝은 사라졌다**([[ADR-145]] 결정 1) — 이 화면은 하위 페이지가 아니라 탭이라
  // pop 할 스택이 없고, ← 는 하단바가 진다([[ADR-132]] 결정 3).
  it('제목·캐릭터 레일이 보이고, 화면 안에 뒤로 버튼이 없다', async () => {
    mockStore({ characters: [character()] })

    await renderScreen()

    expect(screen.getByText('보스 관리')).toBeTruthy()
    expect(screen.getByTestId('character-rail')).toBeTruthy()
    expect(screen.queryByLabelText('뒤로')).toBeNull()
    expect(goBack).not.toHaveBeenCalled()
  })

  // 정정 8: 이 화면의 일은 캐릭터를 고르는 것이지 진행을 보는 것이 아니다.
  it('관리 화면의 레일에는 진행 링이 없다', async () => {
    mockStore({ characters: [character()] })

    await renderScreen()

    expect(screen.queryAllByTestId('portrait-ring-track')).toHaveLength(0)
    expect(screen.queryAllByTestId('portrait-ring-fill')).toHaveLength(0)
  })

  it('마운트하면 loadTrackedOcids 를 부른다 — 스케줄러를 거치지 않고 들어와도 채워진다', async () => {
    const store = mockStore({ characters: [character()] })

    await renderScreen()

    expect(store.loadTrackedOcids).toHaveBeenCalled()
  })

  it('표시할 캐릭터가 없으면 안내 문구를 보여준다', async () => {
    mockStore({ status: 'loaded', characters: [] })

    await renderScreen()

    expect(screen.getByText(/캐릭터를 먼저 선택해주세요/)).toBeTruthy()
  })

  // [[ADR-061]] 결정 10 — 조회가 끝나기 전에는 빈 상태 문구로 위장하지 않는다.
  it('조회가 끝나기 전에는 빈 상태 문구 대신 로딩 카드를 보여준다', async () => {
    mockStore({ status: 'loading', characters: [] })

    await renderScreen()

    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
    expect(screen.queryByText(/캐릭터를 먼저 선택해주세요/)).toBeNull()
  })

  // [[ADR-164]] 결정 4 — 스케줄러가 한 목록이 되면서 이 화면의 탭도 함께 걷혔다. [[ADR-096]]
  // 결정 2 와 [[ADR-145]] 결정 2(«승계가 아니라 공유»)가 이 축에서 폐기된 자리다 — 공유할 상대가
  // 사라졌으므로 되살리지 말 것.
  it('탭 없이 월간·주간이 한 목록에 서고, 월간이 위다', async () => {
    mockStore({ characters: [character()] })

    await renderScreen()

    expect(screen.getByText(MONTHLY_NAME)).toBeTruthy()
    expect(screen.getByText(WEEKLY_NAMES[0])).toBeTruthy()
    expect(screen.queryByRole('button', { name: '월간' })).toBeNull()
    expect(sectionOrder()).toEqual(['monthly', 'weekly'])
  })

  // [[ADR-096]] 결정 4 — 선택 캐릭터는 스케줄러와 **공유**한다(탭과 달리 양방향).
  // 정정 8: 드롭다운은 눌러도 안 열렸다 — 레일은 **실제로 바뀐다**. [[ADR-159]] 로 그 «같은 선택»
  // 이 두 스토어의 우연이 아니라 **스토어 하나**가 됐고, 그래서 여기서 보는 값이 컨텐츠 스케줄러가
  // 보는 값과 같은 것이다.
  it('레일에서 다른 초상화를 누르면 고른 캐릭터가 그 ocid 가 된다', async () => {
    mockStore({
      characters: [character(), character({ ocid: 'ocid-2', characterName: '캐릭터2' })],
    })
    await renderScreen()

    await press(screen.getAllByTestId('character-portrait')[1])

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
  })
})

describe('BossManageScreen — 수동 모드', () => {
  beforeEach(() => {
    useTrackingModeStore.setState({ mode: 'manual' })
  })

  it('주간 탭에 참조표의 주간 보스가 나오고, 추적 중인 보스만 선택 상태다', async () => {
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('자쿰', '카오스')] },
    })

    await renderScreen()

    expect(stateOf(rowToggle('자쿰')).selected).toBe(true)
    expect(stateOf(rowToggle('매그너스')).selected).toBe(false)
  })

  it('월간 보스가 같은 목록의 「월간」 무리에 선다', async () => {
    mockStore({ characters: [character()] })

    await renderScreen()

    expect(screen.getByText(MONTHLY_NAME)).toBeTruthy()
    expect(screen.getByText('자쿰')).toBeTruthy()
  })

  it('추적 중인 행에만 난이도 세그먼트와 파티 스테퍼가 펼쳐진다', async () => {
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('스우', '하드')] },
    })

    await renderScreen()

    expect(screen.getByLabelText('스우 파티원 수 증가')).toBeTruthy()
    expect(screen.queryByLabelText('자쿰 파티원 수 증가')).toBeNull()
  })

  it('미추적 보스를 탭하면 기본 난이도(등록 난이도 우선)로 addManualBoss 를 부른다', async () => {
    const store = mockStore({
      characters: [
        character({
          weeklyBosses: [registeredBoss({ apiName: '스우', matchedBossName: '스우', difficulty: '익스트림' })],
        }),
      ],
    })
    await renderScreen()

    await press(rowToggle('스우'))

    expect(store.addManualBoss).toHaveBeenCalledWith('ocid-1', '스우', '익스트림')
  })

  it('등록 난이도가 없으면 참조표의 첫 난이도로 부른다', async () => {
    const store = mockStore({ characters: [character()] })
    await renderScreen()

    await press(rowToggle('스우'))

    expect(store.addManualBoss).toHaveBeenCalledWith('ocid-1', '스우', '노멀')
  })

  it('추적 중인 보스를 탭하면 추적 난이도로 removeManualBoss 를 부른다', async () => {
    const store = mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('스우', '하드')] },
    })
    await renderScreen()

    await press(rowToggle('스우'))

    expect(store.removeManualBoss).toHaveBeenCalledWith('ocid-1', '스우', '하드')
  })

  // [[ADR-121]] 결정 6 — remove → add 2단계가 아니라 **쓰기 1회**다.
  it('추적 중인 보스의 다른 난이도를 누르면 단일 액션으로 교체한다', async () => {
    const store = mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('스우', '하드')] },
    })
    await renderScreen()

    await press(button('익스트림'))

    expect(store.setManualBossDifficulty).toHaveBeenCalledWith('ocid-1', '스우', '익스트림')
    expect(store.removeManualBoss).not.toHaveBeenCalled()
    expect(store.addManualBoss).not.toHaveBeenCalled()
  })

  it('파티 스테퍼는 즉시 저장하고, 상한은 (보스, 난이도)마다 다르다', async () => {
    // 스우 익스트림의 상한은 2인이다(`boss-crystal-prices.json`) — 화면이 숫자를 정하지 않는다.
    const store = mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('스우', '익스트림')] },
      partySizes: { 'ocid-1:스우:익스트림': 2 },
    })
    await renderScreen()

    expect(stateOf(screen.getByLabelText('스우 파티원 수 증가')).disabled).toBe(true)

    await press(screen.getByLabelText('스우 파티원 수 감소'))

    expect(store.setPartySize).toHaveBeenCalledWith('ocid-1', '스우', '익스트림', 1)
  })

  // [[ADR-065]] 결정 4 — 저장 실패가 무음이면 체크가 조용히 되돌아가는 것 외에 설명이 없다.
  it('추적 저장이 실패하면 토스트로 알린다', async () => {
    mockStore({
      characters: [character()],
      addManualBoss: jest.fn(async () => Promise.reject(new Error('boom'))) as Store['addManualBoss'],
    })
    await renderScreen()

    await press(rowToggle('자쿰'))

    expect(mockShowError).toHaveBeenCalledWith('추적 목록을 저장하지 못했습니다')
  })

  it('파티원 수 저장이 실패하면 스케줄러 모달과 같은 문구로 알린다', async () => {
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('자쿰', '카오스')] },
      setPartySize: jest.fn(async () => Promise.reject(new Error('boom'))) as Store['setPartySize'],
    })
    await renderScreen()

    await press(screen.getByLabelText('자쿰 파티원 수 증가'))

    expect(mockShowError).toHaveBeenCalledWith('파티원 수를 저장하지 못했습니다')
  })
})

describe('BossManageScreen — 자동 모드', () => {
  // [[ADR-145]] 결정 3: 상단 안내 한 줄을 없앤다 — 체크가 없고 스테퍼만 있다는 것을 화면이 이미
  // 보여 준다. 설명은 기능 안내(`boss-manage` 가이드)가 계속 진다.
  it('안내 문구 없이 등록 보스만 나오고 체크 토글이 없다', async () => {
    mockStore({ characters: [character({ weeklyBosses: [registeredBoss()] })] })

    await renderScreen()

    expect(screen.queryByText(/자동 모드에서는 목록이 게임 등록 기준이에요/)).toBeNull()
    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('매그너스')).toBeNull()
    // 수동 모드의 행 토글 버튼이 없다.
    expect(screen.queryByLabelText('자쿰')).toBeNull()
  })

  // [[ADR-145]] 결정 4: 스위치가 뒤집혔다 — 이름은 「모든 보스 보기」이고 **기본이 꺼짐**이다.
  // 표시 결과는 그대로라(기본 = 등록된 보스만) 위 케이스가 그 절반을 이미 지킨다.
  it('토글은 「모든 보스 보기」이고 기본으로 꺼져 있다', async () => {
    mockStore({ characters: [character({ weeklyBosses: [registeredBoss()] })] })

    await renderScreen()

    expect(screen.queryByText('등록된 보스만 보기')).toBeNull()
    expect(screen.getByText('모든 보스 보기')).toBeTruthy()
    expect(stateOf(screen.getByLabelText('모든 보스 보기')).checked).toBe(false)
  })

  it('토글을 켜면 전체 보스가 나와 미등록 보스도 파티를 미리 설정할 수 있다', async () => {
    mockStore({ characters: [character({ weeklyBosses: [registeredBoss()] })] })
    await renderScreen()

    await press(screen.getByLabelText('모든 보스 보기'))

    expect(screen.getByText('매그너스')).toBeTruthy()
    expect(stateOf(screen.getByLabelText('모든 보스 보기')).checked).toBe(true)
  })

  // [[ADR-031]] 결정 4 — 등록 보스가 하나도 없으면 토글이 꺼져 있어도 전체로 대체한다([[ADR-145]]
  // 결정 4 가 승계했다 — 뒤집힌 것은 스위치의 방향과 이름뿐이다).
  it('등록된 보스가 하나도 없으면 토글이 꺼져 있어도 전체 목록이다', async () => {
    mockStore({ characters: [character()] })

    await renderScreen()

    expect(stateOf(screen.getByLabelText('모든 보스 보기')).checked).toBe(false)
    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.getByText('매그너스')).toBeTruthy()
  })

  it('등록 난이도가 기본 선택되고, 스테퍼는 그 난이도로 저장한다', async () => {
    const store = mockStore({
      characters: [
        character({
          weeklyBosses: [registeredBoss({ apiName: '스우', matchedBossName: '스우', difficulty: '하드' })],
        }),
      ],
    })
    await renderScreen()

    await press(screen.getByLabelText('스우 파티원 수 증가'))

    expect(store.setPartySize).toHaveBeenCalledWith('ocid-1', '스우', '하드', 2)
  })

  // 자동 모드의 난이도 선택은 멤버십이 아니라 "편집 대상" 전환이다([[ADR-121]] 결정 3과 같은 뜻).
  it('자동 모드에서 난이도를 바꿔도 멤버십 API 를 부르지 않는다', async () => {
    const store = mockStore({
      characters: [
        character({
          weeklyBosses: [registeredBoss({ apiName: '스우', matchedBossName: '스우', difficulty: '하드' })],
        }),
      ],
    })
    await renderScreen()

    await press(button('익스트림'))

    expect(store.setManualBossDifficulty).not.toHaveBeenCalled()
    expect(store.addManualBoss).not.toHaveBeenCalled()

    await press(screen.getByLabelText('스우 파티원 수 증가'))
    expect(store.setPartySize).toHaveBeenCalledWith('ocid-1', '스우', '익스트림', 2)
  })
})

describe('BossManageScreen — 주간 12개 한도 ([[ADR-055]])', () => {
  // 참조표에서 앞에서부터 12마리를 뽑는다 — 이름을 손으로 적지 않는다([[ADR-006]]).
  const TWELVE = WEEKLY_NAMES.slice(0, WEEKLY_BOSS_CLEAR_LIMIT)

  const atLimit = (extra: Partial<Store> = {}): Store =>
    mockStore({
      characters: [character({ world: '챌린저스' })],
      manualTrackedByOcid: { 'ocid-1': TWELVE.map((name) => trackedBoss(name, '노멀')) },
      ...extra,
    })

  beforeEach(() => {
    useTrackingModeStore.setState({ mode: 'manual' })
  })

  it('주간 탭 헤더에 n/12 카운터를 표시한다', async () => {
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('자쿰', '카오스'), trackedBoss('스우', '하드')] },
    })

    await renderScreen()

    expect(screen.getByText(`2/${WEEKLY_BOSS_CLEAR_LIMIT}`)).toBeTruthy()
  })

  // 카운트 규칙은 `countManualWeeklyBosses` 한 곳에만 있다 — 화면이 다시 세면 선택 12/12 인데
  // 처치 11/12 인 모순이 생긴다([[ADR-055]] 결정 3).
  it('시즌 보스·월간 보스는 카운터에 포함하지 않는다', async () => {
    mockStore({
      characters: [character({ world: '챌린저스' })],
      manualTrackedByOcid: {
        'ocid-1': [
          trackedBoss('자쿰', '카오스'),
          trackedBoss(SEASON_NAME, '하드'),
          trackedBoss(MONTHLY_NAME, '하드'),
        ],
      },
    })

    await renderScreen()

    expect(screen.getByText(`1/${WEEKLY_BOSS_CLEAR_LIMIT}`)).toBeTruthy()
  })

  // [[ADR-164]] 결정 3: 탭이 없어져 «이 수치는 주간 것» 을 말할 자리가 「주간」 헤더로 옮겨왔다.
  it('카운터는 「주간」 헤더에만 붙는다 — 12는 주간 한도다', async () => {
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('자쿰', '카오스')] },
    })

    await renderScreen()

    const weekly = screen.getByTestId('boss-section-header-weekly')
    expect(within(weekly).getByText(`1/${WEEKLY_BOSS_CLEAR_LIMIT}`)).toBeTruthy()
    expect(
      within(screen.getByTestId('boss-section-header-monthly')).queryByText(`1/${WEEKLY_BOSS_CLEAR_LIMIT}`),
    ).toBeNull()
  })

  it('자동 모드에는 카운터를 표시하지 않는다 — 선택 자체가 없다', async () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [trackedBoss('자쿰', '카오스')] },
    })

    await renderScreen()

    expect(screen.queryByText(`1/${WEEKLY_BOSS_CLEAR_LIMIT}`)).toBeNull()
  })

  // [[ADR-055]] 정정 3 — 비활성 버튼은 클릭 이벤트가 나지 않아 이유를 알릴 수 없다.
  it('한도에 도달해도 미선택 보스의 토글을 비활성화하지 않는다', async () => {
    atLimit()
    await renderScreen()

    const blocked = rowToggle(WEEKLY_NAMES[WEEKLY_BOSS_CLEAR_LIMIT])
    expect(stateOf(blocked).disabled).not.toBe(true)
  })

  it('한도가 찬 상태에서 미선택 보스를 누르면 정보 톤 토스트로 이유를 알린다', async () => {
    const store = atLimit({ addManualBoss: jest.fn(async () => 'limitReached') as Store['addManualBoss'] })
    await renderScreen()

    await press(rowToggle(WEEKLY_NAMES[WEEKLY_BOSS_CLEAR_LIMIT]))

    expect(store.addManualBoss).toHaveBeenCalled()
    // 실패가 아니라 규칙 안내라 `showError` 가 아니다(그쪽은 자동 소멸이 없다).
    expect(mockShowInfo).toHaveBeenCalledWith(`주간 ${WEEKLY_BOSS_CLEAR_LIMIT}개를 모두 선택했어요`)
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('한도에 걸리지 않은 추가는 토스트를 띄우지 않는다', async () => {
    mockStore({ characters: [character()] })
    await renderScreen()

    await press(rowToggle('자쿰'))

    expect(mockShowInfo).not.toHaveBeenCalled()
  })

  it('한도에 도달해도 이미 선택된 보스는 해제할 수 있다', async () => {
    const store = atLimit()
    await renderScreen()

    await press(rowToggle(TWELVE[0]))

    expect(store.removeManualBoss).toHaveBeenCalled()
  })

  it('한도에 도달해도 시즌 보스는 선택할 수 있다', async () => {
    const store = atLimit()
    await renderScreen()

    await press(rowToggle(SEASON_NAME))

    expect(store.addManualBoss).toHaveBeenCalledWith('ocid-1', SEASON_NAME, '노멀')
  })

  it('한도에 도달해도 월간 보스는 선택할 수 있다', async () => {
    const store = atLimit()
    await renderScreen()

    await press(rowToggle(MONTHLY_NAME))

    expect(store.addManualBoss).toHaveBeenCalled()
  })
})

describe('BossManageScreen — 목록 구성 ([[ADR-056]])', () => {
  beforeEach(() => {
    useTrackingModeStore.setState({ mode: 'manual' })
  })

  // 참조표에 미출시 엔트리가 있을 때만 돌린다. 규칙([[ADR-056]] 결정 1)은 표본이 없어도 코드에
  // 남아 있으므로 테스트도 남기되, 표본이 없으면 건너뛴다([[ADR-151]] 결정 5).
  const 미출시표본있음 = UNRELEASED_NAME !== undefined
  ;(미출시표본있음 ? it : it.skip)(
    '미출시 보스는 목록에 나오지 않는다 — 이름이 아니라 status 로 거른다',
    async () => {
      mockStore({ characters: [character()] })

      await renderScreen()

      expect(screen.queryByText(UNRELEASED_NAME!)).toBeNull()
    },
  )

  it.each([
    ['챌린저스 월드 캐릭터에게는 시즌 보스가 나온다', '챌린저스2', true],
    ['일반 월드 캐릭터에게는 시즌 보스가 나오지 않는다', '스카니아', false],
  ])('%s', async (_label, world, shown) => {
    mockStore({ characters: [character({ world })] })

    await renderScreen()

    expect(screen.queryByText(SEASON_NAME) !== null).toBe(shown)
  })

  // 스케줄러의 시즌 배지와 **같은 판정**이어야 두 화면이 갈라지지 않는다.
  it('월드를 모르면(구버전 캐시) 시즌 보스를 숨긴다', async () => {
    mockStore({ characters: [character({ world: undefined })] })

    await renderScreen()

    expect(screen.queryByText(SEASON_NAME)).toBeNull()
  })

  it('자동 모드에서도 같은 규칙이 적용된다', async () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({ characters: [character({ world: '스카니아' })] })

    await renderScreen()

    expect(screen.queryByText(SEASON_NAME)).toBeNull()
    if (UNRELEASED_NAME !== undefined) expect(screen.queryByText(UNRELEASED_NAME)).toBeNull()
  })
})
