// 이 화면이 지키는 것을 적는다.
//
// 갈린 것 셋
// ① **스택은 테스트용 껍데기다**(`ScreenStack`). 뒤로는 대개 `goBack` 이 불렸는가로 본다. 나가는 이동을 확인 창이 막는지는
//    `useScreenNavigation` 을 진짜로 돌려 실제 스택에서 본다
//
// ② `aria-pressed` → **`aria-selected` → `accessibilityState.selected`**(RN 접근성 상태에
//    *pressed* 가 없다. 설정·온보딩의 선택 카드가 이미 밟은 자리).
// ③ 잠금 행의 **스크림에서 블러가 빠진다**(`backdrop-filter` 가 RN 에 없다). 검사 대상은 흐림이
//    아니라 *"눌리지 않고, 사유가 행 위에 뜬다"* 라 그대로 남는다.
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { useState } from 'react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

import {
  useContentSchedulerStore,
  type ContentCharacterView,
  type ContentSchedulerStore,
} from '../../../features/content-scheduler/store'
import {
  useContentSchedule,
  type ContentSchedule,
} from '../../../features/content-scheduler/use-content-schedule'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { ScreenStack } from '../../../navigation/__tests__/screen-stack'
import { ContentManageScreen } from '../ContentManageScreen'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { useMapleIdOwners } from '../../../hooks/useMapleIdOwners'
import { useMapleIdNamesStore } from '../../../features/maple-id/names'

const mockShowError = jest.fn()
const goBack = jest.fn()

jest.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }) },
}))

// 넥슨에서 받은 스케줄은 스토어가 아니라 `useContentSchedule` 이 낸다. 스토어에는 기기 값(수동 추적)과
// 탭만 남는다. 출처가 둘이라 목도 둘이다.
jest.mock('../../../features/content-scheduler/use-content-schedule', () => ({
  useContentSchedule: jest.fn(),
}))

jest.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: jest.fn(),
}))

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

// 메이플 ID 소속은 기기 저장소에서 읽는다. 이 하네스에는 저장소가 없어 훅째 세운다.
jest.mock('../../../hooks/useMapleIdOwners', () => ({ useMapleIdOwners: jest.fn(() => null) }))

const mockedSchedule = jest.mocked(useContentSchedule)
const mockedStore = jest.mocked(useContentSchedulerStore)
const mockedNavigation = jest.mocked(useScreenNavigation)
const mockedMapleIdOwners = jest.mocked(useMapleIdOwners)

type Schedule = ContentSchedule
// `ReturnType<typeof useContentSchedulerStore>` 은 **`unknown` 이 된다**. zustand 의 훅이 오버로드라
// tsc 가 셀렉터 시그니처를 집는다. 스토어가 그 타입을 이미 내보내므로 그것을 그대로 쓴다.
type Store = ContentSchedulerStore

