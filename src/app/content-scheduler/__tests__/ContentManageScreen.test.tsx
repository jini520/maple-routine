// 웹판(290줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① **라우터가 없다** — 뒤로는 `goBack` 이 불렸는가로, 자동 모드 리다이렉트도 같은 것으로 본다
//    (웹은 `<Navigate to="/content" replace />` 였고 그 프로브를 라우트에 심었다).
// ② `aria-pressed` → **`aria-selected` → `accessibilityState.selected`**(RN 접근성 상태에
//    *pressed* 가 없다 — 설정·온보딩의 선택 카드가 이미 밟은 자리).
// ③ 잠금 행의 **스크림에서 블러가 빠진다**(`backdrop-filter` 가 RN 에 없다). 검사 대상은 흐림이
//    아니라 *"눌리지 않고, 사유가 행 위에 뜬다"* 라 그대로 남는다.
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { useState } from 'react'

import {
  useContentSchedulerStore,
  type ContentCharacterView,
  type ContentSchedulerStore,
} from '../../../features/content-scheduler/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { ContentManageScreen } from '../ContentManageScreen'
import { useScreenNavigation } from '../../use-screen-navigation'

const mockShowError = jest.fn()
const goBack = jest.fn()

jest.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }) },
}))

jest.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: jest.fn(),
}))

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedStore = jest.mocked(useContentSchedulerStore)
const mockedNavigation = jest.mocked(useScreenNavigation)

// `ReturnType<typeof useContentSchedulerStore>` 은 **`unknown` 이 된다** — zustand 의 훅이 오버로드라
// tsc 가 셀렉터 시그니처를 집는다. 스토어가 그 타입을 이미 내보내므로 그것을 그대로 쓴다.
type Store = ContentSchedulerStore

function mockStore(overrides: Partial<Store> = {}): Store {
  const base = {
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: ['ocid-1'],
    manualTrackedByOcid: {},
    loadTrackedOcids: jest.fn(),
    saveTrackedOcids: jest.fn(),
    // 실물은 `Promise<void>` 다 — 당김 훅이 회차의 «끝» 을 기다린다.
    refresh: jest.fn().mockResolvedValue(undefined),
    addManualContent: jest.fn(async () => {}),
    removeManualContent: jest.fn(async () => {}),
    activeTab: 'daily' as const,
    setActiveTab: jest.fn(),
    ...overrides,
  } as Store

  // 이 화면의 탭은 **로컬**이지만(진입 시점 승계) 스토어 탭이 초기값이므로
  // 목도 같은 모양으로 둔다.
  mockedStore.mockImplementation(() => {
    const [activeTab, setActiveTab] = useState(base.activeTab)
    return { ...base, activeTab, setActiveTab }
  })
  return base
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
  await renderOverlay(<ContentManageScreen />)
}

