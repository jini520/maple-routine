import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { statsRanges } from '../../../features/stats/periods'
import { TrendSection } from '../TrendSection'

function 수입(dateKey: string, meso: number): unknown {
  return {
    kind: 'income',
    characterName: '',
    record: {
      id: `i-${dateKey}`, ocid: null, earnedOn: dateKey, category: 'etc', item: null, itemKey: null,
      mesoAmount: meso, pointAmount: null, pointPer100mMeso: null, cashAmount: null, quantity: null,
      itemKind: null, saleFeePercent: null, saleFeeMeso: null, saleFeeAuto: false, hunt: null, memo: null,
      recordedAt: dateKey,
    },
  }
}

function 지출(dateKey: string, meso: number): unknown {
  return {
    kind: 'spend',
    characterName: '',
    record: {
      id: `s-${dateKey}`, ocid: null, spentOn: dateKey, category: 'etc', item: null, itemKey: null,
      formItemKeys: null, itemKind: null, levelFrom: null, levelTo: null, quantity: null, mesoAmount: meso,
      tariffMeso: null, pointAmount: null, pointPer100mMeso: null, cashAmount: null, memo: null,
      recordedAt: dateKey,
    },
  }
}

const days = {
  '2026-09-18': [수입('2026-09-18', 100_000_000), 지출('2026-09-18', 300_000_000)],
  '2026-09-25': [수입('2026-09-25', 500_000_000), 지출('2026-09-25', 200_000_000)],
} as never

async function 그리기(): Promise<Awaited<ReturnType<typeof renderOverlay>>> {
  return renderOverlay(<TrendSection days={days} cycle="weekly" trend={statsRanges('weekly', '2026-09-24').trend} />)
}

async function 누르기(view: Awaited<ReturnType<typeof renderOverlay>>, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

beforeEach(() => {
  installNoopNativePorts()
})

describe('TrendSection', () => {
  it('처음에는 고른 기간이 골라져 있고 말풍선이 그 기간의 순수익과 수입 · 지출을 말한다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('stats-trend-bubble-title').props.children).toBe('9월 24일 주')
    expect(view.getByTestId('stats-trend-bubble-value').props.children).toBe('순수익 +3억')
    expect(view.getByTestId('stats-trend-bubble-sub').props.children).toBe('수입 5억 · 지출 2억')
  })

  it('막대를 누르면 그 기간의 값이 뜬다', async () => {
    const view = await 그리기()

    await 누르기(view, '9월 17일 주 보기')

    expect(view.getByTestId('stats-trend-bubble-title').props.children).toBe('9월 17일 주')
    expect(view.getByTestId('stats-trend-bubble-value').props.children).toBe('순수익 −2억')
  })

  it('지출만 보면 말풍선은 지출 하나다', async () => {
    const view = await 그리기()

    await 누르기(view, '지출')

    expect(view.getByTestId('stats-trend-bubble-value').props.children).toBe('지출 2억')
    expect(view.queryByTestId('stats-trend-bubble-sub')).toBeNull()
  })

  it('아래 줄은 구간 평균이다', async () => {
    const view = await 그리기()

    // 여덟 주의 순수익 합은 +1억이다.
    expect(view.getByTestId('stats-trend-average').props.children).toBe('8주 평균 순수익 +1,250만')
  })
})

describe('TrendSection 기간 바꾸기', () => {
  // 화면은 기간이 바뀌어도 섹션을 새로 만들지 않는다(다시 마운트하면 폭을 다시 재느라 두 번 그린다).
  // 그래서 고른 막대는 기간이 바뀌면 스스로 새 기간으로 돌아가야 한다.
  it('고른 막대는 기간이 바뀌면 새 기간으로 돌아간다', async () => {
    let setPeriod: ((periodKey: string) => void) | null = null
    function 하네스(): React.JSX.Element {
      const react = require('react') as typeof import('react')
      const [periodKey, set] = react.useState('2026-09-24')
      setPeriod = set
      return <TrendSection days={days} cycle="weekly" trend={statsRanges('weekly', periodKey).trend} />
    }
    const view = await renderOverlay(<하네스 />)
    await 누르기(view, '9월 10일 주 보기')
    expect(view.getByTestId('stats-trend-bubble-title').props.children).toBe('9월 10일 주')

    await act(async () => {
      setPeriod?.('2026-09-17')
    })

    expect(view.getByTestId('stats-trend-bubble-title').props.children).toBe('9월 17일 주')
  })
})
