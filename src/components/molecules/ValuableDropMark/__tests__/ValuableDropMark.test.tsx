/**
 * 고가 드롭 표시. 그림은 셋까지이고 `+N` 은 그림으로 못 보인 나머지 개수다(사용자 지정).
 */
import type { RecordedDrop } from '../../../../types/drops'

import { renderAtom } from '../../../__tests__/render-atom'
import { ValuableDropMark } from '../ValuableDropMark'

function drops(...itemKeys: string[]): RecordedDrop[] {
  return itemKeys.map((itemKey) => ({ itemKey, itemName: itemKey }) as RecordedDrop)
}

describe('ValuableDropMark', () => {
  it('그림은 셋까지 그리고 나머지 개수를 +N 으로 적는다', async () => {
    const { getAllByTestId, getAllByText } = await renderAtom(
      <ValuableDropMark drops={drops('a', 'b', 'c', 'd', 'e')} label="고가 드롭" />,
    )

    expect(getAllByTestId('valuable-drop-icon')).toHaveLength(3)
    // 오로라 글자는 마스크와 크기용으로 두 벌 그린다.
    expect(getAllByText('+2').length).toBeGreaterThan(0)
  })

  it('셋 이하면 +N 을 적지 않는다', async () => {
    const { getAllByTestId, queryByText } = await renderAtom(
      <ValuableDropMark drops={drops('a', 'b', 'c')} label="고가 드롭" />,
    )

    expect(getAllByTestId('valuable-drop-icon')).toHaveLength(3)
    expect(queryByText(/^\+/)).toBeNull()
  })
})
