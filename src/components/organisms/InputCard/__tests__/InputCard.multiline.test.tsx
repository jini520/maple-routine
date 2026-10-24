/**
 * 여러 줄 글자 카드. 메모처럼 긴 글을 받는 칸이다.
 *
 * 여기서 지키는 것은 **칸이 몇 줄 높이로 서는가**다. 세 줄로 열리고, 내용이 늘면 네 줄에서 멈춘다.
 * 상한이 없으면 길게 적을 때 카드가 키보드 위 공간을 넘어 화면 위로 나간다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { InputCard, type InputCardProps } from '../InputCard'

async function 그리기(props: Partial<InputCardProps> = {}) {
  const onConfirm = jest.fn()
  const view = await renderOverlay(
    <InputCard label="메모" value="" text onConfirm={onConfirm} onCancel={jest.fn()} {...props} />,
  )
  return { view, onConfirm }
}

type 화면 = Awaited<ReturnType<typeof renderOverlay>>

/** 값 칸의 높이와 줄 높이. 줄 수는 높이를 줄 높이로 나눈 것이다. */
function 칸치수(view: 화면): { height: number; lineHeight: number } {
  const style = flattenStyle(view.getByTestId('input-card-value').props.style)
  return { height: Number(style.height), lineHeight: Number(style.lineHeight) }
}

/** 네이티브가 내용 높이를 알리는 것을 흉내 낸다. `lines` 줄이 찬 높이다. */
async function 내용높이(view: 화면, lines: number): Promise<void> {
  const { lineHeight } = 칸치수(view)
  await act(async () => {
    fireEvent(view.getByTestId('input-card-value'), 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 280, height: lines * lineHeight } },
    })
  })
}

describe('여러 줄 글자 카드', () => {
  it('세 줄 높이로 열린다. 비어 있어도 여러 줄을 적는 칸으로 보인다', async () => {
    const { view } = await 그리기({ multiline: true })

    const { height, lineHeight } = 칸치수(view)
    expect(view.getByTestId('input-card-value').props.multiline).toBe(true)
    expect(height).toBe(3 * lineHeight)
  })

  it('내용이 늘면 네 줄까지 자라고, 그 뒤로는 안 자란다', async () => {
    const { view } = await 그리기({ multiline: true })

    await 내용높이(view, 4)
    const 네줄 = 칸치수(view)
    expect(네줄.height).toBe(4 * 네줄.lineHeight)

    await 내용높이(view, 9)
    const 아홉줄 = 칸치수(view)
    expect(아홉줄.height).toBe(4 * 아홉줄.lineHeight)
  })

  it('내용이 줄면 세 줄로 돌아온다. 세 줄 아래로는 안 줄어든다', async () => {
    const { view } = await 그리기({ multiline: true })

    await 내용높이(view, 6)
    await 내용높이(view, 1)

    const { height, lineHeight } = 칸치수(view)
    expect(height).toBe(3 * lineHeight)
  })

  it('줄바꿈이 든 글을 입력 버튼이 그대로 내보낸다', async () => {
    const { view, onConfirm } = await 그리기({ multiline: true })

    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '1시 집합\n3인 파티')
    })
    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-confirm'))
    })

    expect(onConfirm).toHaveBeenCalledWith('1시 집합\n3인 파티')
  })

  it('`multiline` 을 안 넘긴 글자 칸은 한 줄 그대로다. 내용 높이가 와도 안 자란다', async () => {
    const { view } = await 그리기()
    const 처음 = flattenStyle(view.getByTestId('input-card-value').props.style).height

    await act(async () => {
      fireEvent(view.getByTestId('input-card-value'), 'contentSizeChange', {
        nativeEvent: { contentSize: { width: 280, height: 200 } },
      })
    })

    expect(view.getByTestId('input-card-value').props.multiline).not.toBe(true)
    expect(flattenStyle(view.getByTestId('input-card-value').props.style).height).toBe(처음)
  })
})
