// 드롭 획득 히스토리. 웹판(500줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 넷
// ① **라우터가 없다**. 빈 상태 CTA 는 `goBack` 이 불렸는가로 본다(웹은 location 프로브였다).
// ② **셸 계약이 뒤집힌다**. 웹은 *"`screen-scroll` 이 없어야 한다"* 를 단언했다(공용 셸의 상단
//    보정이 sticky 헤더와 겹쳤다). RN 에는 그 보정이 없고 헤더가 스크롤 뷰의 형제라 **공용 셸을
//    쓰는 것이 맞는 그림**이라, 같은 자리에서 반대를 단언한다.
// ③ **클래스 문자열로 묻지 않는다**. `bg-`·`border-b` 유무를 보던 자리는 렌더된 스타일 값으로,
//    `data-valuable`·`data-drought-tier` 는 접근성 이름으로 옮겼다.
// ④ **골드 pill 이 중첩 `Text` 다**. RN 문장 안에는 상자를 넣을 수 없어 배경색만 남는다
//    (`DropHistoryScreen` 파일 머리 ④). 그래서 *"pill 클래스가 붙었나"* 는 *"골드 배경이 그 조각에
//    깔렸나"* 가 된다.
import { act, fireEvent, render } from '@testing-library/react-native'
import { processColor } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useDropHistoryStore } from '../../../features/boss-profit/drop-history-store'
import weeklyBossesData from '../../../data/weekly-bosses.json'
import { formatBossProfitPeriodLabel } from '../../../lib/boss/boss-profit-period'
import {
  formatValuableDroughtHeadline,
  valuableDroughtHeadlineCount,
  WORD_JOINER,
  type DropHistoryRecord,
} from '../../../lib/drop/drop-history'

import {
  flattenStyle,
   테스트_안전영역,
  type AtomElement,
} from '../../../components/__tests__/render-atom'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import { useScreenNavigation } from '../../use-screen-navigation'
import { DropHistoryScreen } from '../DropHistoryScreen'

jest.mock('../../../features/boss-profit/drop-history-store', () => ({ useDropHistoryStore: jest.fn() }))
jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedStore = jest.mocked(useDropHistoryStore)
const mockedNavigation = jest.mocked(useScreenNavigation)
const load = jest.fn()
const goBack = jest.fn()

// 보스 이름은 게임 레퍼런스 데이터에서 뽑는다.
const 주간보스 = weeklyBossesData.weekly[0].boss
const PERIOD = '2026-07-09'

/**
 * 문장에는 줄바꿈 금지용 zero-width 문자가 섞여 있다. 사람이 읽는 문장으로
 * 비교한다. 웹은 `textContent` 한 줄이면 됐지만 RN 트리에는 그런 프로퍼티가 없어 직접 모은다.
 */
function 문장(node: AtomElement): string {
  const parts: string[] = []
  const walk = (child: AtomElement | string): void => {
    if (typeof child === 'string') {
      parts.push(child)
      return
    }
    for (const grandchild of child.children) walk(grandchild)
  }
  for (const child of node.children) walk(child)
  return parts.join('').replaceAll(WORD_JOINER, '')
}

/**
 * 잎의 색. `<Path fill>` 이라 글자가 아니라 트리에서 집는다. 두 가지가 갈린다.
 *
 * ① RNTL 14 의 요소에는 `findAll` 이 없어(실측) `children` 을 직접 훑는다. 잎 경로는 `d` 를 가진
 *    유일한 노드라 그것으로 찾는다. `fill` 로 찾으면 그 위의 그룹이 먼저 걸린다(기본 검정).
 * ② `react-native-svg` 가 색을 **정규화한다**. `#f7d00d` 가 `{ payload, type }` 으로 온다.
 *    그래서 기대값도 `processColor` 를 통과시켜 같은 형태로 만든다.
 */
