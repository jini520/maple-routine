// 컨텐츠 스케줄러 화면이 지키는 것을 적는다.
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
import { ContentScreen } from '../ContentScreen'
import { useScreenNavigation } from '../../use-screen-navigation'

// 이름이 `mock` 으로 시작해야 한다. babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다(안 지키면 트랜스폼 단계에서 죽는다).
const mockShowError = jest.fn()
const mockNoticeApiKeyIssue = jest.fn()
const navigate = jest.fn()
// 층이 스택이 된 뒤로 **그룹 층으로 되돌리기** 는 액션이다. 화면이 이것도 부른다.
const dispatch = jest.fn()

// 동기화 실패는 인라인 문단이 아니라 토스트다.
jest.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }) },
}))

// 401·429 는 토스트가 아니라 키 재입력 진입점으로 간다.
jest.mock('../../../features/auth/store', () => ({
  useAuthStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) },
}))

jest.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: jest.fn(),
}))

// **로스터 조회 목은 여기 없다**. 이 화면은 더 이상 피커를 열지 않으므로 `schedule-sync` 를
// 아예 부르지 않는다. 그 목은 설정 화면 테스트로 옮겨갔다.

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedStore = jest.mocked(useContentSchedulerStore)
const mockedNavigation = jest.mocked(useScreenNavigation)

// `ReturnType<typeof useContentSchedulerStore>` 은 **`unknown` 이 된다**. zustand 의 훅이 오버로드라
// tsc 가 셀렉터 시그니처를 집는다. 스토어가 그 타입을 이미 내보내므로 그것을 그대로 쓴다.
type Store = ContentSchedulerStore

/**
 * 탭이 스토어 소유라 정적 목으로는 전환이 렌더에 반영되지 않는다.
 * `setActiveTab` 을 불러도 다시 그릴 이유가 없다. 모킹된 훅도 렌더 중에 불리므로 여기서
 * `useState` 로 실물과 같은 "값 + 세터" 쌍을 흉내 낸다.
 */
function mockStore(overrides: Partial<Store> = {}): Store {
  const base = {
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    manualTrackedByOcid: {},
    loadTrackedOcids: jest.fn(),
    saveTrackedOcids: jest.fn(),
    // 실물은 `Promise<void>` 다. 당김 훅이 회차의 **끝** 을 기다린다.
    refresh: jest.fn().mockResolvedValue(undefined),
    addManualContent: jest.fn(),
    removeManualContent: jest.fn(),
    activeTab: 'daily' as const,
    setActiveTab: jest.fn(),
    ...overrides,
  } as Store

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

async function renderScreen(): Promise<ReturnType<typeof renderOverlay>> {
  return renderOverlay(<ContentScreen />)
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 글자에서 위로 올라가 실제로 눌리는 조상을 찾는 도우미. */
function buttonAt(label: string, index = 0): AtomElement {
  let node: AtomElement | null = screen.getAllByText(label)[index]
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

function button(label: string): AtomElement {
  return buttonAt(label)
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

describe('ContentScreen: 빈 상태와 마운트', () => {
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
    // **먼저 층을 바닥으로 되돌린다.** 이 화면은 하위 층에 살고 설정은 그룹 층에 사는데, 그룹 층은
    // 스택 바닥이라 그냥 이동하면 바닥에 있는 것을 한 번 더 쌓는다. 그러면 바는 ← 를 안 그리는데
    // 가장자리 스와이프는 뒤로 가는 어긋난 프레임이 된다.
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'POP_TO_TOP' }))
    expect(screen.queryByTestId('character-tracking-picker-modal')).toBeNull()
  })
})

