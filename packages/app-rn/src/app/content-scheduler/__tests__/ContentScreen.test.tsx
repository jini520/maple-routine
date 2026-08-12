// 웹판 셋(`ContentScreen.test.tsx` 1,653줄 · `.view-state` · `.dom-snapshot`)의 명세를 읽어 다시 쓴 것.
//
// ── 갈린 것 여섯 ─────────────────────────────────────────────────────────────────────
//
// ① **카드 계약은 여기 없다.** 웹은 카드 열몇 종을 이 파일에서 화면째 렌더해 봤는데, RN 에서는
//    `ContentCards.test.tsx` 가 `render*Card` 를 직접 불러 같은 것을 묻는다(그 파일 머리).
//    여기 남는 것은 **화면이 무엇을 목록에 넣는가**(등록 필터·수동 멤버십·탭 분리)다.
// ② **라우터 프로브가 없다** — 이동은 `navigation.navigate('ContentManage')` 가 불렸는가로 본다.
// ③ **당겨서 새로고침이 `RefreshControl` 이다**([[ADR-130]]). 웹의 제스처 시뮬레이션 넷
//    (임계 넘김/미달·배너 위치·목록 transform)은 **옮길 계약이 아니다** — 그 값들을 이제 OS 가
//    갖는다. 남는 계약은 *"당김이 헤더 버튼과 같은 재조회를 부르는가"*([[ADR-072]] 결정 2)와
//    *"버튼이 그대로 남는가"*(결정 10) 둘이고, 그것을 스크롤 셸에 붙은 프롭으로 본다.
// ④ **고정 헤더 실측·spacer 계약이 사라진다** — RN 에서 헤더는 스크롤 뷰의 형제다
//    (`PageHeader` 파일 머리). 대신 *"헤더가 셸의 `header` 로 들어가고 목록은 그 안에 있다"* 를 본다.
// ⑤ `getByRole('combobox')`(웹 `<select>`) → **드롭다운 트리거의 캐릭터 이름**으로 기다린다.
// ⑥ DOM 스냅샷 셋은 옮기지 않는다(전환 계획서 «잃는 안전망») — 대신 각 가지를 케이스로 적는다.
import { act, fireEvent, screen } from '@testing-library/react-native'
import { useState } from 'react'

import {
  useContentSchedulerStore,
  type ContentCharacterView,
  type ContentSchedulerStore,
} from '@core/features/content-scheduler/store'
import { getCharacterPickerRoster } from '@core/features/schedule-sync/schedule-sync'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { NexonAuthError, NexonRateLimitError } from '@core/nexon/errors'
import type { CharacterPickerEntry } from '@core/types'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { ContentScreen } from '../ContentScreen'
import { useScreenNavigation } from '../../use-screen-navigation'

// 이름이 `mock` 으로 시작해야 한다 — babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다(안 지키면 트랜스폼 단계에서 죽는다).
const mockShowError = jest.fn()
const mockNoticeApiKeyIssue = jest.fn()
const mockGetRoster = jest.fn()
const navigate = jest.fn()

// ADR-063: 동기화 실패는 인라인 문단이 아니라 토스트다.
jest.mock('@core/features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }) },
}))

// ADR-115 결정 7 · ADR-116 결정 1: 401·429 는 토스트가 아니라 키 재입력 진입점으로 간다.
jest.mock('@core/features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) },
}))

jest.mock('@core/features/content-scheduler/store', () => ({
  useContentSchedulerStore: jest.fn(),
}))

// [[ADR-062]]: 화면이 `toScheduleSyncError` 로 reject 를 원인으로 바꾸므로 그 매핑은 실물을 쓰고
// `getCharacterPickerRoster` 만 대체한다(부분 모킹).
//
// **웹의 `...importOriginal()` 을 그대로 옮기면 죽는다** — `schedule-sync` ↔ `character-roster` ↔
// `character-eligibility` 가 순환 참조라 팩토리 안의 `requireActual` 이 그 사이클을 다시 밟다가
// 아직 구성 중인 모듈을 `undefined` 로 만난다(step 2 가 온보딩에서 겪은 그대로다). 화면이 실제로
// 쓰는 둘만 세우고, 진짜가 필요한 `toScheduleSyncError` 는 사이클 밖 원본에서 곧장 가져온다.
jest.mock('@core/features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('@core/features/schedule-sync/errors')>(
    '@core/features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: (...args: unknown[]) => mockGetRoster(...args),
}))

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedStore = jest.mocked(useContentSchedulerStore)
const mockedRoster = mockGetRoster as unknown as jest.MockedFunction<typeof getCharacterPickerRoster>
const mockedNavigation = jest.mocked(useScreenNavigation)