/** 훅이 내는 스케줄. 이 화면은 캐릭터 목록과 상태만 읽는다. */
function mockSchedule(overrides: Partial<Schedule> = {}): Schedule {
  const schedule: Schedule = {
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: ['ocid-1'],
    refresh: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  mockedSchedule.mockReturnValue(schedule)
  return schedule
}

/** 목 스토어의 실물. 받기가 저장된 목록을 바꾼 것을 흉내 낼 때 `setState` 로 바꾼다. */
let liveStore: UseBoundStore<StoreApi<Store>>

function mockStore(overrides: Partial<Store> = {}): Store {
  const base = {
    manualTrackedByOcid: {},
    saveManualContentDraft: jest.fn(async () => {}),
    saveManualSharedDraft: jest.fn(async () => {}),
    activeTab: 'daily' as const,
    setActiveTab: jest.fn(),
    selectedMapleId: null,
    setSelectedMapleId: jest.fn(),
    ...overrides,
  } as Store

  // 이 화면의 탭은 **로컬**이지만(진입 시점 승계) 스토어 탭이 초기값이므로
  // 목도 같은 모양으로 둔다.
  const live = create<Store>(() => base)
  liveStore = live
  mockedStore.mockImplementation(() => {
    const state = live()
    const [activeTab, setActiveTab] = useState(base.activeTab)
    const [selectedMapleId, setSelectedMapleId] = useState(base.selectedMapleId)
    return { ...state, activeTab, setActiveTab, selectedMapleId, setSelectedMapleId }
  })
  return base
}

/** 화면을 연 동안 받기가 저장된 값을 바꾼다. */
async function receive(change: Partial<Store>): Promise<void> {
  await act(async () => {
    liveStore.setState(change)
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

async function renderScreen(): Promise<void> {
  await renderOverlay(<ScreenStack screen={ContentManageScreen} />)
}

/** 아래 `저장`. 확인 창에도 같은 글자가 있어 testID 로 찾는다. */
function saveButton(): AtomElement {
  return screen.getByTestId('content-manage-save')
}

/**
 * 그 이름의 **행**(누를 수 있는 조상). 같은 글자가 그룹 헤더에도 있어(단독 항목 그룹) 매칭이
 * 여럿이므로, 버튼 조상이 있는 쪽을 고른다.
 *
 * 상태는 프롭이 아니라 `accessibilityState` 에서 읽는다. `Pressable` 이 `aria-selected`·`disabled`
 * 를 호스트 `View` 로 그대로 넘기지 않고 거기에 접어 넣는다.
 */
function row(label: string): AtomElement {
  for (const found of screen.getAllByText(label)) {
    let node: AtomElement | null = found
    while (node !== null && node.props.role !== 'button') node = node.parent
    if (node !== null) return node
  }
  throw new Error(`행을 찾지 못했다: ${label}`)
}

function stateOf(node: AtomElement): { selected?: boolean; disabled?: boolean } {
  return (node.props.accessibilityState ?? {}) as { selected?: boolean; disabled?: boolean }
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

beforeEach(() => {
  mockShowError.mockClear()
  goBack.mockClear()
  mockedNavigation.mockReturnValue({ navigate: jest.fn(), goBack } as never)
  useTrackingModeStore.setState({ mode: 'manual' })
  // 케이스가 한쪽만 고쳐도 다른 쪽이 비지 않게 둘 다 기본값으로 세운다.
  mockSchedule()
  mockStore()
})

// 선택은 이제 화면 스토어가 아니라 `useCharacterSelectionStore` 가 갖는다.
// 실물 스토어라 값이 파일 안에서 넘어가므로 테스트마다 되돌린다.
beforeEach(() => {
  useCharacterSelectionStore.setState({ selectedOcid: null })
  useMapleIdNamesStore.setState({ names: {} })
  mockedMapleIdOwners.mockReturnValue(null)
})

describe('ContentManageScreen', () => {
// 도달할 길이 없지만 계약은 남긴다.
  it('자동 모드면 물러난다', async () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockSchedule({ characters: [character()] })

    await renderScreen()

    expect(goBack).toHaveBeenCalled()
  })

  it('뒤로 버튼을 누르면 물러난다', async () => {
    mockSchedule({ characters: [character()] })
    await renderScreen()

    await press(screen.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalled()
  })

  it('일일 템플릿 전체를 보여주고 추적 중인 항목만 선택 상태다', async () => {
    mockSchedule({ characters: [character()] })
    mockStore({ manualTrackedByOcid: { 'ocid-1': [{ contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' }] } })

    await renderScreen()

    expect(screen.getByText('컨텐츠 관리')).toBeTruthy()
    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(true)
  })

  // 분류 이름을 그룹 헤더로 한 번만 말하고 행에는 표의 `displayName` 만 남긴다.
  it('분류는 그룹 헤더가 되고 행에는 접두사 없는 이름만 남는다', async () => {
    mockSchedule({ characters: [character()] })

    await renderScreen()

    expect(screen.getAllByText('일일 퀘스트').length).toBeGreaterThan(0)
    expect(screen.queryByText(/^\[일일 퀘스트\]/)).toBeNull()
  })

  // 주기 탭은 다른 화면처럼 제목 덩어리 오른쪽에 둔다. 레일 아래에 두면 이 화면만 탭 자리가 달랐다.
  it('일일 · 주간 · 공유 탭이 제목 덩어리 오른쪽에 선다', async () => {
    mockSchedule({ characters: [character()] })
    await renderScreen()

    const trailing = screen.getByTestId('page-header-title-trailing')
    expect(within(trailing).getByText('일일')).toBeTruthy()
    expect(within(trailing).getByText('주간')).toBeTruthy()
    expect(within(trailing).getByText('공유')).toBeTruthy()
  })

  it('일일 · 주간 탭에는 공유 컨텐츠 행이 없다', async () => {
    mockSchedule({ characters: [character()] })
    await renderScreen()

    expect(screen.queryByText('몬스터파크')).toBeNull()
    await press(row('주간'))
    expect(screen.queryByText('하이마운틴')).toBeNull()
  })

  it('주간 탭으로 바꾸면 주간 템플릿이 보인다', async () => {
    mockSchedule({ characters: [character()] })
    await renderScreen()

    await press(row('주간'))

    // `무릉도장`은 그룹 헤더와 행 양쪽에 있다(단독 항목 그룹). 행이 있다는 것으로 본다.
    expect(row('무릉도장')).toBeTruthy()
  })

  // 누를 때마다 저장하면 그만큼 서버 동기화가 깨어난다. 누른 것은 초안에만 든다.
  it('행을 눌러도 저장하지 않고 선택 상태만 바뀐다', async () => {
    mockSchedule({ characters: [character()] })
    const store = mockStore({ manualTrackedByOcid: { 'ocid-1': [{ contentKey: 'mu_lung_dojo', kind: 'daily' }] } })
    await renderScreen()

    await press(row('소멸의 여로 조사'))

    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(true)
    expect(store.saveManualContentDraft).not.toHaveBeenCalled()
  })

  // 캐릭터 관리의 저장 버튼과 같은 규칙이다. 저장된 값과 같아진 항목은 바꾼 것이 아니다.
  it('바꾼 것이 없으면 `저장` 을 누를 수 없고, 켰다 다시 끄면 다시 꺼진다', async () => {
    mockSchedule({ characters: [character()] })
    await renderScreen()

    expect(stateOf(saveButton()).disabled).toBe(true)
    await press(row('소멸의 여로 조사'))
    expect(stateOf(saveButton()).disabled).toBe(false)
    await press(row('소멸의 여로 조사'))
    expect(stateOf(saveButton()).disabled).toBe(true)
  })

  // 탭은 같은 캐릭터의 목록을 나눠 보여 줄 뿐이다. 바꾼 것은 그 탭의 kind 로 든다.
  it('탭을 바꿔도 초안이 남고, `저장` 이 두 탭의 바꾼 것을 한 번에 넘긴다', async () => {
    mockSchedule({ characters: [character()] })
    const store = mockStore({ manualTrackedByOcid: { 'ocid-1': [{ contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' }] } })
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(row('주간'))
    await press(row('무릉도장'))
    await press(row('일일'))

    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(false)
    await press(saveButton())

    expect(store.saveManualContentDraft).toHaveBeenCalledTimes(1)
    expect(store.saveManualContentDraft).toHaveBeenCalledWith('ocid-1', {
      daily: { daily_quest_road_of_vanishing: false },
      weekly: { mu_lung_dojo: true },
    })
  })

  // 저장 뒤에도 레일로 다른 캐릭터를 이어서 고치는 화면이다. 성공 문구는 없다.
  it('저장하면 `저장` 이 다시 꺼지고 화면에 남는다', async () => {
    mockSchedule({ characters: [character()] })
    const store = mockStore()
    ;(store.saveManualContentDraft as jest.Mock).mockImplementation(async () => {
      liveStore.setState({ manualTrackedByOcid: { 'ocid-1': [{ contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' }] } })
    })
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(saveButton())

    expect(stateOf(saveButton()).disabled).toBe(true)
    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(true)
    expect(goBack).not.toHaveBeenCalled()
    expect(screen.getByTestId('screen-ContentManage')).toBeTruthy()
  })

  // 바꾼 행이 화면에 그대로 있어 무엇이 저장되지 않았는지 보인다. 다시 누를 수 있다.
  it('저장이 실패하면 토스트로 알리고 초안이 남는다', async () => {
    mockSchedule({ characters: [character()] })
    mockStore({
      saveManualContentDraft: jest.fn(async () => {
        throw new Error('boom')
      }),
    })
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(saveButton())

    expect(mockShowError).toHaveBeenCalledWith('추적 목록을 저장하지 못했습니다')
    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(true)
    expect(stateOf(saveButton()).disabled).toBe(false)
  })

  // 관리 화면을 연 동안에도 받기가 저장된 목록을 바꿀 수 있다. 목록 전체를 복사해 두면 만지지 않은 항목까지 옛 값으로 덮는다.
  it('화면을 연 동안 받은 항목이 만지지 않은 행에 보이고, 저장은 바꾼 항목만 넘긴다', async () => {
    mockSchedule({ characters: [character()] })
    const store = mockStore()
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await receive({ manualTrackedByOcid: { 'ocid-1': [{ contentKey: 'daily_quest_lacheln', kind: 'daily' }] } })

    expect(stateOf(row('레헬른의 평온한 밤')).selected).toBe(true)
    await press(saveButton())
    expect(store.saveManualContentDraft).toHaveBeenCalledWith('ocid-1', { daily: { daily_quest_road_of_vanishing: true }, weekly: {} })
  })

  // 받기가 추적 캐릭터를 바꿔 고른 캐릭터가 넘어가도 앞 캐릭터의 초안이 새 캐릭터의 행에 얹히지 않는다.
  it('초안의 주인이 아닌 캐릭터에는 초안이 얹히지 않는다', async () => {
    mockSchedule({ characters: [character(), character({ ocid: 'ocid-2', characterName: '캐릭터2' })] })
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await act(async () => {
      useCharacterSelectionStore.setState({ selectedOcid: 'ocid-2' })
    })

    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(false)
    expect(stateOf(saveButton()).disabled).toBe(true)
  })

  // 확정된 빈 상태는 조회가 끝난 뒤에만 말할 수 있다.
  it('조회가 끝나기 전에는 빈 상태 문구 대신 로딩 카드를 보여준다', async () => {
    mockSchedule({ status: 'loading', characters: [] })

    await renderScreen()

    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
    expect(screen.queryByText(/캐릭터를 먼저 선택해주세요/)).toBeNull()
  })
})

describe('ContentManageScreen: 길드 미가입 잠금', () => {
  const GUILD_ITEM = '지하 수로'

  async function renderWeekly(guildName: string | null | undefined, tracked: string[] = []): Promise<void> {
    mockSchedule({ characters: [character({ guildName })] })
    mockStore({
      activeTab: 'weekly',
      manualTrackedByOcid: {
        'ocid-1': tracked.map((contentKey) => ({ contentKey, kind: 'weekly' as const })),
      },
    })
    await renderScreen()
  }

  it('길드가 있으면 선택할 수 있다', async () => {
    await renderWeekly('길드이름')

    expect(stateOf(row(GUILD_ITEM)).disabled).toBeFalsy()
    expect(screen.queryByText('길드 가입 시 진행 가능')).toBeNull()
  })

  it('미가입(null)이면 잠그고 사유를 행 위에 얹는다', async () => {
    await renderWeekly(null)

    expect(stateOf(row(GUILD_ITEM)).disabled).toBe(true)
    expect(screen.getAllByText('길드 가입 시 진행 가능').length).toBeGreaterThan(0)
  })

  // 모름(`undefined`)을 미가입으로 취급하면 멀쩡한 사용자의 길드 콘텐츠가 통째로 막힌다.
  it('길드 정보를 모르면 잠그지 않는다', async () => {
    await renderWeekly(undefined)

    expect(stateOf(row(GUILD_ITEM)).disabled).toBeFalsy()
  })

  it('길드 미가입이어도 길드 외 콘텐츠는 잠그지 않는다', async () => {
    await renderWeekly(null)

    expect(stateOf(row('무릉도장')).disabled).toBeFalsy()
  })

  // 길드를 나가도 해제할 수 있어야 한다.
  it('이미 추적 중인 길드 콘텐츠는 미가입이어도 활성이다', async () => {
    await renderWeekly(null, ['guild_underground_waterway'])

    expect(stateOf(row(GUILD_ITEM)).disabled).toBeFalsy()
  })
})


// 편집할 목록이 **빈 것이 아니라 모르는 것**이다. 체크박스를 세우면 사용자가 지금 추적을 고르고
// 있다고 믿는데, 그 선택은 조회가 돌아와야 뜻을 갖는다.
describe('조회 불가 캐릭터', () => {
  it('편집 목록 대신 안내가 선다', async () => {
    mockSchedule({
      status: 'loaded',
      characters: [character({ error: { kind: 'characterUnavailable' } })],
    })

    await renderScreen()

    expect(screen.getByText('이 캐릭터는 조회할 수 없습니다')).toBeTruthy()
    expect(screen.getByText('캐릭터 관리로 이동하기')).toBeTruthy()
  })
})

// 출시 전인 컨텐츠를 고를 수 있으면 안 된다. 기준은 지금 주간 기간이다.
describe('시작 기간 전인 컨텐츠', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  async function 주간목록(now: string): Promise<void> {
    jest.useFakeTimers({ now: new Date(now) })
    mockSchedule({ characters: [character()] })
    mockedMapleIdOwners.mockReturnValue({ ofOcid: { 'ocid-1': 'A' }, order: ['A'] })
    mockStore({ activeTab: 'shared' })
    await renderScreen()
  }

  it('2026-09-10 주에는 아우룸 레기스 행이 없다', async () => {
    await 주간목록('2026-09-16T03:00:00.000Z')

    expect(screen.queryByText('아우룸 레기스')).toBeNull()
    expect(row('악몽선경')).toBeTruthy()
  })

  it('2026-09-17 주부터 선다', async () => {
    await 주간목록('2026-09-18T03:00:00.000Z')

    expect(row('아우룸 레기스')).toBeTruthy()
  })
})

// 훅은 레벨이 높은 순서로 내보낸다. 레일은 캐릭터 관리에서 정한 저장 순서를 따라야 스케줄러에서 들어와도
// 같은 순서로 보인다.
describe('레일 순서', () => {
  const 레벨순 = [
    character({ characterName: '캐릭터1', level: 290 }),
    character({ ocid: 'ocid-2', characterName: '캐릭터2', level: 260 }),
  ]

  it('저장 순서가 레벨 순서와 다르면 저장 순서로 선다', async () => {
    mockSchedule({ trackedOcids: ['ocid-2', 'ocid-1'], characters: 레벨순 })

    await renderScreen()

    expect(
      screen.getAllByTestId('character-portrait').map((node) => node.props.accessibilityLabel),
    ).toEqual([expect.stringContaining('캐릭터2'), expect.stringContaining('캐릭터1')])
  })

  it('아직 안 골랐으면 저장 순서의 첫 캐릭터가 열린다', async () => {
    mockSchedule({ trackedOcids: ['ocid-2', 'ocid-1'], characters: 레벨순 })

    await renderScreen()

    const 고른칸 = screen
      .getAllByTestId('character-portrait')
      .find((node) => stateOf(node).selected === true)
    expect(고른칸?.props.accessibilityLabel).toEqual(expect.stringContaining('캐릭터2'))
  })
})

// 저장하지 않고 나가면 바꾼 것이 말없이 사라진다. 이 화면을 스택에서 빼는 이동을 한 곳에서 막는다.
describe('저장하지 않고 나갈 때', () => {
  const 확인창 = '저장하지 않은 변경이 있어요'

  beforeEach(() => {
    // 나가는 이동이 실제 스택을 지나야 막혔는지 볼 수 있다.
    mockedNavigation.mockImplementation(
      jest.requireActual<typeof import('../../../hooks/useScreenNavigation')>('../../../hooks/useScreenNavigation')
        .useScreenNavigation,
    )
    mockSchedule({ characters: [character()] })
  })

  function isOpen(): boolean {
    return screen.queryByTestId('screen-ContentManage', { includeHiddenElements: true }) !== null
  }

  it('바꾼 것이 없으면 확인 없이 나간다', async () => {
    await renderScreen()

    await press(screen.getByLabelText('뒤로'))

    expect(screen.queryByText(확인창)).toBeNull()
    expect(isOpen()).toBe(false)
  })

  it('바꾼 것이 있으면 확인 창을 띄우고 화면에 남는다', async () => {
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getByLabelText('뒤로'))

    expect(screen.getByText(확인창)).toBeTruthy()
    expect(screen.getByText('바꾼 내용을 저장할까요?')).toBeTruthy()
    expect(isOpen()).toBe(true)
  })

  it('`버리기` 는 저장하지 않고 나간다', async () => {
    const store = mockStore()
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getByLabelText('뒤로'))
    await press(screen.getByText('버리기'))

    expect(store.saveManualContentDraft).not.toHaveBeenCalled()
    expect(isOpen()).toBe(false)
  })

  it('`저장` 은 저장한 뒤 나간다', async () => {
    const store = mockStore()
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getByLabelText('뒤로'))
    await press(screen.getByTestId('unsaved-changes-primary'))

    expect(store.saveManualContentDraft).toHaveBeenCalledWith('ocid-1', { daily: { daily_quest_road_of_vanishing: true }, weekly: {} })
    expect(isOpen()).toBe(false)
  })

  // 실패한 채 나가면 바꾼 것이 사라진다. 창을 먼저 닫아야 토스트가 창 뒤에 가리지 않는다.
  it('창의 `저장` 이 실패하면 창을 닫고 토스트를 띄운 뒤 화면에 남는다', async () => {
    mockStore({
      saveManualContentDraft: jest.fn(async () => {
        throw new Error('boom')
      }),
    })
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getByLabelText('뒤로'))
    await press(screen.getByTestId('unsaved-changes-primary'))

    expect(screen.queryByText(확인창)).toBeNull()
    expect(mockShowError).toHaveBeenCalledWith('추적 목록을 저장하지 못했습니다')
    expect(isOpen()).toBe(true)
    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(true)
  })

  // 두 버튼 중 아무것도 고르지 않았으니 아무것도 하지 않는다.
  it('창 바깥을 누르면 창만 닫히고 초안이 남는다', async () => {
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getByLabelText('뒤로'))
    await press(screen.getByTestId('unsaved-changes'))

    expect(screen.queryByText(확인창)).toBeNull()
    expect(isOpen()).toBe(true)
    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(true)
  })

  // 모드는 서버 동기화가 다른 기기의 값을 받아 바꿀 수 있다. 이 화면이 스스로 뒤로 가는 것도 나가는 이동이다.
  it('자동 모드가 되어 스스로 뒤로 갈 때도 확인 창을 띄운다', async () => {
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await act(async () => {
      useTrackingModeStore.setState({ mode: 'auto' })
    })

    expect(screen.getByText(확인창)).toBeTruthy()
    expect(isOpen()).toBe(true)
  })
})

// 고른 캐릭터는 앱 전체가 함께 쓴다. 답을 받기 전에 바꾸면 스케줄러까지 다른 캐릭터로 넘어간다.
describe('바꾼 것이 있을 때 캐릭터 바꾸기', () => {
  beforeEach(() => {
    mockSchedule({ characters: [character(), character({ ocid: 'ocid-2', characterName: '캐릭터2' })] })
  })

  it('확인 창을 띄우고 고른 캐릭터는 그대로다', async () => {
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getAllByTestId('character-portrait')[1])

    expect(screen.getByText('저장하지 않은 변경이 있어요')).toBeTruthy()
    expect(useCharacterSelectionStore.getState().selectedOcid).toBeNull()
  })

  it('`버리기` 는 초안을 버리고 캐릭터를 바꾼다', async () => {
    const store = mockStore()
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getAllByTestId('character-portrait')[1])
    await press(screen.getByText('버리기'))

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
    expect(store.saveManualContentDraft).not.toHaveBeenCalled()
    await press(screen.getAllByTestId('character-portrait')[0])
    expect(stateOf(row('소멸의 여로 조사')).selected).toBe(false)
  })

  it('`저장` 은 저장한 뒤 캐릭터를 바꾼다', async () => {
    const store = mockStore()
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getAllByTestId('character-portrait')[1])
    await press(screen.getByTestId('unsaved-changes-primary'))

    expect(store.saveManualContentDraft).toHaveBeenCalledWith('ocid-1', { daily: { daily_quest_road_of_vanishing: true }, weekly: {} })
    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
  })

  it('창의 `저장` 이 실패하면 그 캐릭터에 남는다', async () => {
    mockStore({
      saveManualContentDraft: jest.fn(async () => {
        throw new Error('boom')
      }),
    })
    await renderScreen()

    await press(row('소멸의 여로 조사'))
    await press(screen.getAllByTestId('character-portrait')[1])
    await press(screen.getByTestId('unsaved-changes-primary'))

    expect(mockShowError).toHaveBeenCalledWith('추적 목록을 저장하지 못했습니다')
    expect(useCharacterSelectionStore.getState().selectedOcid).toBeNull()
  })

  it('바꾼 것이 없으면 확인 없이 바꾼다', async () => {
    await renderScreen()

    await press(screen.getAllByTestId('character-portrait')[1])

    expect(screen.queryByText('저장하지 않은 변경이 있어요')).toBeNull()
    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
  })
})

describe('공유 탭', () => {
  /** 메이플 ID A 에 캐릭터 둘, B 에 하나. */
  beforeEach(() => {
    mockSchedule({
      trackedOcids: ['a1', 'a2', 'b1'],
      characters: [
        character({ ocid: 'a1', characterName: '가' }),
        character({ ocid: 'a2', characterName: '다' }),
        character({ ocid: 'b1', characterName: '나' }),
      ],
    })
    mockedMapleIdOwners.mockReturnValue({ ofOcid: { a1: 'A', a2: 'A', b1: 'B' }, order: ['A', 'B'] })
    useMapleIdNamesStore.setState({ names: { A: '본계정', B: '부계정' } })
  })

  it('레일 자리에 메이플 ID 별칭이 서고, 공유 컨텐츠를 분류로 묶어 보인다', async () => {
    mockStore({ activeTab: 'shared' })
    await renderScreen()

    expect(screen.getAllByTestId('character-portrait').map((one) => one.props.accessibilityLabel)).toEqual(['본계정', '부계정'])
    expect(row('몬스터파크')).toBeTruthy()
    expect(row('하이마운틴')).toBeTruthy()
    expect(screen.queryByText('무릉도장')).toBeNull()
  })

  it('메이플 ID 소속을 아직 못 읽었으면 행 대신 로딩을 보인다', async () => {
    mockedMapleIdOwners.mockReturnValue(null)
    mockStore({ activeTab: 'shared' })
    await renderScreen()

    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
    expect(screen.queryByText('몬스터파크')).toBeNull()
  })

  it('그 메이플 ID 의 캐릭터 가운데 하나라도 추적하면 켜져 있다', async () => {
    mockStore({ activeTab: 'shared', manualTrackedByOcid: { a2: [{ contentKey: 'monster_park', kind: 'daily' }] } })
    await renderScreen()

    expect(stateOf(row('몬스터파크')).selected).toBe(true)
  })

  it('저장은 그 메이플 ID 의 추적 캐릭터 모두에 넘긴다', async () => {
    const store = mockStore({ activeTab: 'shared', manualTrackedByOcid: { a2: [{ contentKey: 'monster_park', kind: 'daily' }] } })
    await renderScreen()

    await press(row('몬스터파크'))
    await press(row('하이마운틴'))
    await press(saveButton())

    expect(store.saveManualSharedDraft).toHaveBeenCalledWith(['a1', 'a2'], {
      monster_park: false,
      epic_dungeon_high_mountain: true,
    })
    expect(store.saveManualContentDraft).not.toHaveBeenCalled()
  })

  it('바꾼 것이 있으면 다른 별칭을 고를 때 확인 창이 뜬다', async () => {
    mockStore({ activeTab: 'shared' })
    await renderScreen()

    await press(row('몬스터파크'))
    await press(screen.getByLabelText('부계정'))

    expect(screen.getByText('저장하지 않은 변경이 있어요')).toBeTruthy()
    expect(stateOf(screen.getAllByTestId('character-portrait')[0]).selected).toBe(true)
  })
})
