// 웹판(296줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 넷
// ① **라우터 프로브가 없다.** 웹은 `MemoryRouter` 에 목적지를 세워 이동을 봤는데, RN 은 라우트
//    이름으로 미므로 **`navigate` 가 무엇으로 불렸는가**를 본다(실제로 그 화면이 열리는 것은
//    `RootNavigator` 테스트가 이미 본다 — 그쪽이 라우트 표 전체를 훑는다).
// ② `getAllByRole('button')` 으로 행을 세던 것이 **`SettingsRow` 가 심는 라벨 목록**이 된다 —
//    RN 은 자식 글자를 합쳐 접근성 이름을 만들지 않아 `row.textContent` 같은 축이 없다.
// ③ **콘텐츠 블록이 상단 안전영역을 직접 갖는다는 옮길 계약이 아니다.** 웹에서 그 트릭이
//    필요했던 이유(안쪽 래퍼의 `-mt` 가 콘텐츠를 y=0 으로 끌어올린다)가 RN 에 없다 —
//    `ScreenScroll` 이 헤더 없는 화면에서는 **스크롤포트 상자 자체를** 내린다(그 파일 `상단`절).
// ④ **하단 버전은 실행 중인 OTA 번들이 아니라 빌드 시점 값이다** — 웹의
//    폴백 경로만 남았다. 그래서 웹의 `OTA 번들 버전을 표시한다` 케이스가 그 폴백 케이스로 접힌다.
// ⑤ **캐릭터 관리 행이 이 화면에 생겼다** — 웹판에 없던 계약이다. 단
//    결정 1 이 그것을 모달에서 **하위 페이지**로 바꾸면서, 조회·저장·401/429 배선이 통째로
//    `SettingsCharactersScreen` 으로 옮겨갔다. 여기 남는 계약은 셋뿐이다 — 배지(단위 **개**),
//    누르면 그 화면을 민다, `openPicker` 로 들어와도 같은 곳으로 민다.
import { act, fireEvent } from '@testing-library/react-native'

import { loadCacheDataSizes } from '../../../features/settings/cache-data'
import { useThemeStore } from '../../../features/theme/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { useContentSchedulerStore, type ContentSchedulerStore } from '../../../features/content-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { THEME_NAMES } from '../../../lib/theme/theme-registry'

import packageJson from '../../../../package.json'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsScreen } from '../SettingsScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

// 이름이 `mock` 으로 시작해야 한다 — babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다(스케줄러 화면 테스트와 같은 규칙).
const mockGetRoster = jest.fn()
const mockLoadContentTracked = jest.fn()
const mockLoadBossTracked = jest.fn()
const mockLoadProfitTracked = jest.fn()

jest.mock('../../../features/theme/store', () => ({ useThemeStore: jest.fn() }))
jest.mock('../../../features/tracking-mode/store', () => ({ useTrackingModeStore: jest.fn() }))
// 본화면이 대표값으로 캐시 총 용량을 읽는다 — 화면은 `features/` 를 거치고
// 저장소·SQLite 는 그 아래가 맡는다(CLAUDE.md CRITICAL).
jest.mock('../../../features/settings/cache-data', () => ({ loadCacheDataSizes: jest.fn() }))
jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

// : 저장은 컨텐츠 스케줄러 스토어의 액션을 그대로 부른다(세 번째 사본 금지).
// 훅으로도(배지·저장) `getState()` 로도(결정 5 정정의 모드 전환 재로드) 만지므로 둘 다 세운다.
jest.mock('../../../features/content-scheduler/store', () => {
  const hook = jest.fn()
  return {
    useContentSchedulerStore: Object.assign(hook, {
      getState: () => ({ loadTrackedOcids: mockLoadContentTracked }),
    }),
  }
})
// 결정 5: 저장 뒤 다시 읽히는 나머지 둘 — 화면은 `getState()` 로만 만진다(구독하지 않는다).
jest.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: { getState: () => ({ loadTrackedOcids: mockLoadBossTracked }) },
}))
jest.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ loadTrackedOcids: mockLoadProfitTracked }) },
}))