/**
 * 그 이름의 **행**(누를 수 있는 조상). 같은 글자가 그룹 헤더에도 있어(단독 항목 그룹) 매칭이
 * 여럿이므로, 버튼 조상이 있는 쪽을 고른다.
 *
 * 상태는 프롭이 아니라 `accessibilityState` 에서 읽는다 — `Pressable` 이 `aria-selected`·`disabled`
 * 를 호스트 `View` 로 그대로 넘기지 않고 거기에 접어 넣는다(실측).
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
})

// 선택은 이제 화면 스토어가 아니라 `useCharacterSelectionStore` 가 갖는다.
// 실물 스토어라 값이 파일 안에서 넘어가므로 테스트마다 되돌린다.
beforeEach(() => {
  useCharacterSelectionStore.setState({ selectedOcid: null })
})

describe('ContentManageScreen', () => {
  it('마운트하면 loadTrackedOcids 를 부른다 — 직접 진입해도 스토어가 채워진다', async () => {
    const store = mockStore({ characters: [character()] })

    await renderScreen()

    expect(store.loadTrackedOcids).toHaveBeenCalled()
  })

  // 웹의 `<Navigate to="/content" replace />` 자리. RN 에서는 도달할 길이 없지만 계약은 남긴다.
  it('자동 모드면 물러난다', async () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({ characters: [character()] })

    await renderScreen()

    expect(goBack).toHaveBeenCalled()
  })

  it('뒤로 버튼을 누르면 물러난다', async () => {
    mockStore({ characters: [character()] })
    await renderScreen()

    await press(screen.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalled()
  })

  it('일간 템플릿 전체를 보여주고 추적 중인 항목만 선택 상태다', async () => {
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }] },
    })

    await renderScreen()

    expect(screen.getByText('컨텐츠 관리')).toBeTruthy()
    expect(stateOf(row('몬스터파크')).selected).toBe(true)
  })

  // 접두사를 그룹 헤더로 한 번만 말하고 행에는 알맹이만 남긴다(2026-07-24 리디자인).
  it('반복 접두사는 그룹 헤더가 되고 행에는 뗀 이름만 남는다', async () => {
    mockStore({ characters: [character()] })

    await renderScreen()

    expect(screen.getAllByText('일일 퀘스트').length).toBeGreaterThan(0)
    expect(screen.queryByText(/^\[일일 퀘스트\]/)).toBeNull()
  })

  it('주간 탭으로 바꾸면 주간 템플릿이 보인다', async () => {
    mockStore({ characters: [character()] })
    await renderScreen()

    await press(row('주간'))

    // 「무릉도장」은 그룹 헤더와 행 양쪽에 있다(단독 항목 그룹) — 행이 있다는 것으로 본다.
    expect(row('무릉도장')).toBeTruthy()
  })

  it('미추적 항목을 누르면 현재 탭의 kind 로 즉시 추가한다', async () => {
    const store = mockStore({ characters: [character()] })
    await renderScreen()

    await press(row('몬스터파크'))

    expect(store.addManualContent).toHaveBeenCalledWith('ocid-1', '몬스터파크', 'daily')
  })

  it('추적 중 항목을 누르면 즉시 제거한다', async () => {
    const store = mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }] },
    })
    await renderScreen()

    await press(row('몬스터파크'))

    expect(store.removeManualContent).toHaveBeenCalledWith('ocid-1', '몬스터파크', 'daily')
  })

  // 전에는 프로미스를 버려 저장 실패가 무음이었다.
  it('토글 저장이 실패하면 토스트로 알린다', async () => {
    mockStore({
      characters: [character()],
      addManualContent: jest.fn(async () => {
        throw new Error('boom')
      }) as unknown as Store['addManualContent'],
    })
    await renderScreen()

    await press(row('몬스터파크'))

    expect(mockShowError).toHaveBeenCalledWith('추적 목록을 저장하지 못했습니다')
  })

  // 확정된 빈 상태는 조회가 끝난 뒤에만 말할 수 있다.
  it('조회가 끝나기 전에는 빈 상태 문구 대신 로딩 카드를 보여준다', async () => {
    mockStore({ status: 'loading', characters: [] })

    await renderScreen()

    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
    expect(screen.queryByText(/캐릭터를 먼저 선택해주세요/)).toBeNull()
  })

  it('조회가 끝났는데 캐릭터가 없으면 안내 문구를 보여준다', async () => {
    mockStore({ status: 'loaded', characters: [] })

    await renderScreen()

    expect(screen.getByText(/캐릭터를 먼저 선택해주세요/)).toBeTruthy()
  })
})

describe('ContentManageScreen — 길드 미가입 잠금', () => {
  const GUILD_ITEM = '지하 수로'

  async function renderWeekly(guildName: string | null | undefined, tracked: string[] = []): Promise<void> {
    mockStore({
      characters: [character({ guildName })],
      activeTab: 'weekly',
      manualTrackedByOcid: {
        'ocid-1': tracked.map((contentName) => ({ contentName, kind: 'weekly' as const })),
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
    await renderWeekly(null, ['[길드] 지하 수로'])

    expect(stateOf(row(GUILD_ITEM)).disabled).toBeFalsy()
  })
})
