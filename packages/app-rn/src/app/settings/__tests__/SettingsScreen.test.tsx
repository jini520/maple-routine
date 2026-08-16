// 웹판(296줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 넷
// ① **라우터 프로브가 없다.** 웹은 `MemoryRouter` 에 목적지를 세워 이동을 봤는데, RN 은 라우트
//    이름으로 미므로 **`navigate` 가 무엇으로 불렸는가**를 본다(실제로 그 화면이 열리는 것은
//    `RootNavigator` 테스트가 이미 본다 — 그쪽이 라우트 표 전체를 훑는다).
// ② `getAllByRole('button')` 으로 행을 세던 것이 **`SettingsRow` 가 심는 라벨 목록**이 된다 —
//    RN 은 자식 글자를 합쳐 접근성 이름을 만들지 않아 `row.textContent` 같은 축이 없다.
// ③ **「콘텐츠 블록이 상단 안전영역을 직접 갖는다」는 옮길 계약이 아니다.** 웹에서 그 트릭이
//    필요했던 이유(안쪽 래퍼의 `-mt` 가 콘텐츠를 y=0 으로 끌어올린다)가 RN 에 없다 —
//    `ScreenScroll` 이 헤더 없는 화면에서는 **스크롤포트 상자 자체를** 내린다(그 파일 「상단」절).
// ④ **하단 버전은 실행 중인 OTA 번들이 아니라 빌드 시점 값이다**([[ADR-128]] 결정 7) — 웹의
//    폴백 경로만 남았다. 그래서 웹의 「OTA 번들 버전을 표시한다」 케이스가 그 폴백 케이스로 접힌다.
// ⑤ **캐릭터 관리 피커가 이 화면으로 왔다**([[ADR-140]]) — 웹판에 없던 계약이라 아래 두 `describe`
//    는 옮겨온 것이다(`ContentScreen.test.tsx`·`BossScreen.test.tsx` 의 「캐릭터 관리 피커」 절).
//    피커 자체의 로딩·빈·실패 표현은 `CharacterTrackingPicker.test.tsx` 가 이미 보므로, 여기서는
//    **이 화면이 그것을 어떻게 먹여 살리는가**(조회 시점 · 401/429 의 목적지 · 저장의 순서)만 본다.
import { act, fireEvent } from '@testing-library/react-native'

import { loadCacheDataSizes } from '@core/features/settings/cache-data'
import { useThemeStore } from '@core/features/theme/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { useContentSchedulerStore, type ContentSchedulerStore } from '@core/features/content-scheduler/store'
import { getCharacterPickerRoster } from '@core/features/schedule-sync/schedule-sync'
import { NexonAuthError, NexonRateLimitError } from '@core/nexon/errors'
import { THEME_NAMES } from '@core/lib/theme-registry'
import type { CharacterPickerEntry } from '@core/types'

import packageJson from '../../../../package.json'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsScreen } from '../SettingsScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

// 이름이 `mock` 으로 시작해야 한다 — babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다(스케줄러 화면 테스트와 같은 규칙).
const mockNoticeApiKeyIssue = jest.fn()
const mockGetRoster = jest.fn()
const mockLoadBossTracked = jest.fn()
const mockLoadProfitTracked = jest.fn()

jest.mock('@core/features/theme/store', () => ({ useThemeStore: jest.fn() }))
jest.mock('@core/features/tracking-mode/store', () => ({ useTrackingModeStore: jest.fn() }))
// 본화면이 대표값으로 캐시 총 용량을 읽는다([[ADR-118]] 결정 5) — 화면은 `features/` 를 거치고
// 저장소·SQLite 는 그 아래가 맡는다(CLAUDE.md CRITICAL).
jest.mock('@core/features/settings/cache-data', () => ({ loadCacheDataSizes: jest.fn() }))
jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

// [[ADR-140]] 결정 4: 저장은 컨텐츠 스케줄러 스토어의 액션을 그대로 부른다(세 번째 사본 금지).
jest.mock('@core/features/content-scheduler/store', () => ({ useContentSchedulerStore: jest.fn() }))
// 결정 5: 저장 뒤 다시 읽히는 나머지 둘 — 화면은 `getState()` 로만 만진다(구독하지 않는다).
jest.mock('@core/features/boss-scheduler/store', () => ({
  useBossSchedulerStore: { getState: () => ({ loadTrackedOcids: mockLoadBossTracked }) },
}))
jest.mock('@core/features/boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ loadTrackedOcids: mockLoadProfitTracked }) },
}))

