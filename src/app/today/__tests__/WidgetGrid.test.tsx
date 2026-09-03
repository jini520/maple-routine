// 격자 **껍데기**. 위젯 내용은 각자의 테스트가 보므로 이 파일이
// 묻는 것은 하나다. **타일 여덟이 적어 둔 좌표에 서는가**.
//
// 값을 손으로 적지 않는 자리
// 치수는 `resolveWidgetGridMetrics` 에서 읽는다(`TabNavigator`·`ScreenScroll` 테스트가 바 치수를
// 다루는 방식과 같다). 대신 **좌표 산식은 테스트가 직접 편다**(`col × (열폭 + 간격)`). 그 산식이
// 곧 이 컴포넌트가 지켜야 할 계약이라, 컴포넌트가 부르는 함수를 테스트도 부르면 아무것도 안 묻게 된다.

import { act, fireEvent, within } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import {
  renderAtom,
  flattenStyle,
  type AtomElement,
} from '../../../components/__tests__/render-atom'
import { resolveWidgetGridMetrics } from '../../../lib/today/widget-grid-metrics'
import { useScreenNavigation } from '../../use-screen-navigation'
import { 빈_뷰모델 } from '../widgets/__tests__/widget-fixture'
import { WidgetGrid } from '../WidgetGrid'

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const navigate = jest.fn()
// 층이 스택이 된 뒤로 **그룹 층으로 되돌리기** 는 액션이다. 화면이 이것도 부른다.
const dispatch = jest.fn()
const mockedUseScreenNavigation = jest.mocked(useScreenNavigation)

type Rendered = Awaited<ReturnType<typeof renderAtom>>

/**
 * 이 파일이 검사하는 것은 **격자**다. 내용은 빈 상태로 두는 것이 가장 정직하다(타일이 무엇을
 * 그리는지는 위젯 테스트가 따로 본다). 값은 위젯 테스트와 **같은 픽스처**를 쓴다: 두 벌로 두면
 * `TodayViewModel` 이 늘 때마다 한쪽만 고쳐진다(실제로 그렇게 갈렸다).
 */

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
  mockedUseScreenNavigation.mockReturnValue({ navigate, dispatch } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('WidgetGrid: 좌표 배치', () => {
  it('타일 아홉이 적어 둔 좌표에 선다', async () => {
    const view = await 격자()

    // (0,0) 4x1. 가로를 다 쓰는 타일의 폭은 **창폭 − 좌우 여백** 이다.
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
    // (0,2)~(0,4) 4×auto **셋**. 그 아래는 2x1 둘· 4x1 이 이어 붙는다.
    expect(스타일(타일(view, 'shared-contents'))).toMatchObject({ left: 0, top: 2 * 행 })
    expect(스타일(타일(view, 'remaining-schedule'))).toMatchObject({ left: 0, top: 3 * 행 })
    expect(스타일(타일(view, 'weekly-boss-profit'))).toMatchObject({ left: 0, top: 4 * 행 })
    expect(스타일(타일(view, 'top-valuable-item'))).toMatchObject({ left: 0, top: 5 * 행 })
    expect(스타일(타일(view, 'unpriced-drops'))).toMatchObject({ left: 2 * 열, top: 5 * 행 })
    expect(스타일(타일(view, 'valuable-drought'))).toMatchObject({ left: 0, top: 6 * 행 })
  })

  it('격자 컨테이너 높이가 가장 아래 타일의 끝이다', async () => {
    const view = await 격자()

    expect(스타일(view.getByTestId('widget-grid'))).toMatchObject({
      height: 6 * 행 + metrics.rowHeightPx,
    })
  })

})

describe('`h: auto` 타일', () => {
  // 선언한 `h` 는 **최소 높이**다. 실측이 오기 전에도 그 값으로 자리를 잡아야 격자가 첫 프레임부터
  // 맞는다(측정을 기다리면 한 프레임 접혀 있다. 과 같은 이유).
  it('측정 전에는 nominal 최소 높이로 그린다', async () => {
    const view = await 격자()
    const 카드 = within(타일(view, 'remaining-schedule')).getByTestId('widget-remaining-schedule')
      .parent?.parent

    expect(스타일(카드 as AtomElement).minHeight).toBe(metrics.rowHeightPx)
    expect(스타일(카드 as AtomElement).height).toBeUndefined()
  })

  // ⚠️ 한때 `onLayout` 이 **최소 높이를 진 상자**(`Card` 를 감싼 래퍼)에 붙어 있었다. 그러면 재는
  // 값이 `max(minHeight, 내용)` 이고 그것이 다시 다음 `minHeight` 가 되어 **늘기만 하고 줄지 않는다**.
  // 아코디언을 한 번 펼쳤다 접으면 접힌 내용 위로 펼쳤을 때의 높이가 그대로 남았다.
  it('실측이 줄면 타일도 줄어든다. 늘기만 하는 래칫이 아니다', async () => {
    const view = await 격자()
    const 측정상자 = () => view.getByTestId('widget-measure-remaining-schedule')
    const 카드 = () =>
      within(타일(view, 'remaining-schedule')).getByTestId('widget-remaining-schedule').parent
        ?.parent

    await act(async () => {
      fireEvent(측정상자(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 380 } } })
    })
    expect(스타일(카드() as AtomElement).minHeight).toBe(380)

    await act(async () => {
      fireEvent(측정상자(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 236 } } })
    })
    expect(스타일(카드() as AtomElement).minHeight).toBe(236)

    // 아래 타일도 함께 되돌아온다. 초과분이 줄었으므로.
    expect(스타일(타일(view, 'weekly-boss-profit'))).toMatchObject({
      top: 4 * 행 + (236 - metrics.rowHeightPx),
    })
  })

  it('실측이 최소 높이를 넘으면 그 아래 타일이 전부 초과분만큼 내려간다', async () => {
    const view = await 격자()
    const 실측 = 200
    const 초과 = 실측 - metrics.rowHeightPx

    await act(async () => {
      fireEvent(view.getByTestId('widget-measure-remaining-schedule'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 실측 } },
      })
    })

    // 자기 자신과 위쪽 타일은 그대로다. 밀리는 것은 **아래** 뿐이다.
    expect(스타일(타일(view, 'reset-countdown'))).toMatchObject({ top: 행 })
    expect(스타일(타일(view, 'shared-contents'))).toMatchObject({ top: 2 * 행 })
    expect(스타일(타일(view, 'remaining-schedule'))).toMatchObject({ top: 3 * 행 })
    expect(스타일(타일(view, 'weekly-boss-profit'))).toMatchObject({ top: 4 * 행 + 초과 })
    expect(스타일(타일(view, 'valuable-drought'))).toMatchObject({ top: 6 * 행 + 초과 })
    expect(스타일(view.getByTestId('widget-grid'))).toMatchObject({
      height: 6 * 행 + 초과 + metrics.rowHeightPx,
    })
  })

  // auto 타일이 **셋**이 됐다. `w === 4` 라 옆 칸이 없어 초과분이
  // **누적**된다.
  // 이 규칙이 깨지면 두 타일이 서로를 덮는다.
  it('auto 타일 둘의 초과분이 누적된다. 위의 것이 아래 것을 민다', async () => {
    const view = await 격자()
    const 공유초과 = 120 - metrics.rowHeightPx
    const 스케줄초과 = 200 - metrics.rowHeightPx

    await act(async () => {
      fireEvent(view.getByTestId('widget-measure-shared-contents'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 120 } },
      })
    })
    await act(async () => {
      fireEvent(view.getByTestId('widget-measure-remaining-schedule'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 200 } },
      })
    })

    expect(스타일(타일(view, 'shared-contents'))).toMatchObject({ top: 2 * 행 })
    expect(스타일(타일(view, 'remaining-schedule'))).toMatchObject({ top: 3 * 행 + 공유초과 })
    expect(스타일(타일(view, 'weekly-boss-profit'))).toMatchObject({
      top: 4 * 행 + 공유초과 + 스케줄초과,
    })
  })

  // 계산으로 나오는 값을 재면 첫 프레임에 0 이고, 그 0 이 그대로 좌표가 된다.
  // 재는 것은 **auto 타일의 내용 상자 하나뿐**이다. 나머지는 계산으로 나오고, 재면 첫 프레임에
  // 0 이라 타일이 한 프레임 접혀 있다.
  it('auto 타일의 **내용** 만 잰다. 타일 래퍼도 다른 타일도 안 잰다', async () => {
    const view = await 격자()

    expect(view.getByTestId('widget-measure-remaining-schedule').props.onLayout).toBeInstanceOf(
      Function,
    )
    // 래퍼에 붙으면 자기가 크기를 정하는 상자를 재게 되어 높이가 늘기만 한다.
    expect(타일(view, 'remaining-schedule').props.onLayout).toBeUndefined()
    for (const id of ['representative-character', 'valuable-drought', 'reset-countdown']) {
      expect(타일(view, id).props.onLayout).toBeUndefined()
      expect(view.queryByTestId(`widget-measure-${id}`)).toBeNull()
    }
  })
})