describe('ContentScreen: 목록', () => {
  const withContents = (): void => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          dailyContents: [
            { name: '일간항목', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 3, questState: null },
            { name: '미등록', kind: 'contents', isRegistered: false, nowCount: 0, maxCount: 3, questState: null },
          ],
          weeklyContents: [
            { name: '주간항목', kind: 'contents', isRegistered: true, nowCount: 2, maxCount: 4, questState: null },
          ],
        }),
      ],
    })
  }

  it('기본 탭은 일간이고 등록된 항목만 보인다', async () => {
    withContents()

    await renderScreen()

    expect(screen.getByText('일간항목 · 1/3')).toBeTruthy()
    expect(screen.queryByText(/미등록/)).toBeNull()
    expect(screen.queryByText(/주간항목/)).toBeNull()
  })

  it('주간 탭을 누르면 주간 항목만 보인다', async () => {
    withContents()
    await renderScreen()

    await press(button('주간'))

    expect(screen.getByText('주간항목 · 2/4')).toBeTruthy()
    expect(screen.queryByText(/일간항목/)).toBeNull()
  })

  it('헤더와 목록이 공용 스크롤 셸 안에 있다', async () => {
    withContents()
    await renderScreen()

    // 둘 다 셸이 그린다. 헤더는 `header` 프롭으로, 목록은 자식으로. 헤더가 스크롤 뷰 **안** 인지는
    // `ScreenScroll` 테스트가 본다. **모달이 셸 바깥인지를 묻던 짝은 함께 사라졌다**. 이 화면에
    // 모달이 없다.
    expect(screen.getByTestId('page-header')).toBeTruthy()
    expect(screen.getByTestId('screen-scroll')).toBeTruthy()
  })

  // 헤더에서 없어진 것은 이 버튼 하나이고, 수동 모드의 "컨텐츠 관리"는 남는다
  // (그쪽은 아래 `수동 트래킹 모드` 절이 본다).
  it('헤더에 "캐릭터 관리" 버튼이 없다', async () => {
    withContents()

    await renderScreen()

    expect(screen.queryByText('캐릭터 관리')).toBeNull()
  })

  // 캐시가 있으면 재검증 중에도 계속 보여준다(셸 승계 카드는 보여줄 게 없을 때만).
  it('status 가 loading 이어도 캐시된 목록이 있으면 로딩 표시 대신 목록을 보여준다', async () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          dailyContents: [
            { name: '캐시항목', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 2, questState: null },
          ],
        }),
      ],
    })

    await renderScreen()

    expect(screen.getByText('캐시항목 · 1/2')).toBeTruthy()
    expect(screen.queryByText('불러오고 있어요')).toBeNull()
  })

  it('status 가 loading 이고 캐시도 없으면 로딩을 보여준다', async () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], characters: [] })

    await renderScreen()

    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
  })

  // 드롭다운이 초상화 레일이 되면서 **실제로 캐릭터가 바뀐다**. 전에는 목록(열린
  // 상태)이 없어 이 케이스가 **프롭이 있다** 까지밖에 못 봤다.
  // **부르는가** 가 아니라 **고른 것이 바뀌는가** 를 본다. 선택이 스토어 하나가 되면서
  // 그 값이 곧 다른 화면이 보는 값이다(공유가 전파 단계 없이 성립하는 자리).
  it('레일에서 다른 초상화를 누르면 고른 캐릭터가 그 ocid 가 된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      characters: [character(), character({ ocid: 'ocid-2', characterName: '캐릭터2' })],
    })
    await renderScreen()

    await press(screen.getAllByTestId('character-portrait')[1])

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
  })

  // 링이 세는 것과 카드 목록이 **같은 함수**에서 나온다. 등록 안 된 항목은 둘 다에서 빠진다.
  it('레일의 링은 표시 목록과 같은 것을 센다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          dailyContents: [
            { name: '완료됨', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 2 },
            { name: '미완료', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 0 },
            // 등록 안 된 항목은 목록에 없으므로 분모에도 없다.
            { name: '미등록', kind: 'quest', isRegistered: false, nowCount: 0, maxCount: 0, questState: 0 },
          ],
        }),
      ],
    })

    await renderScreen()

    expect(screen.getByTestId('character-portrait').props.accessibilityLabel).toContain('일간 1/2')
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