// [[ADR-115]] 결정 7 · [[ADR-116]] 결정 1: 401·429 는 토스트가 아니라 키 재입력 진입점으로 간다.
jest.mock('@core/features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) },
}))

// [[ADR-062]]: 화면이 `toScheduleSyncError` 로 reject 를 원인으로 바꾸므로 그 매핑은 실물을 쓰고
// `getCharacterPickerRoster` 만 대체한다(부분 모킹). `...requireActual` 을 통째로 쓰면 순환 참조가
// 아직 구성 중인 모듈을 `undefined` 로 만난다 — 스케줄러 화면 테스트와 같은 처방.
jest.mock('@core/features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('@core/features/schedule-sync/errors')>(
    '@core/features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: (...args: unknown[]) => mockGetRoster(...args),
}))

// 라우트 파라미터(`openPicker`)는 케이스마다 갈리므로 변수를 통해 준다([[ADR-140]] 결정 2).
let mockRouteParams: { openPicker?: boolean } | undefined
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}))

const mockedUseThemeStore = jest.mocked(useThemeStore)
const mockedUseTrackingModeStore = jest.mocked(useTrackingModeStore)
const mockedLoadCacheDataSizes = jest.mocked(loadCacheDataSizes)
const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const mockedContentStore = jest.mocked(useContentSchedulerStore)
const mockedRoster = mockGetRoster as unknown as jest.MockedFunction<typeof getCharacterPickerRoster>

const navigate = jest.fn()
const setParams = jest.fn()
const [첫테마, 다른테마] = THEME_NAMES
if (첫테마 === undefined || 다른테마 === undefined) throw new Error('테마가 둘 미만이다')

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function rowOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`행을 찾지 못했다: ${label}`)
  return node
}

/** 서브트리의 글자를 나온 순서대로 — 웹 테스트의 `row.textContent` 자리다. */
function textsIn(node: AtomElement): string[] {
  const texts: string[] = []
  const walk = (current: AtomElement): void => {
    for (const child of current.children) {
      if (typeof child === 'string') texts.push(child)
      else walk(child)
    }
  }
  walk(node)
  return texts
}

function hasChevron(node: AtomElement): boolean {
  if (node.props.testID === 'settings-row-chevron') return true
  return node.children.some((child) => typeof child !== 'string' && hasChevron(child))
}

/** 카드 안에 선 행 라벨들 — 순서가 곧 화면 순서다. */
const ROW_LABELS = [
  '스케줄 관리 방법',
  '테마',
  // [[ADR-140]] 결정 1: 「테마」 **아래**(사용자 지정) — 이 자리가 계약이다.
  '캐릭터 관리',
  '기능 설명',
  '개발 노트',
  '계정 및 데이터',
  '앱 정보',
]

function mockThemeStore(overrides: Partial<ReturnType<typeof useThemeStore>> = {}): void {
  mockedUseThemeStore.mockReturnValue({
    theme: 첫테마,
    restoreFromStorage: jest.fn(),
    selectTheme: jest.fn(),
    ...overrides,
  })
}

function mockTrackingModeStore(
  overrides: Partial<ReturnType<typeof useTrackingModeStore>> = {},
): void {
  mockedUseTrackingModeStore.mockReturnValue({
    mode: 'auto',
    restoreFromStorage: jest.fn(),
    setMode: jest.fn(),
    ...overrides,
  })
}

/**
 * 화면이 컨텐츠 스케줄러 스토어에서 읽는 것은 둘뿐이다 — 배지에 쓰는 `trackedOcids` 와 저장
 * 액션([[ADR-140]] 결정 3·4). 나머지 필드는 이 화면이 만지지 않으므로 세우지 않는다.
 */
function mockContentStore(overrides: Partial<ContentSchedulerStore> = {}): ContentSchedulerStore {
  const base = { trackedOcids: ['ocid-1'], saveTrackedOcids: jest.fn(), ...overrides } as ContentSchedulerStore
  mockedContentStore.mockReturnValue(base)
  return base
}

function pickerEntry(overrides: Partial<CharacterPickerEntry> = {}): CharacterPickerEntry {
  return { ocid: 'roster-ocid', name: '로스터캐릭터', level: 200, imageUrl: null, ...overrides }
}

