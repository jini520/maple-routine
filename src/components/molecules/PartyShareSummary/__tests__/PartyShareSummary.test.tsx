// 파티 분배를 적고 모달로 보내는 줄.
//
// 여기서 갈리는 것 둘. **균등이면 배지 하나**이고(나눌 것이 없어 무엇의 비율인가를 물을 일이
// 없다), **비율이면 라벨을 인 결정석·아이템 두 열을 상자로 두른다**.
import { fireEvent, within } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { PartyShareSummary } from '../PartyShareSummary'

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }
const 이대일 = { myShare: 2, sharesTotal: 3, splitFeePercent: 3 }
const 반반 = { myShare: 1, sharesTotal: 2, splitFeePercent: 3 }

describe('PartyShareSummary', () => {
  it('균등이고 둘 이상이면 파티 n인 한 줄이다', async () => {
    const { getByText, queryByText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={3} crystal={EVEN} drop={EVEN} onPress={jest.fn()} />,
    )

    expect(getByText('파티 3인')).toBeTruthy()
    expect(queryByText('결정석')).toBeNull()
  })

  // 무엇이 설정된 상태인지 한눈에 갈리라고 균등과 비율의 모양을 나눴다.
  it('균등은 배지 하나이고 비율 상자가 없다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <PartyShareSummary label="스우" partySize={3} crystal={EVEN} drop={EVEN} onPress={jest.fn()} />,
    )

    expect(getByTestId('party-share-badge')).toHaveTextContent('파티 3인')
    expect(queryByTestId('party-share-ratio-box')).toBeNull()
  })

  it('비율은 두 칸을 상자로 두르고 배지가 없다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={이대일} drop={반반} onPress={jest.fn()} />,
    )

    const box = within(getByTestId('party-share-ratio-box'))
    expect(box.getByText('결정석')).toBeTruthy()
    expect(box.getByText('아이템')).toBeTruthy()
    expect(queryByTestId('party-share-badge')).toBeNull()
  })

  // 혼자면 인원을 세지 않는다. `파티 1인` 은 파티가 아니다.
  it('혼자면 솔로다', async () => {
    const { getByText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={1} crystal={EVEN} drop={EVEN} onPress={jest.fn()} />,
    )

    expect(getByText('솔로')).toBeTruthy()
  })

  it('비율이면 결정석과 아이템 두 열을 백분율로 적는다', async () => {
    const { getByText, queryByText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={이대일} drop={반반} onPress={jest.fn()} />,
    )

    expect(getByText('결정석')).toBeTruthy()
    expect(getByText('66.7%')).toBeTruthy()
    expect(getByText('아이템')).toBeTruthy()
    expect(getByText('50%')).toBeTruthy()
    // 비율을 쓰면 셀 인원이 없다.
    expect(queryByText('파티 2인')).toBeNull()
  })

  // 보스 수익 카드는 금액과 한 줄을 나눠 쓴다. 이 줄이 커지면 카드가 통째로 커진다.
  it('compact 는 라벨과 값을 줄인다', async () => {
    const 기본 = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={이대일} drop={반반} onPress={jest.fn()} />,
    )
    const 작은 = await renderAtom(
      <PartyShareSummary
        label="스우"
        partySize={2}
        crystal={이대일}
        drop={반반}
        size="compact"
        onPress={jest.fn()}
      />,
    )

    const 크기 = (view: typeof 기본, text: string): number =>
      flattenStyle(view.getByText(text).props.style).fontSize as number

    expect(크기(작은, '결정석')).toBeLessThan(크기(기본, '결정석'))
    expect(크기(작은, '66.7%')).toBeLessThan(크기(기본, '66.7%'))
  })

  it('변경을 누르면 알린다', async () => {
    const onPress = jest.fn()
    const { getByLabelText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={EVEN} drop={EVEN} onPress={onPress} />,
    )

    await fireEvent.press(getByLabelText('스우 파티 인원과 비율 변경'))

    expect(onPress).toHaveBeenCalled()
  })

  it('고칠 수 없는 행에는 변경이 없다', async () => {
    const { queryByLabelText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={EVEN} drop={EVEN} disabled onPress={jest.fn()} />,
    )

    expect(queryByLabelText('스우 파티 인원과 비율 변경')).toBeNull()
  })
})
