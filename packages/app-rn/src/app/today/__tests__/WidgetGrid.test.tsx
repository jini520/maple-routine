// 격자 **껍데기**([[ADR-146]] 결정 2·3·5 · 정정 1). 위젯 내용은 아직 stub 이라 이 파일이 묻는 것은
// 하나다 — «타일 여덟이 적어 둔 좌표에 서는가».
//
// ── 값을 손으로 적지 않는 자리 ──────────────────────────────────────────────────────
// 치수는 `resolveWidgetGridMetrics` 에서 읽는다(`TabNavigator`·`ScreenScroll` 테스트가 바 치수를
// 다루는 방식과 같다). 대신 **좌표 산식은 테스트가 직접 편다**(`col × (열폭 + 간격)`) — 그 산식이
// 곧 이 컴포넌트가 지켜야 할 계약이라, 컴포넌트가 부르는 함수를 테스트도 부르면 아무것도 안 묻게 된다.

import { act, fireEvent, within } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { maybeShowTabSwitchAd } from '@core/features/ads/tab-switch-ad'

import {
  renderAtom,
  flattenStyle,
  type AtomElement,
} from '../../../components/__tests__/render-atom'
import { resolveWidgetGridMetrics } from '../../../lib/widget-grid-metrics'
import { useScreenNavigation } from '../../use-screen-navigation'
import type { TodayViewModel } from '../view-model'
import { WidgetGrid } from '../WidgetGrid'

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))
jest.mock('@core/features/ads/tab-switch-ad', () => ({
  maybeShowTabSwitchAd: jest.fn(async () => {}),
}))

const navigate = jest.fn()
const mockedUseScreenNavigation = jest.mocked(useScreenNavigation)
const mockedMaybeShowTabSwitchAd = jest.mocked(maybeShowTabSwitchAd)

type Rendered = Awaited<ReturnType<typeof renderAtom>>

/**
 * 위젯이 전부 stub 이라 **내용은 아무도 안 읽는다** — 그래도 값을 넣는 이유는 프롭 계약이 이미
 * `TodayViewModel` 이기 때문이다(결정 4). 빈 상태로 두는 것이 격자 검사에 가장 정직하다.
 */
const 빈_뷰모델: TodayViewModel = {
  representative: null,
  schedule: [],
  scheduleTotal: 0,
  profit: { totalMeso: 0, crystalMeso: 0, itemMeso: 0, hasRecords: false, topCharacters: [] },
  topItem: null,
  unpricedCount: 0,
  crystalLimits: [],
  drought: null,
  resets: {
    daily: { atMs: 0, remainingMs: 0 },
    weekly: { atMs: 0, remainingMs: 0 },
    monthly: { atMs: 0, remainingMs: 0 },
  },
}

const metrics = resolveWidgetGridMetrics(Dimensions.get('window').width)
const 행 = metrics.rowHeightPx + metrics.gapPx
const 열 = metrics.colWidthPx + metrics.gapPx

async function 격자(): Promise<Rendered> {
  return renderAtom(<WidgetGrid data={빈_뷰모델} />)
}

function 타일(view: Rendered, id: string): AtomElement {
  return view.getByTestId(`widget-tile-${id}`)
}

function 스타일(element: AtomElement): Record<string, unknown> {
  return flattenStyle(element.props.style)
}

