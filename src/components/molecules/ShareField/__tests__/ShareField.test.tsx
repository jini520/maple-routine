// 분배 비율 고르개. 슬라이더가 내 비율이고 스테퍼가 합이다.
//
// 여기서 특히 중요한 것은 **합을 줄일 때 내 비율이 따라 내려가는가** 다. 안 맞추면 내 비율이
// 합보다 커져 내 몫이 100%를 넘는다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
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

  // 드롭 가격 카드가 쓰는 벌. 합이 트랙 아래 가운데다(사용자 지정).
  it('stacked 는 합이 트랙 아래 가운데에 선다', async () => {
    const { getByTestId, getByLabelText } = await renderAtom(
      <ShareField label="분배 비율" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} layout="stacked" />,
    )

    // 트랙 줄과 합이 세로로 쌓인다. 한 줄이면 좁은 칸에서 트랙이 30px 밖에 안 남는다.
    expect(flattenStyle(getByTestId('share-field-track').props.style).flexDirection).not.toBe('row')
    expect(getByLabelText('분배 비율 비율 합 증가')).toBeTruthy()
    expect(getByTestId('share-field-total-분배 비율')).toHaveTextContent('3')
  })

  /**
   * 트랙은 제 높이가 곧 누를 자리다. `flex-1` 은 `flexBasis: 0` 이라 **세로로 쌓는 `stacked`
   * 에서만** 그 높이를 0 으로 덮어, 막대만 상자 밖으로 넘쳐 보이고 칸 누르개가 죽는다.
   * 가로로 서는 `wide` 에서는 같은 `flex-1` 이 너비라 그대로 있어야 트랙이 남는 폭을 채운다.
   */
  it('stacked 트랙은 높이 24 를 flex 에 안 뺏긴다', async () => {
    const { getByTestId } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} layout="stacked" />,
    )

    const 트랙 = flattenStyle(getByTestId('share-field-track').props.style)
    expect(트랙.height).toBe(24)
    expect(트랙.flexGrow).toBeUndefined()
  })

  it('wide 트랙은 flex 로 남는 폭을 채운다', async () => {
    const { getByTestId } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} layout="wide" />,
    )

    const 트랙 = flattenStyle(getByTestId('share-field-track').props.style)
    expect(트랙.height).toBe(44)
    expect(Number(트랙.flexGrow)).toBe(1)
  })

  // 라벨 11px 과 백분율 23px 를 baseline 으로 묶으면 라벨이 7px 내려앉아, 드롭 가격 카드에서
  // 옆 칸의 `파티 인원` 과 다른 높이에 선다(사용자 지정).
  it.each(['wide', 'stacked'] as const)('%s 는 라벨을 카드 좌상단에 세운다', async (layout) => {
    const { getByTestId } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} layout={layout} />,
    )

    expect(flattenStyle(getByTestId('share-field-head').props.style).alignItems).toBe('flex-start')
  })

  // 가로로 서는 두 벌은 `−` 가 왼쪽이다(사용자 지정). 세로로 서는 `row` 만 `＋` 가 위다.
  it.each(['wide', 'stacked'] as const)('%s 는 − 가 ＋ 보다 앞이다', async (layout) => {
    const { getAllByLabelText } = await renderAtom(
      <ShareField label="결정석" value={{ myShare: 2, sharesTotal: 3 }} onChange={jest.fn()} layout={layout} />,
    )

    const 합버튼 = getAllByLabelText(/결정석 비율 합/)
    expect(합버튼.map((node) => String(node.props.accessibilityLabel))).toEqual([
      '결정석 비율 합 감소',
      '결정석 비율 합 증가',
    ])
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