function 잎색(node: AtomElement): unknown {
  for (const child of node.children) {
    if (typeof child === 'string') continue
    if (child.props.d !== undefined) return child.props.fill
    const found = 잎색(child)
    if (found !== undefined) return found
  }
  return undefined
}

function 기록(overrides: Partial<DropHistoryRecord> = {}): DropHistoryRecord {
  return {
    ocid: 'ocid-1',
    boss: 주간보스,
    difficulty: '하드',
    periodKey: PERIOD,
    category: 'equipment',
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    quantity: 1,
    ...overrides,
  }
}

type Store = ReturnType<typeof useDropHistoryStore>

function mockStore(overrides: Partial<Store> = {}): void {
  mockedStore.mockReturnValue({
    status: 'ready',
    groups: [],
    drought: null,
    charactersByOcid: {
      'ocid-1': { ocid: 'ocid-1', characterName: '메이플영웅', imageUrl: null },
    },
    load,
    ...overrides,
  } as unknown as Store)
}

/**
 * **`rerender` 로 프로바이더를 날리지 않으려면 같은 트리를 다시 넘겨야 한다**(step 3 이 실측해 적어
 * 둔 함정). 그래서 `renderOverlay` 대신 트리를 여기서 짜고 `rerenderSame` 을 함께 돌려준다.
 * 마운트당 한 번만 하는 일(무작위 문구 고정)을 확인하는 케이스가 그것을 쓴다.
 */
async function renderHistory() {
  const tree = (
    <SafeAreaProvider initialMetrics={테스트_안전영역}>
      <ThemeProvider>
        <DropHistoryScreen />
      </ThemeProvider>
    </SafeAreaProvider>
  )
  // **`render` 의 결과를 먼저 await 한다**. RNTL 14 의 반환값은 thenable 이라, 펼쳐서
  // (`{...view}`) 돌려주면 `then` 이 사라져 호출부의 `await` 가 아무것도 기다리지 않는다(실측:
  // 마운트 이펙트가 안 돌아 케이스 전체가 빈 화면을 봤다).
  const view = await render(tree)
  return { ...view, rerenderSame: () => view.rerender(tree) }
}

beforeEach(() => {
  load.mockReset().mockResolvedValue(undefined)
  goBack.mockReset()
  mockedNavigation.mockReturnValue({ goBack } as unknown as ReturnType<typeof useScreenNavigation>)
  mockStore()
})

describe('DropHistoryScreen: 셸과 조회', () => {
  // 웹은 *"`screen-scroll` 이 없어야 한다"* 였다. 공용 셸의 `-mt-[var(--sa-top)]` 이 흐름 밖 `fixed`
  // 헤더를 전제한 보정이라 이 화면의 sticky 헤더와 겹쳤기 때문이다(실기기 계측 31px). RN 에는 그
  // 보정 자체가 없고 헤더가 스크롤 뷰의 **형제**라 공용 셸이 곧 맞는 그림이다.
  it('공용 셸을 쓰고 헤더가 상단 안전영역을 먹는다', async () => {
    const { getByTestId } = await renderHistory()

    expect(getByTestId('screen-scroll')).toBeTruthy()
    expect(flattenStyle(getByTestId('page-header').props.style).paddingTop).toBe(
      // 여백을 더하지 않는다. 이 화면은 공용 셸을 안 쓰고 같은 값을 자기 파일에서
      // 내므로, 공용 셸만 고치고 여기를 빠뜨리면 두 화면의 제목 높이가 갈린다.
      테스트_안전영역.insets.top,
    )
  })

  it('마운트하면 전 기간 기록을 불러온다', async () => {
    mockStore({ status: 'idle' })
    await renderHistory()

    expect(load).toHaveBeenCalled()
  })

  it('조회 중에는 로딩을 보여준다', async () => {
    mockStore({ status: 'loading' })
    const { getByTestId } = await renderHistory()

    expect(getByTestId('loading-state')).toBeTruthy()
  })

  it('실패하면 빈 상태가 아니라 실패 상태와 다시 시도를 보여준다', async () => {
    mockStore({ status: 'failed' })
    const { getByTestId, getByText, queryByTestId } = await renderHistory()

    expect(getByTestId('error-state')).toBeTruthy()
    expect(queryByTestId('empty-state')).toBeNull()

    await act(async () => {
      fireEvent.press(getByText('다시 시도'))
    })
    expect(load).toHaveBeenCalledTimes(2) // 마운트 1 + 탭 1
  })

  it('기록이 없으면 빈 상태에서 보스 수익 화면으로 보낸다', async () => {
    const { getByTestId, getByText } = await renderHistory()

    expect(getByTestId('empty-state')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByText('보스 수익으로'))
    })
    expect(goBack).toHaveBeenCalled()
  })

  it('뒤로는 pop 이다', async () => {
    const { getByLabelText } = await renderHistory()

    await act(async () => {
      fireEvent.press(getByLabelText('뒤로'))
    })
    expect(goBack).toHaveBeenCalled()
  })
})

