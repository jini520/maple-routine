// 이 화면이 지키는 것을 적는다.
//
// ① 라우터 프로브가 없다. 라우트 이름으로 미므로 **`navigate` 가 무엇으로 불렸는가** 를 본다.
//    실제로 그 화면이 열리는 것은 `RootNavigator` 테스트가 라우트 표 전체로 본다.
// ② 행을 세는 축이 `SettingsRow` 가 심는 라벨 목록이다. RN 은 자식 글자를 합쳐 접근성 이름을
//    만들지 않아 `row.textContent` 같은 축이 없다.
// ③ 콘텐츠 블록이 상단 안전영역을 직접 갖지 않는다. `ScreenScroll` 이 헤더 없는 화면에서는
//    스크롤포트 상자 자체를 내린다.
// ④ 하단 버전은 실행 중인 OTA 번들이 아니라 빌드 시점 값이다.
// ⑤ 캐릭터 관리 행의 계약은 셋뿐이다. 배지(단위 개), 누르면 그 화면을 민다, `openPicker` 로
//    들어와도 같은 곳으로 민다. 조회·저장·401/429 배선은 `SettingsCharactersScreen` 이 갖는다.
import { act, fireEvent } from '@testing-library/react-native'

import { loadCacheDataSizes } from '../../../features/settings/cache-data'
import { useThemeStore } from '../../../features/theme/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { useContentSchedulerStore, type ContentSchedulerStore } from '../../../features/content-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { THEME_NAMES } from '../../../lib/theme/theme-registry'

import packageJson from '../../../../package.json'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { AppSettingsScreen } from '../AppSettingsScreen'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'

// 이름이 `mock` 으로 시작해야 한다. babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다(스케줄러 화면 테스트와 같은 규칙).
const mockGetRoster = jest.fn()
const mockLoadContentTracked = jest.fn()
const mockLoadBossTracked = jest.fn()
const mockLoadProfitTracked = jest.fn()

jest.mock('../../../features/theme/store', () => ({ useThemeStore: jest.fn() }))
jest.mock('../../../features/tracking-mode/store', () => ({ useTrackingModeStore: jest.fn() }))
// 본화면이 대표값으로 캐시 총 용량을 읽는다. 화면은 `features/` 를 거치고
// 저장소·SQLite 는 그 아래가 맡는다(CLAUDE.md CRITICAL).
jest.mock('../../../features/settings/cache-data', () => ({ loadCacheDataSizes: jest.fn() }))
jest.mock('../../../hooks/useSettingsNavigation', () => ({ useSettingsNavigation: jest.fn() }))

// 저장은 컨텐츠 스케줄러 스토어의 액션을 그대로 부른다(세 번째 사본 금지).
// 훅으로도(배지·저장) `getState` 로도 만지므로 둘 다 세운다.
jest.mock('../../../features/content-scheduler/store', () => {
  const hook = jest.fn()
  return {
    useContentSchedulerStore: Object.assign(hook, {
      getState: () => ({ loadTrackedOcids: mockLoadContentTracked }),
    }),
  }
})
// 저장 뒤 다시 읽히는 나머지 둘. 화면은 `getState` 로만 만진다(구독하지 않는다).
jest.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: { getState: () => ({ loadTrackedOcids: mockLoadBossTracked }) },
}))
jest.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ loadTrackedOcids: mockLoadProfitTracked }) },
}))

// 이 화면은 로스터를 **부르지 않는 것**이 계약이라 그것을 단언하려면 감시할
// 대상이 필요하다. `...requireActual` 을 통째로 쓰면 순환 참조가 아직 구성 중인 모듈을 `undefined`
// 로 만난다. 스케줄러 화면 테스트와 같은 처방으로 부분 모킹한다.
jest.mock('../../../features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('../../../features/schedule-sync/errors')>(
    '../../../features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: (...args: unknown[]) => mockGetRoster(...args),
}))

