import { act, fireEvent } from '@testing-library/react-native'
import { processColor } from 'react-native'

import { renderOverlay, 기본테마 } from '../../../components/__tests__/render-atom'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { CumulativeSection } from '../CumulativeSection'

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

const days = {
  '2026-09-05': [수입('2026-09-05', 100_000_000)],
  '2026-09-18': [수입('2026-09-18', 200_000_000)],
  '2026-09-25': [수입('2026-09-25', 300_000_000)],
  '2026-10-02': [수입('2026-10-02', 999_000_000)],
} as never

beforeEach(() => {
  installNoopNativePorts()
})

describe('CumulativeSection', () => {
  it('처음 기록부터 고른 기간까지 더한 값이 크게 서고 시작일을 적는다', async () => {
    const view = await renderOverlay(<CumulativeSection days={days} cycle="weekly" periodKey="2026-09-24" />)

    expect(view.getByTestId('stats-cumulative-total').props.children.join('')).toContain('+6억')
    expect(view.getByText('9월 3일부터')).toBeTruthy()
  })

  it('기간을 누르면 그 기간까지의 누적이 뜬다', async () => {
    const view = await renderOverlay(<CumulativeSection days={days} cycle="weekly" periodKey="2026-09-24" />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('9월 17일 주까지 보기'))
    })

    expect(view.getByTestId('stats-cumulative-bubble-title').props.children).toBe('9월 17일 주까지')
    expect(view.getByTestId('stats-cumulative-bubble-value').props.children).toBe('+3억')
  })
})

describe('CumulativeSection 선 색', () => {
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

  // 0 선 위는 빨강, 아래는 파랑이다. 누적이 음수로 내려간 구간이 파랑으로 보여야 한다.
  it('0 선 위는 수익 색, 아래는 지출 색으로 나눠 그린다', async () => {
    const view = await renderOverlay(
      <CumulativeSection
        days={{ '2026-09-05': [지출('2026-09-05', 300_000_000)], '2026-09-25': [수입('2026-09-25', 500_000_000)] } as never}
        cycle="weekly"
        periodKey="2026-09-24"
      />,
    )

    expect(view.getByTestId('stats-cumulative-line-above').props.stroke.payload).toBe(processColor(기본테마.riseInk))
    expect(view.getByTestId('stats-cumulative-line-below').props.stroke.payload).toBe(processColor(기본테마.fallInk))
  })
})
