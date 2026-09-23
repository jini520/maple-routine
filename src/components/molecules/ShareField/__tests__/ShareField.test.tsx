// 분배 비율 고르개. 슬라이더가 내 비율이고 스테퍼가 합이다.
//
// 여기서 특히 중요한 것은 **합을 줄일 때 내 비율이 따라 내려가는가** 다. 안 맞추면 내 비율이
// 합보다 커져 내 몫이 100%를 넘는다.
import { fireEvent, within } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { ShareField } from '../ShareField'

describe('ShareField', () => {
  it('내 비율과 나머지를 적는다', async () => {
    const { getByTestId } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} />,
    )

    expect(getByTestId('share-field-ratio-결정석')).toHaveTextContent('66.7%')
  })

  it('칸을 누르면 내 비율이 그 칸으로 온다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 1, sharesTotal: 3 }} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText('결정석 비율 3'))

    expect(onChange).toHaveBeenCalledWith({ myShare: 3, sharesTotal: 3 })
  })

  // 결정석을 다 넘기고 아이템만 갖는 약속이 있다. 0 이 없으면 그 파티는 값을 못 적는다.
  it('0 까지 내려간다. 이 몫을 하나도 안 갖는 약속이다', async () => {
    const onChange = jest.fn()
    const { getByLabelText, getByTestId } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 1, sharesTotal: 3 }} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText('결정석 비율 0'))

    expect(onChange).toHaveBeenCalledWith({ myShare: 0, sharesTotal: 3 })
    expect(getByTestId('share-field-ratio-결정석')).toHaveTextContent('33.3%')
  })

  it('0 이면 0% 로 적는다', async () => {
    const { getByTestId } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 0, sharesTotal: 3 }} onChange={jest.fn()} />,
    )

    expect(getByTestId('share-field-ratio-결정석')).toHaveTextContent('0%')
  })

  it('같은 칸을 다시 누르면 알리지 않는다. 안 바뀐 값이다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 2, sharesTotal: 3 }} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText('결정석 비율 2'))

    expect(onChange).not.toHaveBeenCalled()
  })

  // 합은 슬라이더 오른쪽 세로 스테퍼다. 아래 줄로 내리면 고르개 하나가 두 줄을 먹는다.
  it('합을 늘리면 내 비율은 그대로다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <ShareField label="드롭" value={{ myShare: 2, sharesTotal: 3 }} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText('드롭 비율 합 증가'))

    expect(onChange).toHaveBeenCalledWith({ myShare: 2, sharesTotal: 4 })
  })

  // 안 맞추면 내 몫이 100%를 넘는다.
  it('합을 내 비율 아래로 줄이면 내 비율이 따라 내려간다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <ShareField label="드롭" value={{ myShare: 3, sharesTotal: 3 }} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText('드롭 비율 합 감소'))

    expect(onChange).toHaveBeenCalledWith({ myShare: 2, sharesTotal: 2 })
  })

  it('합이 2 면 더 못 줄인다. 혼자면 나눌 것이 없다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <ShareField label="드롭" value={{ myShare: 1, sharesTotal: 2 }} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText('드롭 비율 합 감소'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('합을 슬라이더와 같은 줄에서 읽는다', async () => {
    const { getByTestId } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} />,
    )

    expect(getByTestId('share-field-total-결정석')).toHaveTextContent('3')
  })

  // 드롭 가격 카드는 판의 반쪽이다. 합을 머리 줄로 올려야 트랙이 아래 한 줄을 다 쓴다(사용자 지정).
  it('head 는 합을 머리 줄에 두고 트랙이 아래 한 줄을 다 쓴다', async () => {
    const { getByTestId } = await renderAtom(
      <ShareField label="분배 비율" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} layout="head" />,
    )

    const 머리 = within(getByTestId('share-field-head'))
    expect(머리.getByTestId('share-field-ratio-분배 비율')).toBeTruthy()
    expect(머리.getByLabelText('분배 비율 비율 합 증가')).toBeTruthy()
    // 트랙 줄에는 합이 없다. 있으면 트랙이 그만큼 짧아진다.
    expect(within(getByTestId('share-field-body')).queryByLabelText('분배 비율 비율 합 증가')).toBeNull()
  })

  it('합이 상한이면 더 못 올린다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <ShareField label="드롭" value={{ myShare: 1, sharesTotal: 9 }} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText('드롭 비율 합 증가'))

    expect(onChange).not.toHaveBeenCalled()
  })
})
