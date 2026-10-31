// 격자 **껍데기**. 위젯 내용은 각자의 테스트가 보므로 이 파일이
// 묻는 것은 둘이다. **타일이 적어 둔 줄 · 칸에 서는가**, **같은 줄의 타일이 한 높이로 늘어나는가**.
//
// 폭은 `resolveWidgetGridMetrics` 에서 읽는다. 대신 **칸 산식은 테스트가 직접 편다**(`w × 열폭 +
// (w − 1) × 간격`). 그 산식이 곧 이 컴포넌트가 지켜야 할 계약이라, 컴포넌트가 부르는 함수를 테스트도
// 부르면 아무것도 안 묻게 된다.

import { act, fireEvent, within } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { renderAtom, flattenStyle, type AtomElement } from '../../../components/__tests__/render-atom'
import { resolveWidgetGridMetrics } from '../../../lib/today/widget-grid-metrics'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { 빈_뷰모델 } from '../widgets/__tests__/widget-fixture'
import { WidgetGrid } from '../WidgetGrid'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

const navigate = jest.fn()
// 층이 스택이 된 뒤로 **그룹 층으로 되돌리기** 는 액션이다. 화면이 이것도 부른다.
const dispatch = jest.fn()
const mockedUseScreenNavigation = jest.mocked(useScreenNavigation)

type Rendered = Awaited<ReturnType<typeof renderAtom>>

const metrics = resolveWidgetGridMetrics(Dimensions.get('window').width)
const 칸폭 = (w: number): number => w * metrics.colWidthPx + (w - 1) * metrics.gapPx

async function 격자(data = 빈_뷰모델): Promise<Rendered> {
  return renderAtom(<WidgetGrid data={data} />)
}

function 스타일(element: AtomElement): Record<string, unknown> {
  return flattenStyle(element.props.style)
}

function 줄의_타일(view: Rendered, row: number): string[] {
  return within(view.getByTestId(`widget-row-${row}`))
    .getAllByTestId(/^widget-tile-/)
    .map((tile) => String(tile.props.testID).replace('widget-tile-', ''))
}