beforeEach(() => {
  mockedUseScreenNavigation.mockReturnValue({ navigate } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('WidgetGrid — 좌표 배치', () => {
  it('타일 여덟이 적어 둔 좌표에 선다', async () => {
    const view = await 격자()

    // (0,0) 4x1 — 가로를 다 쓰는 타일의 폭은 «창폭 − 좌우 여백» 이다.
    expect(스타일(타일(view, 'representative-character'))).toMatchObject({
      left: 0,
      top: 0,
      width: 4 * metrics.colWidthPx + 3 * metrics.gapPx,
    })
    // (0,1)·(2,1) 2x1 두 장이 한 행을 나눠 쓴다.
    expect(스타일(타일(view, 'reset-countdown'))).toMatchObject({ left: 0, top: 행 })
    expect(스타일(타일(view, 'crystal-limit'))).toMatchObject({
      left: 2 * 열,
      top: 행,
      width: 2 * metrics.colWidthPx + metrics.gapPx,
    })
    // (0,2) 4×auto — 그 아래는 4x3 · 2x1 둘 · 4x1 이 이어 붙는다.
    expect(스타일(타일(view, 'remaining-schedule'))).toMatchObject({ left: 0, top: 2 * 행 })
    expect(스타일(타일(view, 'weekly-boss-profit'))).toMatchObject({ left: 0, top: 3 * 행 })
    expect(스타일(타일(view, 'top-valuable-item'))).toMatchObject({ left: 0, top: 6 * 행 })
    expect(스타일(타일(view, 'unpriced-drops'))).toMatchObject({ left: 2 * 열, top: 6 * 행 })
    expect(스타일(타일(view, 'valuable-drought'))).toMatchObject({ left: 0, top: 7 * 행 })
  })

  it('격자 컨테이너 높이가 가장 아래 타일의 끝이다', async () => {
    const view = await 격자()

    expect(스타일(view.getByTestId('widget-grid'))).toMatchObject({
      height: 7 * 행 + metrics.rowHeightPx,
    })
  })

  it('스냅샷', async () => {
    const view = await 격자()

    expect(view.toJSON()).toMatchSnapshot()
  })
})

describe('`h: auto` 타일 ([[ADR-146]] 정정 1)', () => {
  // 선언한 `h` 는 **최소 높이**다 — 실측이 오기 전에도 그 값으로 자리를 잡아야 격자가 첫 프레임부터
  // 맞는다(측정을 기다리면 한 프레임 접혀 있다 — [[ADR-132]] 정정 30 과 같은 이유).
  it('측정 전에는 nominal 최소 높이로 그린다', async () => {
    const view = await 격자()
    const 카드 = within(타일(view, 'remaining-schedule')).getByTestId('widget-remaining-schedule')
      .parent

    expect(스타일(카드 as AtomElement).minHeight).toBe(metrics.rowHeightPx)
    expect(스타일(카드 as AtomElement).height).toBeUndefined()
  })

  it('실측이 최소 높이를 넘으면 그 아래 타일이 전부 초과분만큼 내려간다', async () => {
    const view = await 격자()
    const 실측 = 200
    const 초과 = 실측 - metrics.rowHeightPx

    await act(async () => {
      fireEvent(타일(view, 'remaining-schedule'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 실측 } },
      })
    })

    // 자기 자신과 위쪽 타일은 그대로다 — 밀리는 것은 «아래» 뿐이다.
    expect(스타일(타일(view, 'reset-countdown'))).toMatchObject({ top: 행 })
    expect(스타일(타일(view, 'remaining-schedule'))).toMatchObject({ top: 2 * 행 })
    expect(스타일(타일(view, 'weekly-boss-profit'))).toMatchObject({ top: 3 * 행 + 초과 })
    expect(스타일(타일(view, 'valuable-drought'))).toMatchObject({ top: 7 * 행 + 초과 })
    expect(스타일(view.getByTestId('widget-grid'))).toMatchObject({
      height: 7 * 행 + 초과 + metrics.rowHeightPx,
    })
  })

  // 계산으로 나오는 값을 재면 첫 프레임에 0 이고, 그 0 이 그대로 좌표가 된다.
  it('auto 가 아닌 타일에는 `onLayout` 을 걸지 않는다', async () => {
    const view = await 격자()

    expect(타일(view, 'remaining-schedule').props.onLayout).toBeInstanceOf(Function)
    for (const id of ['representative-character', 'weekly-boss-profit', 'reset-countdown']) {
      expect(타일(view, id).props.onLayout).toBeUndefined()
    }
  })
})

describe('타일 탭 ([[ADR-146]] 결정 5)', () => {
  it('`target` 이 있는 타일은 그 탭으로 보내고 광고 게이트를 탄다', async () => {
    const view = await 격자()

    await act(async () => {
      fireEvent.press(within(타일(view, 'weekly-boss-profit')).getByRole('button'))
    })

    expect(navigate).toHaveBeenCalledWith('Tabs', { screen: 'Profit' })
    expect(mockedMaybeShowTabSwitchAd).toHaveBeenCalledTimes(1)
  })

  it('`target` 이 없는 타일은 누를 수 없다', async () => {
    const view = await 격자()

    expect(within(타일(view, 'reset-countdown')).queryByRole('button')).toBeNull()
  })
})