// 사용자 지정 형식. 한 기록이 목록에서 큰 비중을 차지하지 않도록 아이콘·난이도
// 배지·2단 레이아웃 없이 한 줄 문장으로만 둔다.
describe('DropHistoryScreen: 기록 한 줄', () => {
  it('고가가 아닌 기록은 한 줄 문장으로만 보여준다', async () => {
    mockStore({
      groups: [
        {
          periodKey: PERIOD,
          cycle: 'weekly',
          records: [기록({ itemName: '가디언 엔젤링', slot: undefined })],
        },
      ],
    })
    const { getByTestId, queryByLabelText, queryByTestId } = await renderHistory()

    expect(문장(getByTestId('drop-history-entry'))).toBe(
      `메이플영웅님이 ${주간보스}(하드)에서 가디언 엔젤링을 획득하였습니다.`,
    )
    // 꾸밈 없음. 골드 강조도, 아이템 아이콘도 붙지 않는다.
    expect(queryByLabelText('고가 드롭 기록')).toBeNull()
    expect(queryByTestId('valuable-drop-inline')).toBeNull()
  })

  it('고가 기록만 골드로 꾸민다. 아이템명 배경 + 아이템 아이콘', async () => {
    // 루즈 컨트롤 머신 마크 = 칠흑의 보스 세트(고가).
    mockStore({ groups: [{ periodKey: PERIOD, cycle: 'weekly', records: [기록()] }] })
    const { getByLabelText, getByTestId } = await renderHistory()

    // 웹의 `data-valuable` 자리. RN 에는 데이터 속성이 없어 접근성 이름으로 옮겼다.
    expect(getByLabelText('고가 드롭 기록')).toBeTruthy()
    // 웹의 `.valuable-drop-badge` 는 그라디언트 pill 이었고 RN 에서는 단색 배경만 남는다.
    // 지켜야 하는 것은 *"골드 위에 골드 잉크"* 라는 사실이다(파일 머리 ④).
    const inline = flattenStyle(getByTestId('valuable-drop-inline').props.style)
    expect(inline.backgroundColor).toBe('#f7c400')
    expect(inline.color).toBe('#6b4e00')
  })

  //  이 **명시적으로 뺀 것**. 줄간격을 좁히면 배경 블록끼리 붙어 서로를 잡아먹는다.
  it('고가 줄에도 `.valuable-drop-row` 배경은 쓰지 않는다', async () => {
    mockStore({ groups: [{ periodKey: PERIOD, cycle: 'weekly', records: [기록()] }] })
    const { queryByTestId } = await renderHistory()

    expect(queryByTestId('valuable-drop-row-tint')).toBeNull()
    expect(queryByTestId('valuable-drop-row-glow')).toBeNull()
  })

  it('수량이 2 이상일 때만 개수를 말한다', async () => {
    mockStore({
      groups: [
        {
          periodKey: PERIOD,
          cycle: 'weekly',
          records: [
            기록({ itemName: '주문의 흔적', category: 'fixed', slot: undefined, quantity: 240 }),
            기록({ itemName: '가디언 엔젤링', slot: undefined, quantity: 1 }),
          ],
        },
      ],
    })
    const { getAllByTestId } = await renderHistory()

    const entries = getAllByTestId('drop-history-entry')
    expect(문장(entries[0])).toContain('주문의 흔적 240개를 획득하였습니다.')
    expect(문장(entries[1])).toContain('가디언 엔젤링을 획득하였습니다.')
    expect(문장(entries[1])).not.toContain('개')
  })

  it('상자 개봉 결과는 상자와 등급을 함께 말한다', async () => {
    mockStore({
      groups: [
        {
          periodKey: PERIOD,
          cycle: 'weekly',
          records: [
            기록({
              itemName: '리스트레인트 링',
              category: 'consumable',
              slot: undefined,
              boxOrigin: '홍옥의 보스 반지 상자',
              ringLevel: 3,
            }),
          ],
        },
      ],
    })
    const { getByTestId, getByText, queryByTestId } = await renderHistory()

    expect(문장(getByTestId('drop-history-entry'))).toBe(
      `메이플영웅님이 ${주간보스}(하드)에서 홍옥의 보스 반지 상자를 열어 리스트레인트 링 3레벨을 획득하였습니다.`,
    )
    // 상자명도 아이템과 같은 굵기로 강조한다. "무엇을 열었는지"가 정보의 절반이다.
    // 단 골드(고가)는 결과에만 붙는다. 둘 다 골드면 어느 쪽이 값인지 흐려진다.
    expect(flattenStyle(getByText('홍옥의 보스 반지 상자').props.style).fontWeight).toBe('600')
    expect(queryByTestId('valuable-drop-inline')).toBeNull()
  })

  it('캐릭터 캐시가 없는 기록은 ocid 를 노출하지 않고 이름 부분만 비운다', async () => {
    mockStore({
      groups: [
        {
          periodKey: PERIOD,
          cycle: 'weekly',
          records: [기록({ ocid: 'ocid-unknown', itemName: '가디언 엔젤링', slot: undefined })],
        },
      ],
      charactersByOcid: {},
    })
    const { getByTestId } = await renderHistory()

    expect(문장(getByTestId('drop-history-entry'))).toBe(
      `${주간보스}(하드)에서 가디언 엔젤링을 획득하였습니다.`,
    )
  })
})

