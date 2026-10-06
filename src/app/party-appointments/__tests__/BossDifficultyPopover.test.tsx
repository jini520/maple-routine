/** 난이도 캡슐. 초상 위아래 중 빈 공간이 넓은 쪽에 선다. */
import { fireEvent } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { BossDifficultyPopover } from '../BossDifficultyPopover'

const H = Dimensions.get('window').height
const SIZE = { x: 0, y: 0, width: 200, height: 36 }

async function 그리기(anchorTop: number) {
  const view = await renderOverlay(
    <BossDifficultyPopover
      bossKey="limbo"
      difficulty="hard"
      anchor={{ left: 100, top: anchorTop, width: 40, height: 40 }}
      onSelect={jest.fn()}
      onRemove={jest.fn()}
      onClose={jest.fn()}
    />,
  )
  await fireEvent(view.getByTestId('boss-difficulty-popover', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: SIZE },
  })
  return flattenStyle(view.getByTestId('boss-difficulty-popover').props.style)
}

describe('BossDifficultyPopover', () => {
  it('초상 위가 넓으면 위에 선다', async () => {
    const anchorTop = H - 200
    expect((await 그리기(anchorTop)).top).toBe(anchorTop - 10 - SIZE.height)
  })

  it('초상 아래가 넓으면 아래에 선다', async () => {
    expect((await 그리기(150)).top).toBe(150 + 40 + 10)
  })

  it('크기를 재기 전에는 안 보인다', async () => {
    const view = await renderOverlay(
      <BossDifficultyPopover
        bossKey="limbo"
        difficulty="hard"
        anchor={{ left: 100, top: 150, width: 40, height: 40 }}
        onSelect={jest.fn()}
        onRemove={jest.fn()}
        onClose={jest.fn()}
      />,
    )
    expect(
      flattenStyle(view.getByTestId('boss-difficulty-popover', { includeHiddenElements: true }).props.style).opacity,
    ).toBe(0)
  })
})
