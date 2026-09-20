/**
 * 카드가 서는 자리(`InputCardHost`)와 껍데기.
 *
 * 여기서 지키는 것은 **여는 길과 닫는 길**이다. 카드가 키보드 높이를 따라가는지는 jest 가 못 본다
 * (키보드 이벤트도 레이아웃도 안 온다). 그것은 실기기에서 재고 고른다.
 */
import { act, fireEvent } from '@testing-library/react-native'
import { BackHandler } from 'react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { openInputCard, useInputCardStore } from '../../../../features/input-card/store'

// 카드가 서는 자리는 **하네스가 앱 셸처럼 세워 둔다**. 여기서 또 세우면 카드가 둘이 된다.
async function 열기(onConfirm = jest.fn(), overrides = {}) {
  const view = await renderOverlay(<></>)
  await act(async () => {
    openInputCard({ label: '조각 개수', value: '', onConfirm, ...overrides })
  })
  return { view, onConfirm }
}

describe('InputCardHost', () => {
  afterEach(() => {
    useInputCardStore.setState({ request: null })
  })

  it('부탁이 없으면 아무것도 안 그린다', async () => {
    const view = await renderOverlay(<></>)

    expect(view.queryByTestId('input-card')).toBeNull()
  })

  it('칸을 맡기면 카드가 선다', async () => {
    const { view } = await 열기()

    expect(view.getByTestId('input-card-layer')).toBeTruthy()
    expect(view.getByText('조각 개수')).toBeTruthy()
  })

  it('확인은 값을 넘기고 카드를 닫는다', async () => {
    const { view, onConfirm } = await 열기()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '84')
    })
    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-confirm'))
    })

    expect(onConfirm).toHaveBeenCalledWith('84')
    expect(view.queryByTestId('input-card')).toBeNull()
  })

  it('닫기는 값을 안 넘기고 카드를 닫는다', async () => {
    const { view, onConfirm } = await 열기()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '84')
    })
    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-close'))
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.queryByTestId('input-card')).toBeNull()
  })

  it('안드로이드 뒤로가기는 친 값을 버리고 거기서 끊는다', async () => {
    const 등록 = jest.spyOn(BackHandler, 'addEventListener')
    const { view, onConfirm } = await 열기()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '84')
    })
    const 뒤로 = 등록.mock.calls.at(-1)?.[1] as () => boolean
    let 끊었나 = false
    await act(async () => {
      끊었나 = 뒤로()
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.queryByTestId('input-card')).toBeNull()
    // 안 끊으면 카드와 시트가 함께 닫힌다.
    expect(끊었나).toBe(true)
    등록.mockRestore()
  })

  it('재는 방법을 바꿔도 카드는 같은 것을 그린다', async () => {
    const { view } = await 열기(jest.fn(), { tracking: 'reanimated', value: '84', unit: '개' })

    expect(view.getByTestId('input-card-value').props.value).toBe('84')
    expect(view.getByText('개')).toBeTruthy()
  })
})
