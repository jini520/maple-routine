/**
 * 입력 카드가 OS 키보드 대신 앱이 그린 판으로 받는 경로.
 *
 * 판정은 **카드를 잰 뒤에** 난다(`onLayout`). 테스트 환경에는 레이아웃이 없어 실제로는 안 오므로
 * 여기서 손으로 흘려 보낸다. 잰 높이를 크게 주면 어떤 창에서도 판 쪽으로 판정되어, 창 크기를
 * 흉내 내지 않고도 그 경로를 돌릴 수 있다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { InputCard, type InputCardProps } from '../InputCard'

/** 어떤 창에서도 OS 키보드로는 안 들어가는 높이. */
const 안_들어가는_카드 = 2000

/** 어떤 창에서도 OS 키보드로 들어가는 높이. */
const 들어가는_카드 = 1

async function 그리기(props: Partial<InputCardProps> = {}) {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const view = await renderOverlay(
    <InputCard label="조각 가격" value="" onConfirm={onConfirm} onCancel={onCancel} {...props} />,
  )
  return { view, onConfirm, onCancel }
}

type 화면 = Awaited<ReturnType<typeof renderOverlay>>

/** 값 칸을 누른다. 판은 **눌러야** 올라온다(카드가 열릴 때는 안 뜬다). */
async function 값칸누르기(view: 화면): Promise<void> {
  await act(async () => {
    fireEvent(view.getByTestId('input-card-value'), 'pressIn')
  })
}

/** 카드를 잰 셈 친다. 이 값이 판정의 재료다. */
async function 재기(view: 화면, height: number): Promise<void> {
  await act(async () => {
    fireEvent(view.getByTestId('input-card-panel'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 336, height } },
    })
  })
}

describe('판으로 받는가', () => {
  it('재기 전에는 OS 키보드를 막는다. 모르면 판 쪽으로 기운다', async () => {
    // 여기서 키보드를 띄우면 카드가 밀려 올라가 값 칸과 판이 함께 화면 밖으로 나간다.
    const { view } = await 그리기()

    expect(view.queryByTestId('input-card-pad')).toBeNull()
    expect(view.getByTestId('input-card-value').props.showSoftInputOnFocus).toBe(false)
  })

  it('카드가 열릴 때는 판이 안 뜬다. 값 칸을 눌러야 올라온다', async () => {
    const { view } = await 그리기()

    await 재기(view, 안_들어가는_카드)
    expect(view.queryByTestId('input-card-pad')).toBeNull()

    await 값칸누르기(view)
    expect(view.getByTestId('input-card-pad')).toBeTruthy()
  })

  it('판이 서면 OS 키보드를 안 띄운다. 커서는 살아 있어야 해서 초점은 그대로다', async () => {
    const { view } = await 그리기()

    await 재기(view, 안_들어가는_카드)

    expect(view.getByTestId('input-card-value').props.showSoftInputOnFocus).toBe(false)
  })

  it('들어가면 판이 안 서고 OS 키보드를 다시 연다', async () => {
    const { view } = await 그리기()

    await 재기(view, 들어가는_카드)

    expect(view.queryByTestId('input-card-pad')).toBeNull()
    expect(view.getByTestId('input-card-value').props.showSoftInputOnFocus).toBe(true)
  })

  it('한 번 판으로 정해지면 창이 커져도 안 돌아간다', async () => {
    const { view } = await 그리기()

    await 재기(view, 안_들어가는_카드)
    await 재기(view, 들어가는_카드)
    await 값칸누르기(view)

    expect(view.getByTestId('input-card-pad')).toBeTruthy()
  })

  it('글자 칸은 판을 안 쓴다. 한글 조합은 IME 가 해야 한다', async () => {
    const { view } = await 그리기({ text: true })

    await 재기(view, 안_들어가는_카드)
    await 값칸누르기(view)

    expect(view.queryByTestId('input-card-pad')).toBeNull()
    expect(view.getByTestId('input-card-value').props.showSoftInputOnFocus).toBe(true)
  })
})

describe('판으로 친다', () => {
  async function 판이_선_카드(props: Partial<InputCardProps> = {}) {
    const 결과 = await 그리기(props)
    await 재기(결과.view, 안_들어가는_카드)
    await 값칸누르기(결과.view)
    return 결과
  }

  it('숫자를 누르면 값이 자란다. 콤마는 보이는 자리에서만 붙는다', async () => {
    const { view } = await 판이_선_카드()

    for (const 글자 of ['1', '2', '3', '4', '5', '6', '7']) {
      await act(async () => {
        fireEvent.press(view.getByLabelText(글자))
      })
    }

    expect(view.getByTestId('input-card-value').props.value).toBe('1,234,567')
  })

  it('지우개는 한 자리만 지운다', async () => {
    const { view } = await 판이_선_카드({ value: '1200' })

    await act(async () => {
      fireEvent.press(view.getByLabelText('한 자리 지우기'))
    })

    expect(view.getByTestId('input-card-value').props.value).toBe('120')
  })

  it('판의 확인은 판만 내린다. 카드는 값을 안 내보낸다', async () => {
    const { view, onConfirm } = await 판이_선_카드()

    await act(async () => {
      fireEvent.press(view.getByLabelText('확인'))
    })

    expect(view.queryByTestId('input-card-pad')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('판 바깥을 누르면 판이 내려간다. 카드는 안 닫힌다', async () => {
    const { view, onCancel } = await 판이_선_카드()

    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-scrim'))
    })

    expect(view.queryByTestId('input-card-pad')).toBeNull()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('내린 판은 값 칸을 다시 눌러 올린다', async () => {
    const { view } = await 판이_선_카드()

    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-scrim'))
    })
    await 값칸누르기(view)

    expect(view.getByTestId('input-card-pad')).toBeTruthy()
  })

  it('카드의 확인은 그대로 값을 내보낸다. 판과 하는 일이 다르다', async () => {
    const { view, onConfirm } = await 판이_선_카드({ value: '500' })

    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-confirm'))
    })

    expect(onConfirm).toHaveBeenCalledWith('500')
  })
})