describe('DropHistoryScreen: 기간 구분', () => {
  it('기간 라벨 아래에 날짜 구간을 작게 붙이고 양옆에 헤어라인을 둔다', async () => {
    mockStore({ groups: [{ periodKey: PERIOD, cycle: 'weekly', records: [기록()] }] })
    const { getByTestId, getAllByTestId } = await renderHistory()

    const expected = formatBossProfitPeriodLabel('weekly', PERIOD, new Date())
    expect(문장(getByTestId('drop-history-period'))).toContain(expected.primary)
    expect(getByTestId('drop-history-period-range').props.children).toBe(expected.secondary)
    // 헤어라인은 `aria-hidden` 이라 **기본 질의에서 빠진다**(step 4 가 실측한 성질). 장식이므로
    // 그것이 맞고, 여기서는 존재만 확인하려고 숨은 것까지 훑는다.
    expect(getAllByTestId('drop-history-period-rule', { includeHiddenElements: true })).toHaveLength(2)
  })

  // 월간 폴백이 `{ primary: secondary, secondary }` 를 주므로 지난 달보다 오래된 달은 같은 글자가
  // 두 줄로 겹친다.
  it('날짜 구간이 라벨과 같은 값이면 렌더하지 않는다', async () => {
    mockStore({ groups: [{ periodKey: '2026-03', cycle: 'monthly', records: [기록()] }] })
    const { queryByTestId } = await renderHistory()

    const label = formatBossProfitPeriodLabel('monthly', '2026-03', new Date())
    expect(label.primary).toBe(label.secondary)
    expect(queryByTestId('drop-history-period-range')).toBeNull()
  })

  it('기간 그룹마다 기간 라벨을 보여준다. 주간·월간이 한 목록에 섞인다', async () => {
    mockStore({
      groups: [
        { periodKey: PERIOD, cycle: 'weekly', records: [기록()] },
        { periodKey: '2026-07', cycle: 'monthly', records: [기록({ periodKey: '2026-07' })] },
      ],
    })
    const { getAllByTestId } = await renderHistory()

    const weekly = formatBossProfitPeriodLabel('weekly', PERIOD, new Date())
    const monthly = formatBossProfitPeriodLabel('monthly', '2026-07', new Date())
    const headers = getAllByTestId('drop-history-period')

    expect(headers).toHaveLength(2)
    expect(문장(headers[0])).toContain(weekly.primary)
    expect(문장(headers[1])).toContain(monthly.primary)
  })
})

