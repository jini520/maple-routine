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
import { act, fireEvent } from '@testing-library/react-native'

import { loadCacheDataSizes } from '@core/features/settings/cache-data'
import { useThemeStore } from '@core/features/theme/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { THEME_NAMES } from '@core/lib/theme-registry'

import packageJson from '../../../../package.json'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsScreen } from '../SettingsScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

jest.mock('@core/features/theme/store', () => ({ useThemeStore: jest.fn() }))
jest.mock('@core/features/tracking-mode/store', () => ({ useTrackingModeStore: jest.fn() }))
// 본화면이 대표값으로 캐시 총 용량을 읽는다([[ADR-118]] 결정 5) — 화면은 `features/` 를 거치고
// 저장소·SQLite 는 그 아래가 맡는다(CLAUDE.md CRITICAL).
jest.mock('@core/features/settings/cache-data', () => ({ loadCacheDataSizes: jest.fn() }))
jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

const mockedUseThemeStore = jest.mocked(useThemeStore)
const mockedUseTrackingModeStore = jest.mocked(useTrackingModeStore)
const mockedLoadCacheDataSizes = jest.mocked(loadCacheDataSizes)
const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)

const navigate = jest.fn()
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

beforeEach(() => {
  mockThemeStore()
  mockTrackingModeStore()
  mockedUseSettingsNavigation.mockReturnValue({
    navigate,
    goBack: jest.fn(),
  } as unknown as ReturnType<typeof useSettingsNavigation>)
  // 기본은 "영원히 조회 중" — 자리표시(`- KB`)가 기본 상태라, 값이 필요한 케이스만 따로 세운다.
  mockedLoadCacheDataSizes.mockReturnValue(new Promise(() => {}))
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
  it('행이 정확히 6개이고 순서가 값 카드 → 이동 카드다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    for (const label of ROW_LABELS) expect(view.getByText(label)).toBeTruthy()
    expect(view.getAllByTestId('settings-row-chevron')).toHaveLength(ROW_LABELS.length)
  })

  // **이 개편의 핵심.** 두 무리를 가르는 것은 카드 경계뿐이다(결정 1) — 한 카드에 다 넣는 시안은
  // "성격이 다른 것이 한 덩어리로 읽힌다"는 문제를 그대로 둔다.
  it('값을 고르는 두 행과 화면이 넘어가는 네 행이 서로 다른 카드에 있다', async () => {
    const view = await renderOverlay(<SettingsScreen />)

    const cards = view.getAllByTestId('settings-card')
    expect(cards).toHaveLength(2)

    const labelsIn = (card: AtomElement): string[] =>
      ROW_LABELS.filter((label) => {
        let node: AtomElement | null = view.getByText(label)
        while (node !== null && node !== card) node = node.parent
        return node === card
      })

    expect(labelsIn(cards[0])).toEqual(['스케줄 관리 방법', '테마'])
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
