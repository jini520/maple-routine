/**
 * 바닥 줄의 주 버튼. 시트 아래 곡률에 맞춘 알약이고, 시트가 정한 간격만큼 좌우를 들여쓴다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { SheetActionButton } from '../SheetActionButton'
import { SheetFooterInset } from '../sheet-footer-inset'

async function 그리기(props: Partial<React.ComponentProps<typeof SheetActionButton>> = {}, gap = 16) {
  return await renderOverlay(
    <SheetFooterInset.Provider value={gap}>
      <SheetActionButton label="저장" onPress={jest.fn()} {...props} />
    </SheetFooterInset.Provider>,
  )
}

describe('SheetActionButton', () => {
  it('높이 52 의 연속 곡률 알약이다', async () => {
    const view = await 그리기()
    const 상자 = flattenStyle(view.getByRole('button', { name: '저장' }).props.style)

    expect(상자.height).toBe(52)
    expect(상자.borderRadius).toBe(26)
    expect(상자.borderCurve).toBe('continuous')
  })

  it('시트가 정한 버튼 간격에서 바닥 줄 여백 16 을 뺀 만큼 좌우를 들여쓴다', async () => {
    const view = await 그리기({}, 28)

    expect(flattenStyle(view.getByRole('button', { name: '저장' }).props.style).marginHorizontal).toBe(12)
  })

  it('못 누르는 버튼은 누름을 넘기지 않는다', async () => {
    const onPress = jest.fn()
    const view = await 그리기({ onPress, disabled: true })

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '저장' }))
    })

    expect(onPress).not.toHaveBeenCalled()
  })
})