// 제목이 슬픔 단계를 말하고, 아래 줄이 "마지막 에픽 빔! {기간} · {아이템}" 이다.
describe('DropHistoryScreen: 미획득 요약', () => {
  function 가뭄(weeksSince: number, records = [기록()]) {
    return { periodKey: PERIOD, cycle: 'weekly' as const, weeksSince, records }
  }

  /**
   * 그 단계의 문구 풀. 단계마다 여럿이고 화면이 마운트당 하나를 무작위로 고른다.
   * 그래서 화면 테스트는 문구를 단정하지 않고 "그 단계의 풀에 있는가"만 본다(단계 자체는 접근성
   * 이름이 말한다).
   */
  function 문구풀(weeksSince: number): string[] {
    return Array.from({ length: valuableDroughtHeadlineCount(weeksSince) }, (_, index) =>
      formatValuableDroughtHeadline(weeksSince, index),
    )
  }

  it('제목에 슬픔 단계, 아래 줄에 마지막 에픽 빔 정보를 담는다', async () => {
    mockStore({
      groups: [{ periodKey: PERIOD, cycle: 'weekly', records: [기록()] }],
      drought: 가뭄(3),
    })
    const { getByTestId } = await renderHistory()

    const summary = 문장(getByTestId('valuable-drought'))
    // 3주 미획득 = 사용자 지정 4주차 풀
    expect(문구풀(3).some((headline) => summary.includes(headline))).toBe(true)
    expect(summary).toContain('마지막 에픽 빔!')
    expect(summary).toContain('루즈 컨트롤 머신 마크')
  })

  // 문구는 사용자 지정(2026-08-01·2026-08-17). **전 단계가 풀**이라 표는 문구를 담지 않고 풀 소속만
  // 본다. **한 케이스에서 네 번 렌더하지 않는다**. RNTL 14 는 한 케이스에 렌더가
  // 셋을 넘기면 그 뒤가 빈 화면으로 떨어진다(step 2 가 실측해 적어 둔 함정, 여기서 다시 밟았다).
  it.each([
    [0, '#f7d00d', 0],
    [1, '#e0b400', 6],
    [2, '#b99a5c', 14],
    [3, '#9a9a93', 26],
  ])('%i주 미획득이면 단계·문구·잎이 함께 움직인다', async (weeks, color, rotate) => {
    mockStore({
      groups: [{ periodKey: PERIOD, cycle: 'weekly', records: [기록()] }],
      drought: 가뭄(weeks),
    })
    const { getByLabelText, getByTestId } = await renderHistory()

    // 웹의 `data-drought-tier` 자리. 데이터 속성이 없어 접근성 이름으로 옮겼다.
    expect(getByLabelText(`고가 드롭 미획득 ${weeks}단계`)).toBeTruthy()
    const summary = 문장(getByTestId('valuable-drought'))
    expect(문구풀(weeks).some((headline) => summary.includes(headline))).toBe(true)

    const leaf = getByTestId('valuable-drought-leaf', { includeHiddenElements: true })
    expect(flattenStyle(leaf.props.style).transform).toEqual([{ rotate: `${rotate}deg` }])
    // 잎 색은 테마 토큰이 아니라 고정 hex 다. "골드 → 무채색 → 회청색" 한 줄기라 테마마다
    // 갈리면 의미를 잃는다(와 같은 사정).
    expect(잎색(leaf)).toMatchObject({ payload: processColor(color) })
  })

  it('0단계에는 글로우가 붙는다', async () => {
    mockStore({ drought: 가뭄(0) })
    const { getByTestId } = await renderHistory()

    expect(
      flattenStyle(getByTestId('valuable-drought-leaf', { includeHiddenElements: true }).props.style)
        .filter,
    ).toEqual([{ dropShadow: '0 0 5px rgba(247,208,13,0.75)' }])
  })

  it('그 아래 단계에는 글로우가 없다', async () => {
    mockStore({ drought: 가뭄(2) })
    const { getByTestId } = await renderHistory()

    expect(
      flattenStyle(getByTestId('valuable-drought-leaf', { includeHiddenElements: true }).props.style)
        .filter,
    ).toBeUndefined()
  })

  // 아직 진행 중인 주를 "마지막"이라 부르면 어색하다.
  it('이번 주에 먹었으면 "마지막"이라 말하지 않는다', async () => {
    mockStore({ drought: 가뭄(0) })
    const { getByTestId } = await renderHistory()

    const summary = 문장(getByTestId('valuable-drought'))
    expect(문구풀(0).some((headline) => summary.includes(headline))).toBe(true)
    expect(summary).not.toContain('마지막')
  })

  // 4주 이상은 문구가 풀에서 무작위로 나온다. 단, 화면에 머무는 동안에는 고정이어야 한다
  // (리렌더마다 새로 뽑으면 문구가 깜빡인다).
  it('4주 이상은 풀 문구 중 하나가 나오고 리렌더에도 바뀌지 않는다', async () => {
    mockStore({ drought: 가뭄(9) })
    const { getByTestId, rerenderSame } = await renderHistory()

    const pool = 문구풀(9)
    const shown = 문장(getByTestId('valuable-drought'))
    expect(pool.some((headline) => shown.includes(headline))).toBe(true)

    await act(async () => {
      rerenderSame()
    })
    expect(문장(getByTestId('valuable-drought'))).toBe(shown)
  })

  it('요약에도 배경·카드를 두지 않는다', async () => {
    mockStore({ drought: 가뭄(3) })
    const { getByTestId } = await renderHistory()

    const style = flattenStyle(getByTestId('valuable-drought').props.style)
    expect(style.backgroundColor).toBeUndefined()
    expect(style.borderWidth).toBeUndefined()
    expect(style.borderRadius).toBeUndefined()
  })

  it('그 주에 고가를 여럿 먹었으면 첫 항목 + 외 N개로 줄인다', async () => {
    mockStore({
      drought: 가뭄(3, [기록(), 기록({ itemName: '창세의 뱃지', slot: undefined })]),
    })
    const { getByTestId } = await renderHistory()

    expect(문장(getByTestId('valuable-drought'))).toContain('루즈 컨트롤 머신 마크 외 1개')
  })

  it('고가 기록이 없으면 요약 요소를 렌더하지 않는다. "∞주째"를 만들지 않는다 (결정 4)', async () => {
    mockStore({ groups: [{ periodKey: PERIOD, cycle: 'weekly', records: [기록()] }], drought: null })
    const { queryByTestId } = await renderHistory()

    expect(queryByTestId('valuable-drought')).toBeNull()
  })
})
