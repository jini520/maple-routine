/**
 * 입력 카드. 시트의 칸 하나를 키보드 위에서 받는다.
 *
 * 여기서 지키는 것은 **값이 언제 나가고 언제 안 나가는가**다. 카드가 어디에 앉는지(키보드 높이를
 * 따라가는 것)는 `keyboard-offset` 의 훅이 지고 이 테스트는 안 본다.
 */
import { act, fireEvent } from '@testing-library/react-native'
import { Keyboard } from 'react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { InputCard, type InputCardProps } from '../InputCard'

const 메소칩 = [
  { label: '+1억', value: 100_000_000 },
  { label: '+100만', value: 1_000_000 },
] as const

async function 그리기(props: Partial<InputCardProps> = {}) {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const view = await renderOverlay(
    <InputCard
      label="조각 가격"
      value=""
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { view, onConfirm, onCancel }
}

type 화면 = Awaited<ReturnType<typeof renderOverlay>>

/** 상태가 한 번 흐른 뒤에 다음 줄을 읽게 한다. 안 감싸면 누르기가 옛 값을 들고 나간다. */
async function 치기(view: 화면, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('input-card-value'), text)
  })
}

async function 누르기(view: 화면, 대상: string): Promise<void> {
  await act(async () => {
    fireEvent.press(대상.startsWith('input-card-') ? view.getByTestId(대상) : view.getByText(대상))
  })
}

describe('InputCard', () => {
  it('칸 이름과 맥락 줄을 머리에 그린다', async () => {
    const { view } = await 그리기({ context: '솔 에르다 조각 · 개당' })

    expect(view.getByText('조각 가격')).toBeTruthy()
    expect(view.getByText('솔 에르다 조각 · 개당')).toBeTruthy()
  })

  it('시트가 든 지금 값을 씨앗으로 받는다', async () => {
    const { view } = await 그리기({ value: '12000000' })

    expect(view.getByTestId('input-card-value').props.value).toBe('12000000')
  })

  it('확인을 누르면 친 값이 나간다', async () => {
    const { view, onConfirm } = await 그리기({ value: '12000000' })

    await 치기(view, '34000000')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('34000000')
  })

  it('닫기를 누르면 값이 안 나가고 취소만 알린다', async () => {
    const { view, onConfirm, onCancel } = await 그리기({ value: '12000000' })

    await 치기(view, '34000000')
    await 누르기(view, 'input-card-close')

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })

  /**
   * 카드를 닫는 것은 ✕ 뿐이다(사용자 지정). 스크림은 판의 빈 자리와 같은 일을 해서 카드 안팎이
   * 한 규칙이다 — 키보드만 내리고 치던 값은 남는다.
   */
  it('스크림을 누르면 키보드만 내린다. 안 닫히고 치던 값도 남는다', async () => {
    const 내리기 = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined)
    const { view, onConfirm, onCancel } = await 그리기({ value: '12000000' })

    await 치기(view, '34000000')
    await 누르기(view, 'input-card-scrim')

    expect(내리기).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.getByTestId('input-card-value').props.value).toBe('34000000')
    내리기.mockRestore()
  })

  it('숫자 칸은 숫자만 남긴다', async () => {
    const { view, onConfirm } = await 그리기()

    await 치기(view, '1,200만')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('1200')
  })

  it('칩을 누르면 값이 그 눈금만큼 오른다', async () => {
    const { view, onConfirm } = await 그리기({ value: '1000000', chips: 메소칩 })

    await 누르기(view, '+1억')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('101000000')
  })

  it('빈 칸에서 칩을 누르면 그 눈금이 곧 값이다', async () => {
    const { view, onConfirm } = await 그리기({ chips: 메소칩 })

    await 누르기(view, '+100만')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('1000000')
  })

  it('읽기를 켜면 한국어 단위를 보조로 적는다', async () => {
    const { view } = await 그리기({ value: '12000000', reading: true })

    expect(view.getByTestId('input-card-reading')).toHaveTextContent('1200만')
  })

  it('읽기를 켜도 값이 비면 그 자리는 비운다', async () => {
    const { view } = await 그리기({ reading: true })

    expect(view.getByTestId('input-card-reading')).toHaveTextContent('')
  })

  it('글자 칸은 친 글자를 그대로 내고 칩이 없다', async () => {
    const { view, onConfirm } = await 그리기({ label: '내용', text: true, chips: 메소칩 })

    await 치기(view, '펜살리르 장갑')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('펜살리르 장갑')
    expect(view.queryByText('+1억')).toBeNull()
  })

  it('글자 칸은 글자판을 부른다. 숫자 칸은 숫자판이다', async () => {
    const { view: 글자 } = await 그리기({ text: true })
    expect(글자.getByTestId('input-card-value').props.keyboardType).toBeUndefined()

    const { view: 숫자 } = await 그리기()
    expect(숫자.getByTestId('input-card-value').props.keyboardType).toBe('number-pad')
  })

  it('필수 칸은 값이 차도 별표가 남는다', async () => {
    const { view } = await 그리기({ label: '시세 · 1억당', required: true, value: '1350' })

    expect(view.getByTestId('input-card-required')).toBeTruthy()
  })

  /**
   * 손에 익은 동작이다. 판이 누르개가 아니면 RN 은 터치가 닿은 가장 위 뷰에서 멈추고 뒤의
   * 스크림으로 흘려보내지 않아, 아무 일도 안 일어난다(사용자가 실기에서 물었다).
   */
  it('판의 빈 자리를 누르면 키보드만 내린다. 카드는 안 닫힌다', async () => {
    const 내리기 = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined)
    const { view, onConfirm, onCancel } = await 그리기({ value: '84' })

    await 누르기(view, 'input-card-panel')

    expect(내리기).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.getByTestId('input-card-value').props.value).toBe('84')
    내리기.mockRestore()
  })

  it('단위는 값 오른쪽에 선다', async () => {
    const { view } = await 그리기({ unit: '메소' })

    expect(view.getByText('메소')).toBeTruthy()
  })
})