// 이 화면은 로스터를 **부르지 않는 것**이 계약이라 그것을 단언하려면 감시할
// 대상이 필요하다. `...requireActual` 을 통째로 쓰면 순환 참조가 아직 구성 중인 모듈을 `undefined`
// 로 만난다 — 스케줄러 화면 테스트와 같은 처방으로 부분 모킹한다.
jest.mock('../../../features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('../../../features/schedule-sync/errors')>(
    '../../../features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: (...args: unknown[]) => mockGetRoster(...args),
}))

// 라우트 파라미터(`openPicker`)는 케이스마다 갈리므로 변수를 통해 준다.
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
  // : `테마` **아래**(사용자 지정) — 이 자리가 계약이다.
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
  // 기본은 "영원히 조회 중" — 자리표시(`- KB`)가 기본 상태라, 값이 필요한 케이스만 따로 세운다.
  mockedLoadCacheDataSizes.mockReturnValue(new Promise(() => {}))
  // 로스터도 기본은 "영원히 조회 중" — 케이스가 필요할 때 `deferredRoster` 로 갈아 세운다.
  mockedRoster.mockReturnValue(new Promise(() => {}))
  mockLoadContentTracked.mockResolvedValue(undefined)
  mockLoadBossTracked.mockResolvedValue(undefined)
  mockLoadProfitTracked.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsScreen', () => {
  //  딸림 작업 — 문서 스크롤에 얹혀 있던 **마지막 탭 화면**이 자기 스크롤을 소유하게
  // 됐다. RN 에서는 그것이 기본값이지만, 셸을 안 쓰고 직접 그리면 다시 잃는다.
  it('자기 스크롤 컨테이너를 소유한다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByTestId('screen-scroll')).toBeTruthy()
  })

  // 본화면은 카드 둘. **행은 5 → 6이 됐다**(정정):
  // 사용법 설명의 원천이 기능 카탈로그로 옮겨오면서 그 입구가 필요해졌다. `기능 설명`이
  // `개발 노트` **위**인 것은 *"이 앱을 어떻게 쓰나"* 가 더 자주 묻는 질문이기 때문이다.
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

  // : 화살표가 "값이 있는가"가 아니라 "누르면 무언가 열린다"를 말한다.
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

  // 들어가지 않고도 안을 짐작하게 하는 값 하나.
  it('"계정 및 데이터" 우측에 캐시 총 용량(두 그룹의 합)을 표시한다', async () => {
    mockedLoadCacheDataSizes.mockResolvedValue({ general: 1024 * 1024, records: 1024 * 512 })
    const view = await renderOverlay(<SettingsScreen />)

    expect(await view.findByText('1.5MB')).toBeTruthy()
  })

  // : 조회 전에도 값과 같은 자리를 잡는다(빈 문자열이면 값이 툭 나타나며 행이 밀린다).
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

  //  정정: 모드 전환은 세 스토어를 **모두** 낡게 만든다(저장 경로에서 컨텐츠가
  // 빠진 것은 그쪽이 저장의 주체여서일 뿐이다). 이것이 없으면 자동 → 수동 직후 보스 탭이
  // "추적할 주간 보스가 없습니다"로 뜨고 새로고침해야 목록이 나온다(2026-08-16 사용자 관측).
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
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, '스케줄 관리 방법'))
    await press(view.getByText('수동'))
    await press(view.getByText('적용'))

    // 컨텐츠가 끝나기 전에는 다음이 시작되지 않는다(게이트 — `prehydrateTabStores` 와
    // 같은 이유). 모달은 그 셋을 기다리지 않고 닫힌다.
    expect(order).toEqual(['content'])
    expect(view.queryByTestId('tracking-mode-modal-overlay')).toBeNull()

    await act(async () => {
      resolveContent()
    })

    expect(order).toEqual(['content', 'boss', 'profit'])
  })

  it('"테마"를 누르면 테마 선택 모달이 열린다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, '테마'))

    expect(view.getByTestId('theme-modal-overlay')).toBeTruthy()
  })

  // : 셋 다 `/settings/account-data` 로 내려갔다 — 되돌아오면 결정 1 의
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

  // : 개인정보 처리방침은 `/settings/about` 의 행으로 옮겼고, 고지 블록은
  // 전부 읽고 끝나는 정적 문구만 남는다 — 링크가 여기로 되돌아오면 그 균일함이 다시 깨진다.
  it('고지 블록은 4줄이고 링크를 두지 않는다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByTestId('settings-footer').children).toHaveLength(4)
    expect(view.queryByText('개인정보 처리방침')).toBeNull()
  })
})

