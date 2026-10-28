// 글자 크기 페이지의 네 칸 슬라이더. 칸 하나가 단계 하나다.
import { act, fireEvent } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

jest.mock('../../../native/haptics', () => ({ selectionFeedback: jest.fn() }))
const { selectionFeedback } = jest.requireMock('../../../native/haptics') as { selectionFeedback: jest.Mock }

import { renderAtom } from '../../../components/__tests__/render-atom'
import { TEXT_SIZE_LABELS } from '../../../lib/text-size'
import type { TextSize } from '../../../types/text-size'
import { TextSizeSlider } from '../TextSizeSlider'

type Rendered = Awaited<ReturnType<typeof renderAtom>>

async function 그리기(value: TextSize): Promise<{ view: Rendered; onChange: jest.Mock }> {
  const onChange = jest.fn()
  const view = await renderAtom(<TextSizeSlider value={value} onChange={onChange} />)
  return { view, onChange }
}

async function 조절(view: Rendered, actionName: 'increment' | 'decrement'): Promise<void> {
  await act(async () => {
    fireEvent(view.getByLabelText('글자 크기'), 'accessibilityAction', { nativeEvent: { actionName } })
  })
}

beforeEach(() => {
  selectionFeedback.mockReset()
})

describe('TextSizeSlider', () => {
  it('단계 이름을 누르면 그 단계를 주고 촉각을 한 번 낸다', async () => {
    const { view, onChange } = await 그리기('default')

    await act(async () => {
      fireEvent.press(view.getByLabelText(TEXT_SIZE_LABELS.xlarge))
    })

    expect(onChange.mock.calls).toEqual([['xlarge']])
    expect(selectionFeedback).toHaveBeenCalledTimes(1)
  })

  it('고른 단계를 다시 누르면 부르지 않는다', async () => {
    const { view, onChange } = await 그리기('default')

    await act(async () => {
      fireEvent.press(view.getByLabelText(TEXT_SIZE_LABELS.default))
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(selectionFeedback).not.toHaveBeenCalled()
  })

  it('끌면 칸을 지날 때마다 그 단계를 준다', async () => {
    const { view, onChange } = await 그리기('default')
    await act(async () => {
      fireEvent(view.getByTestId('text-size-track'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 48 } },
      })
    })

    // 폭 400 · 네 칸이면 한 칸이 100 이다. 150 은 기본, 250 은 크게, 350 은 아주 크게다.
    await act(async () => {
      fireGestureHandler(getByGestureTestId('text-size-pan'), [
        { state: State.BEGAN, x: 150, translationX: 0 },
        { state: State.ACTIVE, x: 250, translationX: 100 },
        { state: State.ACTIVE, x: 350, translationX: 200 },
        { state: State.END, x: 350, translationX: 200 },
      ])
    })

    expect(onChange.mock.calls).toEqual([['large'], ['xlarge']])
  })

  it('낭독기로 한 단계씩 옮기고, 끝에서는 더 가지 않는다', async () => {
    const { view, onChange } = await 그리기('small')

    await 조절(view, 'decrement')
    await 조절(view, 'increment')

    expect(onChange.mock.calls).toEqual([['default']])
  })
})