beforeEach(() => {
  mockThemeStore()
  mockTrackingModeStore()
  mockContentStore()
  mockRouteParams = undefined
  mockedUseSettingsNavigation.mockReturnValue({
    navigate,
    goBack: jest.fn(),
    setParams,
  } as unknown as ReturnType<typeof useSettingsNavigation>)
  // 기본은 "영원히 조회 중" — 자리표시(`- KB`)가 기본 상태라, 값이 필요한 케이스만 따로 세운다.
  mockedLoadCacheDataSizes.mockReturnValue(new Promise(() => {}))
  // 로스터도 기본은 "영원히 조회 중" — 케이스가 필요할 때 `deferredRoster` 로 갈아 세운다.
  mockedRoster.mockReturnValue(new Promise(() => {}))
  mockLoadBossTracked.mockResolvedValue(undefined)
  mockLoadProfitTracked.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsScreen', () => {
  // [[ADR-120]] 딸림 작업 — 문서 스크롤에 얹혀 있던 **마지막 탭 화면**이 자기 스크롤을 소유하게
  // 됐다([[ADR-099]]). RN 에서는 그것이 기본값이지만, 셸을 안 쓰고 직접 그리면 다시 잃는다.
  it('자기 스크롤 컨테이너를 소유한다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByTestId('screen-scroll')).toBeTruthy()
  })

  // [[ADR-118]] 결정 1 — 본화면은 카드 둘. **행은 5 → 6이 됐다**([[ADR-125]] 결정 1 정정):
  // 사용법 설명의 원천이 기능 카탈로그로 옮겨오면서 그 입구가 필요해졌다. 「기능 설명」이
  // 「개발 노트」 **위**인 것은 *"이 앱을 어떻게 쓰나"* 가 더 자주 묻는 질문이기 때문이다.
  it('행이 정확히 7개이고 순서가 값 카드 → 이동 카드다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    for (const label of ROW_LABELS) expect(view.getByText(label)).toBeTruthy()
    expect(view.getAllByTestId('settings-row-chevron')).toHaveLength(ROW_LABELS.length)
  })

  // **이 개편의 핵심.** 두 무리를 가르는 것은 카드 경계뿐이다(결정 1) — 한 카드에 다 넣는 시안은
  // "성격이 다른 것이 한 덩어리로 읽힌다"는 문제를 그대로 둔다.
  it('값을 고르는 세 행과 화면이 넘어가는 네 행이 서로 다른 카드에 있다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    const cards = view.getAllByTestId('settings-card')
    expect(cards).toHaveLength(2)

    const labelsIn = (card: AtomElement): string[] =>
      ROW_LABELS.filter((label) => {
        let node: AtomElement | null = view.getByText(label)
        while (node !== null && node !== card) node = node.parent
        return node === card
      })

    expect(labelsIn(cards[0])).toEqual(['스케줄 관리 방법', '테마', '캐릭터 관리'])
    expect(labelsIn(cards[1])).toEqual(['기능 설명', '개발 노트', '계정 및 데이터', '앱 정보'])
  })

  // [[ADR-118]] 결정 4: 화살표가 "값이 있는가"가 아니라 "누르면 무언가 열린다"를 말한다.
  // 옛 배타(`rightContent ?? chevron`)에서는 값이 있는 행에서 화살표가 사라졌다.
  it.each([
    ['스케줄 관리 방법', '수동'],
    ['테마', 다른테마],
  ])('"%s" 행에 현재값 배지와 chevron 이 함께 있다', async (label, value) => {
    mockTrackingModeStore({ mode: 'manual' })
    mockThemeStore({ theme: 다른테마 })
    const view = await renderOverlay(<SettingsScreen />)

    const row = rowOf(view, label)
    expect(textsIn(row)).toEqual([label, value])
    expect(hasChevron(row)).toBe(true)
  })

  it.each([
    ['기능 설명', 'SettingsFeatureGuideList'],
    ['개발 노트', 'SettingsReleaseNotes'],
    ['계정 및 데이터', 'SettingsAccountData'],
    ['앱 정보', 'SettingsAbout'],
  ])('"%s" 행을 누르면 %s 로 민다', async (label, route) => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, label))

    expect(navigate).toHaveBeenCalledWith(route)
  })

  // [[ADR-118]] 결정 5 — 들어가지 않고도 안을 짐작하게 하는 값 하나.
  it('"계정 및 데이터" 우측에 캐시 총 용량(두 그룹의 합)을 표시한다', async () => {
    mockedLoadCacheDataSizes.mockResolvedValue({ general: 1024 * 1024, bossRecords: 1024 * 512 })
    const view = await renderOverlay(<SettingsScreen />)

    expect(await view.findByText('1.5MB')).toBeTruthy()
  })

  // [[ADR-061]] 결정 7: 조회 전에도 값과 같은 자리를 잡는다(빈 문자열이면 값이 툭 나타나며 행이 밀린다).
  it('캐시 용량 조회 전에는 "- KB" 로 자리를 잡는다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByText('- KB')).toBeTruthy()
  })

  // 조회 실패도 같은 자리표시로 남는다 — 설정을 못 여는 실패가 아니다.
  it('캐시 용량 조회가 실패해도 "- KB" 로 남고 화면은 그대로다', async () => {
    mockedLoadCacheDataSizes.mockRejectedValue(new Error('storage down'))
    const view = await renderOverlay(<SettingsScreen />)

    await act(async () => {})

    expect(view.getByText('- KB')).toBeTruthy()
    expect(view.getByText('계정 및 데이터')).toBeTruthy()
  })

  it('"앱 정보" 우측에 앱 버전을 표시한다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getAllByText(packageJson.version).length).toBeGreaterThan(0)
  })

  // 결정 5: 후보가 전부 틀린 말을 한다 — "최신 버전"은 아래 `앱 정보` 행과 중복이고 "n개"는
  // 뜻이 없다. 없는 대표값을 지어내지 않는다.
  it('"기능 설명"·"개발 노트" 행에는 대표값을 두지 않는다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    // 행 안에 남는 글자는 라벨 하나뿐이다(chevron 은 글자가 아니다).
    for (const label of ['기능 설명', '개발 노트']) {
      expect(textsIn(rowOf(view, label))).toEqual([label])
    }
  })

  it('"스케줄 관리 방법"을 누르면 트래킹 모드 모달이 열린다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, '스케줄 관리 방법'))

    expect(view.getByTestId('tracking-mode-modal-overlay')).toBeTruthy()
  })

  it('"테마"를 누르면 테마 선택 모달이 열린다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, '테마'))

    expect(view.getByTestId('theme-modal-overlay')).toBeTruthy()
  })

  // [[ADR-118]] 결정 3: 셋 다 `/settings/account-data` 로 내려갔다 — 되돌아오면 결정 1 의
  // "값을 고르는 카드"가 다시 혼종이 된다.
  it.each(['계정 변경', '연결 해제', '캐시 데이터 삭제', 'API 키 재입력'])(
    '"%s" 행을 본화면에 두지 않는다',
    async (label) => {
      const view = await renderOverlay(<SettingsScreen />)

      expect(view.queryByText(label)).toBeNull()
    },
  )

  it('하단에 앱 버전·카피라이트·NEXON Open API 출처 문구·비제휴 고지를 표시한다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByText(`v${packageJson.version}`)).toBeTruthy()
    expect(view.getByText(/©\s*\d{4}\s*메이플 루틴/)).toBeTruthy()
    expect(view.getByText('Data based on NEXON Open API')).toBeTruthy()
    expect(view.getByText('Maple Routine is not associated with NEXON Korea')).toBeTruthy()
  })

  // [[ADR-118]] 결정 7·8: 개인정보 처리방침은 `/settings/about` 의 행으로 옮겼고, 고지 블록은
  // 전부 읽고 끝나는 정적 문구만 남는다 — 링크가 여기로 되돌아오면 그 균일함이 다시 깨진다.
  it('고지 블록은 4줄이고 링크를 두지 않는다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByTestId('settings-footer').children).toHaveLength(4)
    expect(view.queryByText('개인정보 처리방침')).toBeNull()
  })
})

