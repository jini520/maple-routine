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

  it('OS 키보드가 받는 칸만 자동으로 초점을 받는다', async () => {
    // 그 카드는 열리는 순간부터 키보드 위에 서서 자리가 한 번도 안 움직인다.
    const { view } = await 그리기()

    await 재기(view, 들어가는_카드)

    expect(view.getByTestId('input-card-value').props.autoFocus).toBe(true)
  })

  it('판이 받는 칸은 초점을 안 받는다. 열자마자 아래가 덮이면 안 된다', async () => {
    const { view } = await 그리기()

    await 재기(view, 안_들어가는_카드)

    expect(view.getByTestId('input-card-value').props.autoFocus).toBe(false)
  })

  it('재기 전에도 초점을 안 준다. 판정이 나야 어느 쪽인지 안다', async () => {
    const { view } = await 그리기()

    expect(view.getByTestId('input-card-value').props.autoFocus).toBe(false)
  })

  it('글자 칸은 재기 전부터 초점을 받는다. 판정을 기다릴 것이 없다', async () => {
    const { view } = await 그리기({ text: true })

    expect(view.getByTestId('input-card-value').props.autoFocus).toBe(true)
  })

  it('글자 칸은 판을 안 쓴다. 한글 조합은 IME 가 해야 한다', async () => {
    const { view } = await 그리기({ text: true })

    await 재기(view, 안_들어가는_카드)
    await 값칸누르기(view)

    expect(view.queryByTestId('input-card-pad')).toBeNull()
    expect(view.getByTestId('input-card-value').props.showSoftInputOnFocus).toBe(true)
  })
})

describe('숫자 칸의 커서', () => {
  /**
   * 칸이 든 것은 숫자만이고 보이는 것은 콤마가 낀 글자다. 한 자마다 길이가 달라지므로 커서를
   * 글자 인덱스로 두면 어긋난다. **숫자 개수로 되짚어** 돌려놓는다.
   */
  it('가운데에 쳐도 친 자리에 들어간다', async () => {
    const { view } = await 그리기({ value: '1000000000' })
    const 칸 = view.getByTestId('input-card-value')

    // `1,000|,000,000` 에 커서를 두고
    await act(async () => {
      fireEvent(칸, 'selectionChange', { nativeEvent: { selection: { start: 5, end: 5 } } })
    })
    // `34` 를 친다. 칸이 내는 것은 그 자리에 끼워진 날 글자다.
    await act(async () => {
      fireEvent.changeText(칸, '1,00034,000,000')
    })

    expect(view.getByTestId('input-card-value').props.value).toBe('100,034,000,000')
    // 친 `34` 바로 뒤. 여섯째 숫자 뒤다.
    expect(view.getByTestId('input-card-value').props.selection).toEqual({ start: 7, end: 7 })
  })

  it('끝에 치면 끝에 선다', async () => {
    const { view } = await 그리기({ value: '1200' })
    const 칸 = view.getByTestId('input-card-value')

    await act(async () => {
      fireEvent(칸, 'selectionChange', { nativeEvent: { selection: { start: 5, end: 5 } } })
    })
    await act(async () => {
      fireEvent.changeText(칸, '1,2003')
    })

    expect(view.getByTestId('input-card-value').props.value).toBe('12,003')
    expect(view.getByTestId('input-card-value').props.selection).toEqual({ start: 6, end: 6 })
  })

  it('칩은 값을 더하는 것이라 커서가 끝으로 간다', async () => {
    const { view } = await 그리기({ value: '1000', chips: [{ label: '+1억', value: 100_000_000 }] })

    await act(async () => {
      fireEvent.press(view.getByText('+1억'))
    })

    expect(view.getByTestId('input-card-value').props.value).toBe('100,001,000')
    expect(view.getByTestId('input-card-value').props.selection).toEqual({ start: 11, end: 11 })
  })

  it('글자 칸은 커서를 안 붙든다. 이름은 가운데를 고칠 수 있어야 한다', async () => {
    const { view } = await 그리기({ text: true, value: '칠흑의 보스 반지' })

    expect(view.getByTestId('input-card-value').props.selection).toBeUndefined()
  })
})

describe('빈 숫자 칸의 자리표시자', () => {
  /**
   * 오른쪽 정렬 칸이 비어 있으면 안드로이드가 커서를 `hint` 의 **왼쪽**에 세운다(`|0 메소`).
   * 치면 값은 오른쪽으로 자라는데 커서는 왼쪽에 있어 어디에 들어가는지가 거꾸로 읽힌다.
   * 그래서 칸에는 `hint` 를 안 주고 우리가 커서 왼쪽에 덧그린다.
   */
  it('숫자 칸은 `hint` 를 안 쓰고 카드가 덧그린다', async () => {
    const { view } = await 그리기()

    expect(view.getByTestId('input-card-value').props.placeholder).toBeUndefined()
    expect(view.getByTestId('input-card-hint')).toHaveTextContent('0')
  })

  it('호출부가 준 글자를 그대로 쓴다', async () => {
    const { view } = await 그리기({ placeholder: '미입력 시 보관' })

    expect(view.getByTestId('input-card-hint')).toHaveTextContent('미입력 시 보관')
  })

  it('값이 들어오면 사라진다', async () => {
    const { view } = await 그리기({ value: '1200' })

    expect(view.queryByTestId('input-card-hint')).toBeNull()
  })

  it('글자 칸은 그대로 `hint` 를 쓴다. 왼쪽 정렬이라 커서가 이미 글자 앞이다', async () => {
    const { view } = await 그리기({ text: true, placeholder: '아이템 명' })

    expect(view.getByTestId('input-card-value').props.placeholder).toBe('아이템 명')
    expect(view.queryByTestId('input-card-hint')).toBeNull()
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

  it('판도 커서 자리에 끼운다. 칸과 같은 규칙이다', async () => {
    const { view } = await 판이_선_카드({ value: '1000000000' })

    // `1,000|,000,000`
    await act(async () => {
      fireEvent(view.getByTestId('input-card-value'), 'selectionChange', {
        nativeEvent: { selection: { start: 5, end: 5 } },
      })
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('7'))
    })

    expect(view.getByTestId('input-card-value').props.value).toBe('10,007,000,000')
  })

  it('판의 지우개도 커서 앞 한 자리를 지운다', async () => {
    const { view } = await 판이_선_카드({ value: '1234' })

    // `1,2|34`
    await act(async () => {
      fireEvent(view.getByTestId('input-card-value'), 'selectionChange', {
        nativeEvent: { selection: { start: 3, end: 3 } },
      })
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('한 자리 지우기'))
    })

    expect(view.getByTestId('input-card-value').props.value).toBe('134')
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
