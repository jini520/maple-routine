// today 의 MASPI 한 줄 위젯. 종가와 전일 대비 화살표를 적고, 값이 없어도 위젯이 사라지지 않는다.
import { renderOverlay } from '../../../../components/__tests__/render-atom'
import { MaspiWidget } from '../MaspiWidget'
import { 뷰모델 } from './widget-fixture'

const 날마다 = (values: number[]) => values.map((value, index) => ({ date: `2026-11-${String(index + 1).padStart(2, '0')}`, value }))

describe('MaspiWidget', () => {
  it('종가와 전일 대비를 화살표로 적는다. 내리면 ▼, 오르면 ▲ 다', async () => {
    const 내림 = await renderOverlay(
      <MaspiWidget data={뷰모델({ maspi: { date: '2026-11-14', close: 9082.3, change: -24.82, series: 날마다([9200, 9082.3]) } })} />,
    )
    expect(내림.getByTestId('widget-maspi-close')).toHaveTextContent('9,082.30')
    expect(내림.getByTestId('widget-maspi-change')).toHaveTextContent('▼ 24.82')

    const 오름 = await renderOverlay(
      <MaspiWidget data={뷰모델({ maspi: { date: '2026-11-15', close: 9119, change: 36.7, series: 날마다([9082.3, 9119]) } })} />,
    )
    expect(오름.getByTestId('widget-maspi-change')).toHaveTextContent('▲ 36.70')
  })

  it('전일과 같으면 화살표 없이 0.00 이고, 남긴 값도 받은 값도 없으면 종가와 등락이 모두 0.00 이다', async () => {
    const 같음 = await renderOverlay(
      <MaspiWidget data={뷰모델({ maspi: { date: '2026-11-15', close: 9119, change: 0, series: 날마다([9119, 9119]) } })} />,
    )
    expect(같음.getByTestId('widget-maspi-change')).toHaveTextContent(/^0\.00$/)

    const 없음 = await renderOverlay(<MaspiWidget data={뷰모델({ maspi: null })} />)
    expect(없음.getByTestId('widget-maspi-close')).toHaveTextContent('0.00')
    expect(없음.getByTestId('widget-maspi-change')).toHaveTextContent(/^0\.00$/)
  })
})