describe('타일 탭', () => {
  // 여기서 **광고 게이트도 탄다** 를 함께 물었다. 이 전면광고를 걷으며 지웠고, 되살아나는
  // 것은 `src/__tests__/interstitial-policy.test.ts` 가 소스로 막는다.
  it('`target` 이 있는 타일은 그 탭으로 보낸다', async () => {
    const view = await 격자()

    await act(async () => {
      fireEvent.press(within(타일(view, 'weekly-boss-profit')).getByRole('button'))
    })

    // **한 층 내려가는 이동이다**. 보스 수익은 수익·지출 그룹의 하위라 그 층 화면을 연다.
    // 그것이 곧 스택 한 단이므로 ← 도, 가장자리 스와이프도 today 로 돌아온다.
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'LedgerSubs',
      params: { screen: 'Profit' },
    })
  })

  // 타일 탭이 한 층 내려가는 이동인데 바 기록을 안 남기면, ← 가 기록이 없으면 페이지는 그대로
  // 두고 그룹 행만 연다 는 안전망에 걸려 가계부가 활성인 채로 그룹 행만 열린다.
  //
  // 지금은 적을 기록이 없다. 이동 자체가 스택 한 단이라 되돌아갈 자리가 구조로 실재하고 그
  // 안전망도 함께 사라졌다.

  it('하위가 없는 그룹으로 보내면 그룹 층 안의 옆걸음이다. 층이 안 쌓인다', async () => {
    const view = await 격자()

    await act(async () => {
      fireEvent.press(within(타일(view, 'representative-character')).getByRole('button'))
    })

    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'Groups',
      params: { screen: 'Settings' },
    })
  })

  it('`target` 이 없는 타일은 누를 수 없다', async () => {
    const view = await 격자()

    expect(within(타일(view, 'reset-countdown')).queryByRole('button')).toBeNull()
  })
})