// 라우트 파라미터(`openPicker`)는 케이스마다 갈리므로 변수를 통해 준다.
let mockRouteParams: { openPicker?: boolean } | undefined
jest.mock('@react-navigation/native', () => ({
  // 통째로 갈아 끼우면 이 패키지가 내보내는 **컨텍스트까지** 사라진다. 셸이 라우트 이름을
  // 그것으로 읽으므로(최상단 이동 등록) 실물을 깔고 필요한 것만 덮는다.
  ...jest.requireActual('@react-navigation/native'),
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

/** 서브트리의 글자를 나온 순서대로. 웹 테스트의 `row.textContent` 자리다. */
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

/** 카드 안에 선 행 라벨들. 순서가 곧 화면 순서다. */
// **소식이 맨 위다.** 이 페이지에서 유일하게 매일 바뀌는 것이고 나머지는 다 `가끔 한 번` 이라,
// 자주 바뀌는 것을 아래 두면 사용자가 스크롤을 배워야 한다.
// 더보기 머리의 톱니바퀴가 여는 화면. 값을 바꾸는 것만 모여 있다.
const ROW_LABELS = [
  // 맨 위에 혼자 선다. 이 화면에서 유일하게 밖으로 나가는 설정이라 성질이 다르다.
  '알림 설정',
  '스케줄 관리 방법',
  '테마',
  // `테마` **아래**. 이 자리가 계약이다.
  '캐릭터 관리',
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
 * 화면이 컨텐츠 스케줄러 스토어에서 읽는 것은 둘뿐이다. 배지에 쓰는 `trackedOcids` 와 저장
 * 액션. 나머지 필드는 이 화면이 만지지 않으므로 세우지 않는다.
 */
function mockContentStore(overrides: Partial<ContentSchedulerStore> = {}): ContentSchedulerStore {
  const base = { trackedOcids: ['ocid-1'], saveTrackedOcids: jest.fn(), ...overrides } as ContentSchedulerStore
  mockedContentStore.mockReturnValue(base)
  return base
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
  // 기본은 "영원히 조회 중"자리표시(`- KB`)가 기본 상태라, 값이 필요한 케이스만 따로 세운다.
  mockedLoadCacheDataSizes.mockReturnValue(new Promise(() => {}))
  // 로스터도 기본은 "영원히 조회 중"케이스가 필요할 때 `deferredRoster` 로 갈아 세운다.
  mockedRoster.mockReturnValue(new Promise(() => {}))
  mockLoadContentTracked.mockResolvedValue(undefined)
  mockLoadBossTracked.mockResolvedValue(undefined)
  mockLoadProfitTracked.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('AppSettingsScreen', () => {
  it('행이 정확히 여섯이고 값 카드 → 이동 카드다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    for (const label of ROW_LABELS) expect(view.getByText(label)).toBeTruthy()
    expect(view.getAllByTestId('settings-row-chevron')).toHaveLength(ROW_LABELS.length)
  })

  // 카드 셋이 성질을 가른다. 알림(밖으로 나간다) · 값(앱 안에서 돈다) · 이동(다른 화면).
  it('카드가 셋이고 알림이 혼자 맨 위다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    const cards = view.getAllByTestId('app-settings-card')
    expect(cards).toHaveLength(3)

    const labelsIn = (card: AtomElement): string[] =>
      ROW_LABELS.filter((label) => {
        let node: AtomElement | null = view.getByText(label)
        while (node !== null && node !== card) node = node.parent
        return node === card
      })

    expect(labelsIn(cards[0])).toEqual(['알림 설정'])
    expect(labelsIn(cards[1])).toEqual(['스케줄 관리 방법', '테마', '캐릭터 관리'])
  })

  it('"알림 설정" 행을 누르면 SettingsNoticeAlerts 로 민다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    await press(rowOf(view, '알림 설정'))

    expect(navigate).toHaveBeenCalledWith('SettingsNoticeAlerts')
  })

  it.each([
    ['스케줄 관리 방법', '수동'],
    ['테마', 다른테마],
  ])('"%s" 행에 현재값 배지와 chevron 이 함께 있다', async (label, value) => {
    mockTrackingModeStore({ mode: 'manual' })
    mockThemeStore({ theme: 다른테마 })
    const view = await renderOverlay(<AppSettingsScreen />)

    const row = rowOf(view, label)
    expect(textsIn(row)).toEqual([label, value])
    expect(hasChevron(row)).toBe(true)
  })

  it('"계정 및 데이터" 우측에 캐시 총 용량(두 그룹의 합)을 표시한다', async () => {
    mockedLoadCacheDataSizes.mockResolvedValue({ general: 1024 * 1024, records: 1024 * 512 })
    const view = await renderOverlay(<AppSettingsScreen />)

    expect(await view.findByText('1.5MB')).toBeTruthy()
  })

  it('캐시 용량 조회 전에는 "- KB" 로 자리를 잡는다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    expect(view.getByText('- KB')).toBeTruthy()
  })

  it('캐시 용량 조회가 실패해도 "- KB" 로 남고 화면은 그대로다', async () => {
    mockedLoadCacheDataSizes.mockRejectedValue(new Error('storage down'))
    const view = await renderOverlay(<AppSettingsScreen />)

    await act(async () => {})

    expect(view.getByText('- KB')).toBeTruthy()
    expect(view.getByText('계정 및 데이터')).toBeTruthy()
  })

  it('"앱 정보" 우측에 앱 버전을 표시한다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    expect(view.getAllByText(packageJson.version).length).toBeGreaterThan(0)
  })

  it('"스케줄 관리 방법"을 누르면 트래킹 모드 모달이 열린다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    await press(rowOf(view, '스케줄 관리 방법'))

    expect(view.getByTestId('tracking-mode-modal-overlay')).toBeTruthy()
  })

  it('스케줄 관리 방법을 바꾸면 컨텐츠·보스·수익 스토어를 순차로 다시 읽힌다', async () => {
    const order: string[] = []
    let resolveContent: () => void = () => {}
    mockLoadContentTracked.mockImplementation(() => {
      order.push('content')
      return new Promise<void>((resolve) => {
        resolveContent = resolve
      })
    })
    mockLoadBossTracked.mockImplementation(() => {
      order.push('boss')
      return Promise.resolve()
    })
    mockLoadProfitTracked.mockImplementation(() => {
      order.push('profit')
      return Promise.resolve()
    })
    const view = await renderOverlay(<AppSettingsScreen />)

    await press(rowOf(view, '스케줄 관리 방법'))
    await press(view.getByText('수동'))
    await press(view.getByText('적용'))

    // 컨텐츠가 끝나기 전에는 다음이 시작되지 않는다(게이트. `prehydrateTabStores` 와
    // 같은 이유). 모달은 그 셋을 기다리지 않고 닫힌다.
    expect(order).toEqual(['content'])
    expect(view.queryByTestId('tracking-mode-modal-overlay')).toBeNull()

    await act(async () => {
      resolveContent()
    })

    expect(order).toEqual(['content', 'boss', 'profit'])
  })

  it('"테마"를 누르면 테마 선택 모달이 열린다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    await press(rowOf(view, '테마'))

    expect(view.getByTestId('theme-modal-overlay')).toBeTruthy()
  })

  it.each(['계정 변경', '연결 해제', '캐시 데이터 삭제', 'API 키 재입력'])(
    '"%s" 행을 본화면에 두지 않는다',
    async (label) => {
      const view = await renderOverlay(<AppSettingsScreen />)

      expect(view.queryByText(label)).toBeNull()
    },
  )

