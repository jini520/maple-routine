// 이번 주 수익. 값은 뷰모델이 통계와 같은 함수로 세어 오므로, 이 파일은 위젯이 고르는 것을 본다.
// 세그먼트에 따라 큰 숫자 · 순위가 바뀌는지, 캐릭터 줄을 누르면 그 캐릭터의 갈래가 뜨는지다.

import { act, fireEvent, within } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { renderAtom, 테스트_안전영역 } from '../../../../components/__tests__/render-atom'
import { WeeklyIncomeWidget } from '../WeeklyIncomeWidget'
import { 뷰모델, 이번주수익, 수익캐릭터셋 } from './widget-fixture'

type Rendered = Awaited<ReturnType<typeof renderAtom>>

async function 위젯(weeklyIncome = 이번주수익(수익캐릭터셋())): Promise<Rendered> {
  // 팝오버가 안전영역을 읽는다.
  return renderAtom(
    <SafeAreaProvider initialMetrics={테스트_안전영역}>
      <WeeklyIncomeWidget data={뷰모델({ weeklyIncome })} />
    </SafeAreaProvider>,
  )
}

function 순위(view: Rendered): string[] {
  return view.queryAllByTestId('weekly-income-rank-name').map((node) => String(node.props.children))
}

async function 고르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(within(view.getByTestId('segment')).getByLabelText(label))
  })
}

describe('세그먼트', () => {
  it('처음은 순 수익이고, 큰 숫자와 순위가 순 수익 기준이다', async () => {
    const view = await 위젯()

    expect(view.getByTestId('weekly-income-total').props.children).toBe('+14억')
    expect(순위(view)).toEqual(['가', '나', '다'])
  })

  it('수익을 고르면 수익 합계와 수익 순위로 바뀐다', async () => {
    const view = await 위젯()
    await 고르기(view, '수익')

    expect(view.getByTestId('weekly-income-total').props.children).toBe('+21억')
    expect(순위(view)).toEqual(['가', '다', '나'])
  })

  // 지출이 없는 캐릭터를 0 으로 순위에 세우면 지출이 없다 가 아니라 꼴찌 로 읽힌다.
  it('지출을 고르면 지출 순위이고, 지출이 없는 캐릭터는 순위에 없다', async () => {
    const view = await 위젯()
    await 고르기(view, '지출')

    expect(view.getByTestId('weekly-income-total').props.children).toBe('−7억')
    expect(순위(view)).toEqual(['다', '가'])
  })
})

describe('캐릭터 줄의 팝오버', () => {
  it('순 수익에서는 그 캐릭터의 수익 갈래와 지출 갈래를 함께 띄운다', async () => {
    const view = await 위젯()

    await act(async () => {
      fireEvent.press(view.getAllByTestId('weekly-income-rank')[0])
    })

    const popover = view.getByTestId('weekly-income-popover')
    expect(within(popover).getByText('보스 결정석')).toBeTruthy()
    expect(within(popover).getByText('사냥')).toBeTruthy()
    expect(within(popover).getByText('스타포스')).toBeTruthy()
  })

  it('수익에서는 수익 갈래만 띄운다', async () => {
    const view = await 위젯()
    await 고르기(view, '수익')

    await act(async () => {
      fireEvent.press(view.getAllByTestId('weekly-income-rank')[0])
    })

    const popover = view.getByTestId('weekly-income-popover')
    expect(within(popover).getByText('보스 결정석')).toBeTruthy()
    expect(within(popover).queryByText('스타포스')).toBeNull()
  })
})

describe('기록이 없을 때', () => {
  // 읽기 전의 0 을 그리면 이번 주에 번 것이 없다 고 단정하게 된다.
  it('읽는 중이면 큰 숫자를 그리지 않는다', async () => {
    const view = await 위젯({ ...이번주수익([]), loading: true })

    expect(view.queryByTestId('weekly-income-total')).toBeNull()
    expect(view.queryByTestId('weekly-income-empty')).toBeNull()
  })

  it('이번 주 기록이 없으면 그 사실을 적고 순위가 없다', async () => {
    const view = await 위젯(이번주수익([]))

    expect(view.getByTestId('weekly-income-empty')).toBeTruthy()
    expect(순위(view)).toEqual([])
  })
})