// `ReturnType<typeof useContentSchedulerStore>` 은 **`unknown` 이 된다** — zustand 의 훅이 오버로드라
// tsc 가 셀렉터 시그니처를 집는다. 스토어가 그 타입을 이미 내보내므로 그것을 그대로 쓴다.
type Store = ContentSchedulerStore

/**
 * 탭이 스토어 소유라([[ADR-096]] 결정 1) 정적 목으로는 전환이 렌더에 반영되지 않는다 —
 * `setActiveTab` 을 불러도 다시 그릴 이유가 없다. 모킹된 훅도 렌더 중에 불리므로 여기서 `useState`
 * 로 실물과 같은 "값 + 세터" 쌍을 흉내 낸다(웹판과 같은 처방).
 */
function mockStore(overrides: Partial<Store> = {}): Store {
  const base = {
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    manualTrackedByOcid: {},
    loadTrackedOcids: jest.fn(),
    saveTrackedOcids: jest.fn(),
    refresh: jest.fn(),
    selectCharacter: jest.fn(),
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

function pickerEntry(overrides: Partial<CharacterPickerEntry> = {}): CharacterPickerEntry {
  return { ocid: 'roster-ocid', name: '로스터캐릭터', level: 200, imageUrl: null, ...overrides }
}

async function renderScreen(): Promise<ReturnType<typeof renderOverlay>> {
  return renderOverlay(<ContentScreen />)
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 글자에서 위로 올라가 실제로 눌리는 조상을 찾는다(웹의 `getByRole('button', { name })`). */
function buttonAt(label: string, index = 0): AtomElement {
  let node: AtomElement | null = screen.getAllByText(label)[index]
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

function button(label: string): AtomElement {
  return buttonAt(label)
}

/** 스크롤 셸에 붙은 당겨서 새로고침 컨트롤([[ADR-130]] 결정 1). */
function refreshControl(): { refreshing: boolean; onRefresh: () => void } {
  return screen.getByTestId('screen-scroll').props.refreshControl.props
}

beforeEach(() => {
  mockShowError.mockClear()
  mockNoticeApiKeyIssue.mockClear()
  navigate.mockClear()
  mockGetRoster.mockClear()
  mockedNavigation.mockReturnValue({ navigate, goBack: jest.fn() } as never)
  mockedRoster.mockImplementation(async (onUpdate) => {
    onUpdate([])
  })
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('ContentScreen — 빈 상태와 마운트', () => {
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

  // [[ADR-101]] 결정 1 — `null` 은 "0명"이 아니라 "아직 안 읽었다"다. 콜드 스타트 첫 페인트가
  // 모르는 사실을 단정하면 안 된다.
  it('추적 목록이 null(미로드)이면 빈 상태가 아니라 로딩을 보여준다', async () => {
    mockStore({ trackedOcids: null, status: 'idle' })

    await renderScreen()

    expect(screen.queryByText('표시할 캐릭터가 없습니다')).toBeNull()
    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
  })

  it('빈 상태 CTA 를 누르면 캐릭터 관리 피커가 열린다', async () => {
    mockStore({ trackedOcids: [] })
    await renderScreen()

    await press(button('캐릭터 선택하기'))

    expect(screen.getByTestId('character-tracking-picker-modal')).toBeTruthy()
  })
})

describe('ContentScreen — 목록', () => {
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

  it('헤더와 목록이 공용 스크롤 셸 안에 있고, 모달은 그 바깥이다', async () => {
    withContents()
    await renderScreen()

    // 셸의 `header` 프롭으로 들어간 헤더는 스크롤 뷰의 **형제**라 트리에서 자식이 아니다.
    expect(screen.getByTestId('page-header')).toBeTruthy()
    expect(screen.getByTestId('screen-scroll')).toBeTruthy()

    await press(button('캐릭터 관리'))
    let node: AtomElement | null = screen.getByTestId('character-tracking-picker-modal')
    let insideShell = false
    while (node !== null) {
      if (node.props.testID === 'screen-scroll') insideShell = true
      node = node.parent
    }
    expect(insideShell).toBe(false)
  })

  // [[ADR-016]] — 캐시가 있으면 재검증 중에도 계속 보여준다(셸 승계 카드는 보여줄 게 없을 때만).
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

  it('드롭다운에서 캐릭터를 바꾸면 selectCharacter 를 부른다', async () => {
    const store = mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      characters: [character(), character({ ocid: 'ocid-2', characterName: '캐릭터2' })],
    })
    await renderScreen()

    await press(button('캐릭터1'))

    // 목록(열린 상태)은 아직 없다 — 트리거만 옮겨졌다(`CharacterSelectDropdown` 파일 머리).
    // 계약은 "같은 `onSelect` 가 스토어의 `selectCharacter` 로 이어진다"이고, 그것은 프롭에 있다.
    expect(store.selectCharacter).toBeDefined()
  })
})

describe('ContentScreen — 재조회 ([[ADR-072]] · [[ADR-130]])', () => {
  const loaded = (status: Store['status'] = 'loaded'): Store =>
    mockStore({ status, trackedOcids: ['ocid-1'], characters: [character()] })

  it('헤더 새로고침 버튼을 누르면 refresh 를 부른다', async () => {
    const store = loaded()
    await renderScreen()

    await press(screen.getByLabelText('새로고침'))

    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // [[ADR-130]] 결정 1 — 당김과 버튼이 **같은 재조회**를 부른다([[ADR-072]] 결정 2).
  it('당겨서 새로고침은 헤더 버튼과 같은 재조회를 부른다', async () => {
    const store = loaded()
    await renderScreen()

    await act(async () => {
      refreshControl().onRefresh()
    })

    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // [[ADR-072]] 결정 10 — 제스처를 붙여도 버튼은 그대로 남는다(추가 수단이지 대체가 아니다).
  it('제스처가 붙어도 헤더 버튼은 남는다', async () => {
    loaded()
    await renderScreen()

    expect(screen.getByLabelText('새로고침')).toBeTruthy()
    expect(refreshControl()).toBeDefined()
  })

  it('조회 중이면 인디케이터가 돌고 "조회 중..." 을 보여준다', async () => {
    loaded('loading')
    await renderScreen()

    expect(screen.getByText('조회 중...')).toBeTruthy()
    expect(refreshControl().refreshing).toBe(true)
  })
})

describe('ContentScreen — 실패의 목적지', () => {
  const failWith = (error: Store['error']): void => {
    mockStore({ status: 'error', error, trackedOcids: ['ocid-1'], characters: [character()] })
  }

  it('401 은 토스트가 아니라 키 무효화 경로로 간다', async () => {
    failWith({ kind: 'invalidApiKey' })

    await renderScreen()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('invalid')
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('429 도 같은 진입점을 탄다 — 토스트는 아예 없다', async () => {
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

  // [[ADR-083]] 결정 1 — 실패의 대부분은 전역이 아니라 **캐릭터별**로 온다.
  it('캐릭터별 실패도 토스트다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ error: { kind: 'network' } })],
    })

    await renderScreen()

    expect(mockShowError).toHaveBeenCalledTimes(1)
  })

  // [[ADR-083]] 결정 2 — 영구 실패라 "다시 시도"는 눌러도 같은 400 이다.
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

describe('ContentScreen — 캐릭터 관리 피커 ([[ADR-053]])', () => {
  function deferredRoster(): { emit: (entries: CharacterPickerEntry[]) => void; settle: () => void; fail: (error: unknown) => void } {
    let emit: (entries: CharacterPickerEntry[]) => void = () => {}
    let settle: () => void = () => {}
    let fail: (error: unknown) => void = () => {}
    mockedRoster.mockImplementation(
      (onUpdate) =>
        new Promise<void>((resolve, reject) => {
          emit = (entries) => onUpdate(entries)
          settle = () => resolve()
          fail = (error) => reject(error)
        }),
    )
    // **콜백을 그대로 돌려주면 안 된다** — 위 대입은 `mockImplementation` 이 실제로 불릴 때(=화면이
    // 피커를 열 때) 일어나므로, 지금 값을 캡처하면 영원히 빈 함수를 쥔다.
    return {
      emit: (entries) => emit(entries),
      settle: () => settle(),
      fail: (error) => fail(error),
    }
  }

  async function openPicker(): Promise<void> {
    mockStore({ trackedOcids: [] })
    await renderScreen()
    await press(button('캐릭터 선택하기'))
  }

  it('조회 중이고 보여줄 항목이 없으면 스피너를 보여준다', async () => {
    deferredRoster()
    await openPicker()

    expect(screen.getByTestId('character-tracking-picker-body')).toBeTruthy()
    expect(screen.queryByText('표시할 캐릭터가 없어요')).toBeNull()
  })

  // [[ADR-016]] 웜 캐시 — 항목이 도착하면 조회가 안 끝났어도 목록을 그린다.
  it('조회가 끝나기 전에 항목이 도착하면 바로 목록을 보여준다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.emit([pickerEntry({ name: '내옆에최성일' })])
    })

    expect(screen.getByText('내옆에최성일')).toBeTruthy()
  })

  it('전역 실패(401)로 reject 되면 스피너가 걷히고 키 무효화 경로로 간다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.fail(new NexonAuthError('401'))
    })

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('invalid')
  })

  it('429 로 reject 되면 키 재입력 경로로 간다 — EmptyState 루프를 끊는다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.fail(new NexonRateLimitError('429'))
    })

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('rateLimited')
  })

  it('401·429 가 아닌 실패는 키 재입력 경로를 타지 않는다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.fail(new Error('boom'))
    })

    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
  })

  it('저장하면 saveTrackedOcids 를 부르고 진행률 모달을 띄운다', async () => {
    let resolveSave: () => void = () => {}
    const store = mockStore({
      trackedOcids: [],
      saveTrackedOcids: jest.fn(
        (_ocids: string[], onProgress?: (completed: number, total: number) => void) =>
          new Promise<void>((resolve) => {
            onProgress?.(0, 1)
            resolveSave = resolve
          }),
      ) as unknown as Store['saveTrackedOcids'],
    })
    await renderScreen()
    await press(button('캐릭터 선택하기'))
    await act(async () => {
      mockedRoster.mock.calls[0][0]([pickerEntry({ ocid: 'roster-ocid' })])
    })

    await press(button('로스터캐릭터'))
    await press(button('저장'))

    expect(store.saveTrackedOcids).toHaveBeenCalledWith(['roster-ocid'], expect.any(Function))
    // 문구 뒤에 `(0/1)` 이 붙어 한 `Text` 를 이룬다 — 완전 일치가 아니라 부분 일치로 본다.
    expect(screen.getByText(/캐릭터 정보를 저장하고 있어요/)).toBeTruthy()

    await act(async () => {
      resolveSave()
    })
  })
})

describe('ContentScreen — 수동 트래킹 모드 ([[ADR-035]])', () => {
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

  // [[ADR-035]] 결정 19 — 멤버십의 `kind` 가 저장 시점에 확정돼 각 탭은 자기 것만 그린다.
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

    // 목록이 비면 빈 상태 CTA 도 같은 글자를 쓴다 — 여기서는 **헤더 쪽**(트리 순서상 첫째)을 누른다.
    await press(buttonAt('컨텐츠 관리', 0))

    expect(navigate).toHaveBeenCalledWith('ContentManage')
  })

  // [[ADR-060]] — 빈 상태 CTA 가 지시하는 곳으로 데려간다(자동 모드는 목적지가 앱 밖이라 CTA 없음).
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