beforeEach(() => {
  // 층 스택이 없는 가짜다. `useOpenTab` 이 그 깊이를 물어 `popToTop` 을 헛치지 않는다.
  mockedUseScreenNavigation.mockReturnValue({ navigate, dispatch, getParent: () => undefined } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('WidgetGrid: 줄과 칸', () => {
  it('타일이 적어 둔 줄에 칸 순서대로 선다', async () => {
    const view = await 격자()

    expect(줄의_타일(view, 0)).toEqual(['representative-character'])
    expect(줄의_타일(view, 1)).toEqual(['quick-links'])
    expect(줄의_타일(view, 2)).toEqual(['reset-countdown', 'crystal-limit'])
    expect(줄의_타일(view, 3)).toEqual(['shared-contents'])
    expect(줄의_타일(view, 4)).toEqual(['remaining-schedule'])
    expect(줄의_타일(view, 5)).toEqual(['weekly-income'])
    expect(줄의_타일(view, 6)).toEqual(['top-valuable-item', 'unpriced-drops'])
    // 픽스처에는 파티 회차가 없어 다음 파티 스케줄이 맨 아래 줄에 선다.
    expect(줄의_타일(view, 7)).toEqual(['next-party-schedule'])
  })

  // 가로를 다 쓰는 타일의 폭은 **창폭 − 좌우 여백** 이다. 2칸 둘은 사이에 간격 하나를 두고 줄을 나눠 쓴다.
  it('타일 폭은 칸 수로 정하고, 칸 사이 간격만큼 띄운다', async () => {
    const view = await 격자()

    expect(스타일(view.getByTestId('widget-tile-representative-character'))).toMatchObject({ width: 칸폭(4) })
    expect(스타일(view.getByTestId('widget-tile-reset-countdown'))).toMatchObject({ width: 칸폭(2), marginLeft: 0 })
    expect(스타일(view.getByTestId('widget-tile-crystal-limit'))).toMatchObject({
      width: 칸폭(2),
      marginLeft: metrics.gapPx,
    })
  })

  // 높이는 내용이 정한다. 같은 줄의 두 카드는 줄이 가장 높은 타일에 맞춰 늘리고 카드가 그 높이를 채워야,
  // 나란히 놓인 카드의 아래 끝이 맞는다.
  it('같은 줄의 타일은 줄 높이로 늘어나고 카드가 그 높이를 채운다', async () => {
    const view = await 격자()

    expect(스타일(view.getByTestId('widget-row-2'))).toMatchObject({ flexDirection: 'row', alignItems: 'stretch' })
    for (const id of ['reset-countdown', 'crystal-limit']) {
      expect(스타일(view.getByTestId(`widget-card-${id}`))).toMatchObject({ flexGrow: 1 })
    }
  })
})

// 다음 파티 스케줄은 보여 줄 회차가 없으면 맨 아래 줄로 내려가고, 그 줄만큼 아래가 올라온다.
describe('다음 파티 스케줄 타일', () => {
  const 회차 = {
    appointmentId: 'p1',
    dateKey: '2099-01-01',
    timeKst: '21:00',
    endClock: '22:00',
    startsAtMs: Date.parse('2099-01-01T12:00:00Z'),
    endsAtMs: Date.parse('2099-01-01T13:00:00Z'),
    groups: [{ ocid: 'a', name: '낟낟', imageUrl: null, bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'a' }] }],
    leadMinutes: 30,
    repeats: false,
  }

  it('회차가 없으면 맨 아래 줄로 가고 공유 컨텐츠가 그 줄에 선다', async () => {
    const view = await 격자()

    expect(줄의_타일(view, 3)).toEqual(['shared-contents'])
    expect(줄의_타일(view, 7)).toEqual(['next-party-schedule'])
  })

  it('회차가 있으면 초기화까지 아래 줄에 서고 그 아래가 한 줄 내려간다', async () => {
    const view = await 격자({ ...빈_뷰모델, nextParty: [회차] })

    expect(줄의_타일(view, 3)).toEqual(['next-party-schedule'])
    expect(줄의_타일(view, 4)).toEqual(['shared-contents'])
  })
})

describe('타일 탭', () => {
  it('결정석 한도는 보스 수익으로 보낸다', async () => {
    const view = await 격자()

    await act(async () => {
      fireEvent.press(within(view.getByTestId('widget-tile-crystal-limit')).getByRole('button'))
    })

    // **한 층 내려가는 이동이다**. 보스 수익은 수익·지출 그룹의 하위라 그 층 화면을 연다.
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'LedgerSubs',
      params: { screen: 'Profit' },
    })
  })

  // 두 타일이 가리키는 것이 값을 매길 드롭이다. 이번 주로 열리는 것은 기간을 넘기지 않아서다.
  // 가격 입력 화면이 넘긴 값이 없으면 열리는 순간의 이번 주를 센다(`DropPriceScreen.test.tsx`).
  it.each(['top-valuable-item', 'unpriced-drops'])(
    '%s 타일은 기간을 넘기지 않고 아이템 가격 입력을 push 한다',
    async (id) => {
      const view = await 격자()

      await act(async () => {
        fireEvent.press(within(view.getByTestId(`widget-tile-${id}`)).getAllByRole('button')[0])
      })

      expect(navigate).toHaveBeenCalledTimes(1)
      expect(navigate).toHaveBeenCalledWith('DropPrice')
    },
  )

  // 갈 데가 없는 것을 누를 수 있게 두면 무반응이 고장으로 읽힌다.
  it.each(['reset-countdown', 'representative-character'])('`target` 이 없는 %s 타일은 누를 수 없다', async (id) => {
    const view = await 격자()

    expect(within(view.getByTestId(`widget-tile-${id}`)).queryByRole('button')).toBeNull()
  })
})
