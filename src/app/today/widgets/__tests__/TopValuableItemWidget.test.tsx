// 최고가 아이템 위젯. 이 파일이 지키는 것 둘.
// ① **미입력 건수를 여기서 말하지 않는다**(옆 타일이 든다. 건수를 두 곳에서 말하지 않는다)
// ② **0건 문구는 한 줄뿐**(**N건이 값을 기다립니다** 를 만들지 않는다)

import { renderAtom } from '../../../../components/__tests__/render-atom'
import { TopValuableItemWidget } from '../TopValuableItemWidget'
import { 뷰모델, 드롭, 빈_뷰모델 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'

const 있음 = 뷰모델({ topItem: 드롭() })

async function 위젯(data: TodayViewModel = 있음): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<TopValuableItemWidget data={data} />)
}

describe('금액', () => {
  it('분배 후 금액을 `메소` 단위와 함께 그린다', async () => {
    const { getByTestId } = await 위젯()

    expect(getByTestId('top-item-amount')).toHaveTextContent('120.0억 메소')
  })
})

describe('0건', () => {
  it('한 줄로 그 사실만 말한다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(빈_뷰모델)

    expect(getByTestId('top-item-empty')).toHaveTextContent('가격이 입력된 아이템이 없습니다')
    expect(queryByTestId('top-item-amount')).toBeNull()
  })

  it('미입력 건수가 있어도 이 타일은 그것을 말하지 않는다', async () => {
    const view = await 위젯(뷰모델({ topItem: null, unpricedCount: 7 }))

    expect(view.queryByText(/7/)).toBeNull()
  })
})

describe('아이콘', () => {
  it('key 가 표에 있으면 번들 에셋을 그린다', async () => {
    const { getByTestId, queryByTestId } = await 위젯()

    expect(getByTestId('top-item-icon')).toBeTruthy()
    expect(queryByTestId('top-item-icon-fallback')).toBeNull()
  })

  // 다른 아이템 그림을 대신 세우면 **이 아이템** 으로 읽힌다. 빈 칸이 폴백이다.
  it('key 가 없으면 빈 칸이 선다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(
      뷰모델({ topItem: 드롭({ itemKey: null, itemName: '없는아이템' }) }),
    )

    expect(getByTestId('top-item-icon-fallback')).toBeTruthy()
    expect(queryByTestId('top-item-icon')).toBeNull()
  })
})
