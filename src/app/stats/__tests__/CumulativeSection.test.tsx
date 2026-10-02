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
    const view = await renderOverlay(<CumulativeSection days={days} cycle="weekly" periodKey="2026-09-24" startDateKey={null} earliest="2025-03-27" latest="2026-09-29" onChangeStart={jest.fn()} />)

    expect(view.getByTestId('stats-cumulative-total').props.children.join('')).toContain('+6억')
    expect(view.getByTestId('stats-cumulative-start').props.children).toBe('9월 5일 (토)')
  })

  it('처음에는 아무 점도 안 골라 말풍선이 없다', async () => {
    const view = await renderOverlay(<CumulativeSection days={days} cycle="weekly" periodKey="2026-09-24" startDateKey={null} earliest="2025-03-27" latest="2026-09-29" onChangeStart={jest.fn()} />)

    expect(view.queryByTestId('stats-cumulative-bubble-title')).toBeNull()
  })

  it('기간을 누르면 그 기간까지의 누적이 뜨고, 다시 누르면 닫힌다', async () => {
    const view = await renderOverlay(<CumulativeSection days={days} cycle="weekly" periodKey="2026-09-24" startDateKey={null} earliest="2025-03-27" latest="2026-09-29" onChangeStart={jest.fn()} />)
    const 누르기 = async (): Promise<void> => {
      await act(async () => {
        fireEvent.press(view.getByLabelText('9월 17일 주까지 보기'))
      })
    }

    await 누르기()

    expect(view.getByTestId('stats-cumulative-bubble-title').props.children).toBe('9월 17일 주까지')
    expect(view.getByTestId('stats-cumulative-bubble-value').props.children).toBe('+3억')

    await 누르기()

    expect(view.queryByTestId('stats-cumulative-bubble-title')).toBeNull()
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
        startDateKey={null}
        earliest="2025-03-27"
        latest="2026-09-29"
        onChangeStart={jest.fn()}
      />,
    )

    expect(view.getByTestId('stats-cumulative-line-above').props.stroke.payload).toBe(processColor(기본테마.riseInk))
    expect(view.getByTestId('stats-cumulative-line-below').props.stroke.payload).toBe(processColor(기본테마.fallInk))
  })
})

describe('CumulativeSection 시작 날짜', () => {
  it('고른 날부터 더하고 그 날짜를 알약에 적는다', async () => {
    const view = await renderOverlay(
      <CumulativeSection days={days} cycle="weekly" periodKey="2026-09-24" startDateKey="2026-09-18" earliest="2025-03-27" latest="2026-09-29" onChangeStart={jest.fn()} />,
    )

    expect(view.getByTestId('stats-cumulative-total').props.children.join('')).toContain('+5억')
    expect(view.getByTestId('stats-cumulative-start').props.children).toBe('9월 18일 (금)')
  })

  it('고른 적이 없으면 기록이 처음 있는 날이 알약에 선다', async () => {
    const view = await renderOverlay(
      <CumulativeSection days={days} cycle="weekly" periodKey="2026-09-24" startDateKey={null} earliest="2025-03-27" latest="2026-09-29" onChangeStart={jest.fn()} />,
    )

    expect(view.getByTestId('stats-cumulative-start').props.children).toBe('9월 5일 (토)')
  })
})