describe('SettingsScreen — 캐릭터 관리 ([[ADR-140]])', () => {
  /** 로스터 조회를 손으로 진행시킨다 — 스케줄러 화면 테스트에서 옮겨온 도우미. */
  function deferredRoster(): {
    emit: (entries: CharacterPickerEntry[]) => void
    fail: (error: unknown) => void
  } {
    let emit: (entries: CharacterPickerEntry[]) => void = () => {}
    let fail: (error: unknown) => void = () => {}
    mockedRoster.mockImplementation(
      (onUpdate) =>
        new Promise<void>((_resolve, reject) => {
          emit = (entries) => onUpdate(entries)
          fail = (error) => reject(error)
        }),
    )
    // **콜백을 그대로 돌려주면 안 된다** — 위 대입은 `mockImplementation` 이 실제로 불릴 때
    // (= 화면이 피커를 열 때) 일어나므로, 지금 값을 캡처하면 영원히 빈 함수를 쥔다.
    return { emit: (entries) => emit(entries), fail: (error) => fail(error) }
  }

  async function openPicker(view: Rendered): Promise<void> {
    await press(rowOf(view, '캐릭터 관리'))
  }

  // 결정 3: 파생·추정값이 아니라 저장된 목록의 길이다.
  it('행 오른쪽에 추적 인원 배지와 chevron 이 함께 있다', async () => {
    mockContentStore({ trackedOcids: ['a', 'b', 'c'] })
    const view = await renderOverlay(<SettingsScreen />)

    const row = rowOf(view, '캐릭터 관리')
    expect(textsIn(row)).toEqual(['캐릭터 관리', '3', '명'])
    expect(hasChevron(row)).toBe(true)
  })

  // [[ADR-101]] 결정 1: `null` 은 "0명"이 아니라 **"아직 안 읽었다"** 다 — 모르는 사실을 단정하지 않는다.
  it('추적 목록이 null(미로드)이면 배지를 그리지 않는다', async () => {
    mockContentStore({ trackedOcids: null })
    const view = await renderOverlay(<SettingsScreen />)

    expect(textsIn(rowOf(view, '캐릭터 관리'))).toEqual(['캐릭터 관리'])
  })

  it('0명이면 "0명" 배지를 그린다 — 미로드와 다른 상태다', async () => {
    mockContentStore({ trackedOcids: [] })
    const view = await renderOverlay(<SettingsScreen />)

    expect(textsIn(rowOf(view, '캐릭터 관리'))).toEqual(['캐릭터 관리', '0', '명'])
  })

  // [[ADR-015]]: 후보 목록 조회는 **피커를 열 때만** 돈다(마운트 시 매번 부르면 설정에 들어오기만
  // 해도 캐릭터 수만큼 병렬 호출이 발생한다).
  it('행을 누르기 전에는 로스터를 조회하지 않는다', async () => {
    await renderOverlay(<SettingsScreen />)

    expect(mockedRoster).not.toHaveBeenCalled()
  })

  it('행을 누르면 피커가 열리고 로스터 조회가 시작된다', async () => {
    deferredRoster()
    const view = await renderOverlay(<SettingsScreen />)

    await openPicker(view)

    expect(view.getByTestId('character-tracking-picker-modal')).toBeTruthy()
    expect(mockedRoster).toHaveBeenCalledTimes(1)
  })

  // [[ADR-016]] 웜 캐시 — 항목이 도착하면 조회가 안 끝났어도 목록을 그린다.
  it('조회가 끝나기 전에 항목이 도착하면 바로 목록을 보여준다', async () => {
    const roster = deferredRoster()
    const view = await renderOverlay(<SettingsScreen />)
    await openPicker(view)

    await act(async () => {
      roster.emit([pickerEntry({ name: '내옆에최성일' })])
    })

    expect(view.getByText('내옆에최성일')).toBeTruthy()
  })

  // [[ADR-115]] 결정 7 · [[ADR-116]] 결정 1: 로스터가 맞는 401·429 도 키 재입력 진입점으로 간다.
  it.each([
    ['401', new NexonAuthError('401'), 'invalid'],
    ['429', new NexonRateLimitError('429'), 'rateLimited'],
  ])('로스터 조회가 %s 로 reject 되면 키 재입력 경로로 간다', async (_label, error, kind) => {
    const roster = deferredRoster()
    const view = await renderOverlay(<SettingsScreen />)
    await openPicker(view)

    await act(async () => {
      roster.fail(error)
    })

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith(kind)
  })

  it('401·429 가 아닌 실패는 키 재입력 경로를 타지 않는다', async () => {
    const roster = deferredRoster()
    const view = await renderOverlay(<SettingsScreen />)
    await openPicker(view)

    await act(async () => {
      roster.fail(new Error('boom'))
    })

    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
  })

  // 결정 2: 보스 수익·두 스케줄러의 빈 상태가 피커를 **열어 둔 채로** 보낸다.
  it('openPicker 파라미터로 진입하면 피커가 열린 채로 시작하고 파라미터를 지운다', async () => {
    mockRouteParams = { openPicker: true }
    deferredRoster()

    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByTestId('character-tracking-picker-modal')).toBeTruthy()
    expect(setParams).toHaveBeenCalledWith({ openPicker: undefined })
  })

  it('파라미터 없이 진입하면 피커는 닫힌 채로 시작한다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.queryByTestId('character-tracking-picker-modal')).toBeNull()
    expect(setParams).not.toHaveBeenCalled()
  })

  // 결정 4·5: 저장은 컨텐츠 스토어 액션 하나로 끝내고, 그 뒤 나머지 두 스토어를 **순차로** 다시
  // 읽힌다(RN 탭 화면은 마운트된 채 남아 스스로 다시 안 읽는다).
  it('저장하면 saveTrackedOcids 를 부르고 진행률 모달을 띄운다', async () => {
    let resolveSave: () => void = () => {}
    const store = mockContentStore({
      trackedOcids: [],
      saveTrackedOcids: jest.fn(
        (_ocids: string[], onProgress?: (completed: number, total: number) => void) =>
          new Promise<void>((resolve) => {
            onProgress?.(0, 1)
            resolveSave = resolve
          }),
      ) as unknown as ContentSchedulerStore['saveTrackedOcids'],
    })
    const view = await renderOverlay(<SettingsScreen />)
    await openPicker(view)
    await act(async () => {
      mockedRoster.mock.calls[0][0]([pickerEntry({ ocid: 'roster-ocid' })])
    })

    await press(view.getByText('로스터캐릭터'))
    await press(view.getByText('저장'))

    expect(store.saveTrackedOcids).toHaveBeenCalledWith(['roster-ocid'], expect.any(Function))
    // 문구 뒤에 `(0/1)` 이 붙어 한 `Text` 를 이룬다 — 완전 일치가 아니라 부분 일치로 본다.
    expect(view.getByText(/캐릭터 정보를 저장하고 있어요/)).toBeTruthy()
    // 아직 저장 중이라 나머지 스토어는 건드리지 않는다.
    expect(mockLoadBossTracked).not.toHaveBeenCalled()

    await act(async () => {
      resolveSave()
    })
  })

  it('저장이 끝나면 보스·수익 스토어를 순차로 다시 읽힌다', async () => {
    const order: string[] = []
    let resolveBoss: () => void = () => {}
    mockLoadBossTracked.mockImplementation(() => {
      order.push('boss')
      return new Promise<void>((resolve) => {
        resolveBoss = resolve
      })
    })
    mockLoadProfitTracked.mockImplementation(() => {
      order.push('profit')
      return Promise.resolve()
    })
    mockContentStore({ trackedOcids: [] })
    const view = await renderOverlay(<SettingsScreen />)
    await openPicker(view)
    await act(async () => {
      mockedRoster.mock.calls[0][0]([pickerEntry({ ocid: 'roster-ocid' })])
    })

    await press(view.getByText('로스터캐릭터'))
    await press(view.getByText('저장'))

    // 보스가 끝나기 전에는 수익이 시작되지 않는다 — 동시에 띄우면 둘 다 옛 `syncedAt` 을 보고
    // [[ADR-097]] 게이트를 통과해 같은 응답을 두 번 받는다(`prehydrateTabStores` 와 같은 이유).
    expect(order).toEqual(['boss'])
    await act(async () => {
      resolveBoss()
    })
    expect(order).toEqual(['boss', 'profit'])
    // 피커·진행률 모달은 그 둘을 기다리지 않는다(결정 5).
    expect(view.queryByTestId('character-tracking-picker-modal')).toBeNull()
  })

  it('한 스토어가 실패해도 다음 스토어는 계속 읽힌다', async () => {
    mockLoadBossTracked.mockRejectedValue(new Error('network'))
    mockContentStore({ trackedOcids: [] })
    const view = await renderOverlay(<SettingsScreen />)
    await openPicker(view)
    await act(async () => {
      mockedRoster.mock.calls[0][0]([pickerEntry({ ocid: 'roster-ocid' })])
    })

    await press(view.getByText('로스터캐릭터'))
    await press(view.getByText('저장'))

    expect(mockLoadProfitTracked).toHaveBeenCalledTimes(1)
  })
})