describe('AppSettingsScreen: 캐릭터 관리', () => {
  // 파생·추정값이 아니라 저장된 목록의 길이다. **단위가 명 이 아니라 개** 인 것은
  //  이 그 표기를 정정했기 때문이다. 캐릭터는 사람이 아니다.
  it('행 오른쪽에 추적 캐릭터 수 배지와 chevron 이 함께 있다', async () => {
    mockContentStore({ trackedOcids: ['a', 'b', 'c'] })
    const view = await renderOverlay(<AppSettingsScreen />)

    const row = rowOf(view, '캐릭터 관리')
    expect(textsIn(row)).toEqual(['캐릭터 관리', '3', '개'])
    expect(hasChevron(row)).toBe(true)
  })

  // `null` 은 "0개"가 아니라 **"아직 안 읽었다"** 다. 모르는 사실을 단정하지 않는다.
  it('추적 목록이 null(미로드)이면 배지를 그리지 않는다', async () => {
    mockContentStore({ trackedOcids: null })
    const view = await renderOverlay(<AppSettingsScreen />)

    expect(textsIn(rowOf(view, '캐릭터 관리'))).toEqual(['캐릭터 관리'])
  })

  it('0개면 "0개" 배지를 그린다. 미로드와 다른 상태다', async () => {
    mockContentStore({ trackedOcids: [] })
    const view = await renderOverlay(<AppSettingsScreen />)

    expect(textsIn(rowOf(view, '캐릭터 관리'))).toEqual(['캐릭터 관리', '0', '개'])
  })

  // 모달이 아니라 화면 push 다. 로스터 조회·저장은 그 화면이 갖고, 여기 남은 것은 누르면
  // 그리로 간다 하나다.
  it('행을 누르면 캐릭터 관리 화면을 민다', async () => {
    const view = await renderOverlay(<AppSettingsScreen />)

    await press(rowOf(view, '캐릭터 관리'))

    expect(navigate).toHaveBeenCalledWith('SettingsCharacters')
  })

  // 조회가 통째로 옮겨간 것이 이 개편의 요점이다. 설정 본화면은 이제 캐릭터 목록을 모른다.
  it('이 화면은 로스터를 조회하지 않는다', async () => {
    mockRouteParams = { openPicker: true }

    await renderOverlay(<AppSettingsScreen />)

    expect(mockedRoster).not.toHaveBeenCalled()
  })

  // 보스 수익·두 스케줄러의 빈 상태가 캐릭터 관리를 **열어 둔 채로** 보낸다. 목적지가
  // 모달에서 화면으로 바뀌어도 계약은 그대로다.
})

})