describe('SettingsScreen — 캐릭터 관리', () => {
  // 결정 3: 파생·추정값이 아니라 저장된 목록의 길이다. **단위가 명 이 아니라 개** 인 것은
  //  이 그 표기를 정정했기 때문이다 — 캐릭터는 사람이 아니다.
  it('행 오른쪽에 추적 캐릭터 수 배지와 chevron 이 함께 있다', async () => {
    mockContentStore({ trackedOcids: ['a', 'b', 'c'] })
    const view = await renderOverlay(<SettingsScreen />)

    const row = rowOf(view, '캐릭터 관리')
    expect(textsIn(row)).toEqual(['캐릭터 관리', '3', '개'])
    expect(hasChevron(row)).toBe(true)
  })

  // : `null` 은 "0개"가 아니라 **"아직 안 읽었다"** 다 — 모르는 사실을 단정하지 않는다.
  it('추적 목록이 null(미로드)이면 배지를 그리지 않는다', async () => {
    mockContentStore({ trackedOcids: null })
    const view = await renderOverlay(<SettingsScreen />)

    expect(textsIn(rowOf(view, '캐릭터 관리'))).toEqual(['캐릭터 관리'])
  })

  it('0개면 "0개" 배지를 그린다 — 미로드와 다른 상태다', async () => {
    mockContentStore({ trackedOcids: [] })
    const view = await renderOverlay(<SettingsScreen />)

    expect(textsIn(rowOf(view, '캐릭터 관리'))).toEqual(['캐릭터 관리', '0', '개'])
  })

  // : 모달이 아니라 **화면 push** 다. 그래서 로스터 조회·저장이 이 화면을 떠났다 —
  // 여기 남은 것은 **누르면 그리로 간다** 하나다.
  it('행을 누르면 캐릭터 관리 화면을 민다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, '캐릭터 관리'))

    expect(navigate).toHaveBeenCalledWith('SettingsCharacters')
  })

  // 조회가 통째로 옮겨간 것이 이 개편의 요점이다 — 설정 본화면은 이제 캐릭터 목록을 모른다.
  it('이 화면은 로스터를 조회하지 않는다', async () => {
    mockRouteParams = { openPicker: true }

    await renderOverlay(<SettingsScreen />)

    expect(mockedRoster).not.toHaveBeenCalled()
  })

  // 결정 2: 보스 수익·두 스케줄러의 빈 상태가 캐릭터 관리를 **열어 둔 채로** 보낸다. 목적지가
  // 모달에서 화면으로 바뀌어도 계약은 그대로다.
  it('openPicker 파라미터로 진입하면 캐릭터 관리 화면을 밀고 파라미터를 지운다', async () => {
    mockRouteParams = { openPicker: true }

    await renderOverlay(<SettingsScreen />)

    expect(navigate).toHaveBeenCalledWith('SettingsCharacters')
    expect(setParams).toHaveBeenCalledWith({ openPicker: undefined })
  })

  it('파라미터 없이 진입하면 아무 데도 밀지 않는다', async () => {
    await renderOverlay(<SettingsScreen />)

    expect(navigate).not.toHaveBeenCalled()
    expect(setParams).not.toHaveBeenCalled()
  })
})