describe('ContentScreen: 재조회', () => {
  const loaded = (status: Store['status'] = 'loaded'): Store =>
    mockStore({ status, trackedOcids: ['ocid-1'], characters: [character()] })

  it('헤더 새로고침 버튼을 누르면 refresh 를 부른다', async () => {
    const store = loaded()
    await renderScreen()

    await press(screen.getByLabelText('새로고침'))

    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // 당김과 버튼이 **같은 재조회**를 부른다.
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

  // 그리고 당기면 **돈다**. 위 가드가 **인디케이터를 없앤 것** 으로 읽히지 않게 짝으로 둔다.
  it('당기면 그 회차 동안 인디케이터가 돈다', async () => {
    const store = loaded()
    let 회차_끝내기 = (): void => undefined
    jest.mocked(store.refresh).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          회차_끝내기 = resolve
        }),
    )
    await renderScreen()

    await act(async () => {
      refreshControl().onRefresh()
    })
    expect(refreshControl().refreshing).toBe(true)

    await act(async () => {
      회차_끝내기()
    })
    expect(refreshControl().refreshing).toBe(false)
  })

  // 동기화 상태는 드롭다운 줄이 아니라 **제목 줄**에 있다. `같은 줄인가`는
  // 최소 공통 조상으로 본다. 제목과 새로고침의 공통 조상 안에 캐릭터 드롭다운이 **없으면**
  // 그 조상이 곧 제목 줄이다(있으면 헤더 전체를 집은 것이라 아무것도 보장하지 못한다).
  it('새로고침과 동기화 시각이 제목과 같은 줄에 있다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })
    await renderScreen()

    const titleRow = nearestCommonAncestor(
      screen.getByText('컨텐츠 스케줄러'),
      screen.getByLabelText('새로고침'),
    )

    expect(contains(titleRow, screen.getByText('동기화 기록 없음'))).toBe(true)
    // 아래 줄에 있어야 하는 것은 이제 초상화 레일이다.
    expect(contains(titleRow, screen.getByTestId('character-rail'))).toBe(false)
  })
})

describe('ContentScreen: 실패의 목적지', () => {
  const failWith = (error: Store['error']): void => {
    mockStore({ status: 'error', error, trackedOcids: ['ocid-1'], characters: [character()] })
  }

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
    const store = mockStore({
      status: 'error',
      error: { kind: 'network' },
      trackedOcids: ['ocid-1'],
      characters: [character()],
    })
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

describe('ContentScreen: 수동 트래킹 모드', () => {
  beforeEach(() => {
    useTrackingModeStore.setState({ mode: 'manual' })
  })

  it('추적 중인 항목을 등록 여부와 무관하게 보여준다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          dailyContents: [
            { name: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 3, maxCount: 14, questState: null },
          ],
        }),
      ],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }] },
    })

    await renderScreen()

    expect(screen.getByText('3/14')).toBeTruthy()
  })

  // 멤버십의 `kind` 가 저장 시점에 확정돼 각 탭은 자기 것만 그린다.
  it('항목은 자기 kind 의 탭에만 나온다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '무릉도장', kind: 'weekly' }] },
    })
    await renderScreen()

    expect(screen.queryByText('무릉도장')).toBeNull()

    await press(button('주간'))
    expect(screen.getByText('무릉도장')).toBeTruthy()
  })

  it('헤더의 "컨텐츠 관리"를 누르면 관리 페이지로 민다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })
    await renderScreen()

    // 목록이 비면 빈 상태 CTA 도 같은 글자를 쓴다. 여기서는 **헤더 쪽**(트리 순서상 첫째)을 누른다.
    await press(buttonAt('컨텐츠 관리', 0))

    expect(navigate).toHaveBeenCalledWith('ContentManage')
  })

  // 빈 상태 CTA 가 지시하는 곳으로 데려간다(자동 모드는 목적지가 앱 밖이라 CTA 없음).
  it('빈 상태 CTA 도 같은 곳으로 민다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })
    await renderScreen()

    expect(screen.getByText('추적할 일간 컨텐츠가 없습니다')).toBeTruthy()
    await press(buttonAt('컨텐츠 관리', 1))
    expect(navigate).toHaveBeenCalledWith('ContentManage')
  })

  it('자동 모드에서는 "컨텐츠 관리" 버튼도 CTA 도 없다', async () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })

    await renderScreen()

    expect(screen.queryByText('컨텐츠 관리')).toBeNull()
    expect(screen.getByText('등록된 일간 컨텐츠가 없습니다')).toBeTruthy()
  })
})
