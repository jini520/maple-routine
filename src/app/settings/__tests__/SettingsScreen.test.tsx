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
import { Linking, Platform } from 'react-native'

import { loadCacheDataSizes } from '../../../features/settings/cache-data'
import { useThemeStore } from '../../../features/theme/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { useContentSchedulerStore, type ContentSchedulerStore } from '../../../features/content-scheduler/store'
import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { THEME_NAMES } from '../../../lib/theme/theme-registry'

import packageJson from '../../../../package.json'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../native/ports'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsScreen } from '../SettingsScreen'
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
  // 응원 행은 `role="link"` 다. 앱을 떠나므로 버튼이 아니다.
  while (node !== null && node.props.role !== 'button' && node.props.role !== 'link')
    node = node.parent
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

/** 카드 안에 선 행 라벨들. 순서가 곧 화면 순서다. */
// **소식이 맨 위다.** 이 페이지에서 유일하게 매일 바뀌는 것이고 나머지는 다 `가끔 한 번` 이라,
// 자주 바뀌는 것을 아래 두면 사용자가 스크롤을 배워야 한다.
const ROW_LABELS = [
  // 앱 공지는 이 앱의 일이고 게임 공지는 넥슨의 일이다. 구독 스위치가 이미 둘로 갈려 있어,
  // 읽는 자리만 하나로 묶으면 게임 공지만 켠 사용자가 켠 적 없는 앱 공지를 함께 본다.
  '앱 공지사항',
  '게임 공지사항',
  '업데이트',
  '이벤트',
  '캐시샵',
  '기능 설명',
  '개발 노트',
  // 평생 한 번 누르는 것이라 맨 아래다.
  '개발자 응원하기(앱 리뷰)',
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

// 응원 행이 앱을 떠나는 것을 재려면 이 호출을 봐야 한다. 실제로 스토어를 열 수는 없다.
const openURL = jest.spyOn(Linking, 'openURL')
const 원래플랫폼 = Platform.OS

beforeEach(() => {
  openURL.mockResolvedValue(true)
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
  // 플랫폼을 갈아 끼운 케이스가 뒤 케이스로 새면 안 된다.
  Platform.OS = 원래플랫폼
  jest.clearAllMocks()
})

describe('SettingsScreen', () => {
  //  딸림 작업. 문서 스크롤에 얹혀 있던 **마지막 탭 화면**이 자기 스크롤을 소유하게
  // 됐다. RN 에서는 그것이 기본값이지만, 셸을 안 쓰고 직접 그리면 다시 잃는다.
  it('자기 스크롤 컨테이너를 소유한다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByTestId('screen-scroll')).toBeTruthy()
  })

  // 본화면은 카드 둘. **행은 5 → 6이 됐다**:
  // 사용법 설명의 원천이 기능 카탈로그로 옮겨오면서 그 입구가 필요해졌다. `기능 설명`이
  // `개발 노트` **위**인 것은 *"이 앱을 어떻게 쓰나"* 가 더 자주 묻는 질문이기 때문이다.
  it('행이 정확히 8개이고 소식 → 읽을거리 → 응원 순이다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    for (const label of ROW_LABELS) expect(view.getByText(label)).toBeTruthy()
    // 응원 행만 오른쪽이 chevron 이 아니다. chevron 을 쓰면 다른 이동 행과 같은 약속을 하고는
    // 앱을 떠나 버린다.
    expect(view.getAllByTestId('settings-row-chevron')).toHaveLength(ROW_LABELS.length - 1)
    expect(view.getAllByTestId('settings-row-external')).toHaveLength(1)
  })

  // **이 개편의 핵심.** 두 무리를 가르는 것은 카드 경계뿐이다. 한 카드에 다 넣는 시안은
  // "성격이 다른 것이 한 덩어리로 읽힌다"는 문제를 그대로 둔다.
  it('세 카드가 성질대로 갈린다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    const cards = view.getAllByTestId('settings-card')
    expect(cards).toHaveLength(3)

    const labelsIn = (card: AtomElement): string[] =>
      ROW_LABELS.filter((label) => {
        let node: AtomElement | null = view.getByText(label)
        while (node !== null && node !== card) node = node.parent
        return node === card
      })

    expect(labelsIn(cards[0])).toEqual([
      '앱 공지사항',
      '게임 공지사항',
      '업데이트',
      '이벤트',
      '캐시샵',
    ])
    expect(labelsIn(cards[1])).toEqual(['기능 설명', '개발 노트'])
    // 행이 하나만 남아도 카드로 남는다. 후원 수단이 정해지면 그 자리에 다시 들어온다.
    expect(labelsIn(cards[2])).toEqual(['개발자 응원하기(앱 리뷰)'])
  })

  // 화살표가 "값이 있는가"가 아니라 "누르면 무언가 열린다"를 말한다.
  // 옛 배타(`rightContent ?? chevron`)에서는 값이 있는 행에서 화살표가 사라졌다.

  it.each([
    ['기능 설명', 'SettingsFeatureGuideList'],
    ['개발 노트', 'SettingsReleaseNotes'],
  ])('"%s" 행을 누르면 %s 로 민다', async (label, route) => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, label))

    expect(navigate).toHaveBeenCalledWith(route)
  })

  // 소식 행은 **자기 분류를 들고** 간다. 목록 화면이 그것만 그리고 제목도 그 이름을 쓴다.
  it.each([
    ['앱 공지사항', ['app']],
    ['게임 공지사항', ['game']],
    ['업데이트', ['update']],
    ['이벤트', ['event']],
    ['캐시샵', ['cashshop']],
  ])('"%s" 행은 그 분류로 목록을 연다', async (label, kinds) => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(rowOf(view, label))

    expect(navigate).toHaveBeenCalledWith('SettingsNotices', { kinds, title: label })
  })

  // 후원 수단을 아직 안 정했다. 누를 수 있게 그려 놓고 아무 일도 안 하는 행은 고장으로 읽힌다.
  it('커피 행을 두지 않는다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.queryByText('커피 한 잔 사주기')).toBeNull()
  })

  // 앱 안 리뷰 팝업을 안 쓴다. 네이티브 의존을 들이면 런타임 지문이 바뀌고, 그러면 이미 스토어에
  // 나간 바이너리가 OTA 를 못 받는다. 링크는 JS 라 OTA 로 나간다.
  it.each([
    ['ios', 'itms-apps://apps.apple.com/app/id6797579391?action=write-review'],
    ['android', 'market://details?id=com.mapleroutine.app'],
  ])('%s 에서 응원 행은 스토어 리뷰 주소를 연다', async (os, url) => {
    Platform.OS = os as typeof Platform.OS

    const view = await renderOverlay(<SettingsScreen />)
    await press(rowOf(view, '개발자 응원하기(앱 리뷰)'))

    expect(openURL).toHaveBeenCalledWith(url)
  })

  // 설정은 본문이 아니라 머리에 산다. 본문에 두면 매일 보는 소식이 가끔 쓰는 설정에 밀린다.
  it('머리의 톱니바퀴가 설정을 연다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(view.getByLabelText('설정'))

    expect(navigate).toHaveBeenCalledWith('AppSettings')
  })

  // 들어가지 않고도 안을 짐작하게 하는 값 하나.

  // 조회 전에도 값과 같은 자리를 잡는다(빈 문자열이면 값이 툭 나타나며 행이 밀린다).

  // 조회 실패도 같은 자리표시로 남는다. 설정을 못 여는 실패가 아니다.

  // 후보가 전부 틀린 말을 한다. "최신 버전"은 아래 `앱 정보` 행과 중복이고 "n개"는
  // 뜻이 없다. 없는 대표값을 지어내지 않는다.
  it('"기능 설명"·"개발 노트" 행에는 대표값을 두지 않는다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    // 행 안에 남는 글자는 라벨 하나뿐이다(chevron 은 글자가 아니다).
    for (const label of ['기능 설명', '개발 노트']) {
      expect(textsIn(rowOf(view, label))).toEqual([label])
    }
  })

  //  정정: 모드 전환은 세 스토어를 **모두** 낡게 만든다(저장 경로에서 컨텐츠가
  // 빠진 것은 그쪽이 저장의 주체여서일 뿐이다). 이것이 없으면 자동 → 수동 직후 보스 탭이
  // "추적할 주간 보스가 없습니다"로 뜨고 새로고침해야 목록이 나온다.

  // 셋 다 `/settings/account-data` 로 내려갔다. 되돌아오면 값을 고르는 카드가 다시 혼종이 된다.

  it('하단에 앱 버전·카피라이트·NEXON Open API 출처 문구·비제휴 고지를 표시한다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByText(`v${packageJson.version}`)).toBeTruthy()
    expect(view.getByText(/©\s*\d{4}\s*메이플 루틴/)).toBeTruthy()
    expect(view.getByText('Data based on NEXON Open API')).toBeTruthy()
    expect(view.getByText('Maple Routine is not associated with NEXON Korea')).toBeTruthy()
  })

  // 개인정보 처리방침은 `/settings/about` 의 행으로 옮겼고, 고지 블록은
  // 전부 읽고 끝나는 정적 문구만 남는다. 링크가 여기로 되돌아오면 그 균일함이 다시 깨진다.
  it('고지 블록은 4줄이고 링크를 두지 않는다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    expect(view.getByTestId('settings-footer').children).toHaveLength(4)
    expect(view.queryByText('개인정보 처리방침')).toBeNull()
  })
})

// 보스 수익의 `캐릭터 선택하러 가기` 와 두 스케줄러의 빈 상태 CTA 가 캐릭터 관리를 열어 둔 채로
// 이 탭에 보낸다. 설정이 머리로 옮겨 가도 그 계약은 더보기가 그대로 진다.
describe('SettingsScreen: openPicker 로 들어올 때', () => {

})

// 보스 수익의 `캐릭터 선택하러 가기` 와 두 스케줄러의 빈 상태 CTA 가 캐릭터 관리를 열어 둔 채로
// 이 탭에 보낸다. 설정이 머리로 옮겨 가도 그 계약은 더보기가 그대로 진다.
describe('SettingsScreen: openPicker 로 들어올 때', () => {
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

// 설정 하위 화면으로 가는 버튼이다. 화면이 바뀌므로 이동 촉각이다.
describe('설정 버튼의 촉각', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(installNoopNativePorts)

  it('누르면 한 번 난다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    await press(view.getByLabelText('설정'))

    expect(tap).toHaveBeenCalledTimes(1)
  })
})
