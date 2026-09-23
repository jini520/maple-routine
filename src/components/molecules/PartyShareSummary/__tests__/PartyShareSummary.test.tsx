// 파티 분배를 적고 모달로 보내는 줄.
//
// 배지 하나가 상태를 말한다. `솔로` · `파티 3인` · `67%` 셋 중 하나이고 `67%` 는 결정석 몫이다.
// 비율이 결정석에만 있어 무엇의 비율인가를 물을 일이 없다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { PartyShareSummary } from '../PartyShareSummary'

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }
const 이대일 = { myShare: 2, sharesTotal: 3, splitFeePercent: 3 }

describe('PartyShareSummary', () => {
  it('균등이고 둘 이상이면 파티 n인 배지다', async () => {
    const { getByTestId } = await renderAtom(
      <PartyShareSummary label="스우" partySize={3} crystal={EVEN} onPress={jest.fn()} />,
    )

    expect(getByTestId('party-share-badge')).toHaveTextContent('파티 3인')
  })

  // 혼자면 인원을 세지 않는다. `파티 1인` 은 파티가 아니다.
  it('혼자면 솔로다', async () => {
    const { getByText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={1} crystal={EVEN} onPress={jest.fn()} />,
    )

    expect(getByText('솔로')).toBeTruthy()
  })

  // 비율을 쓰면 인원이 몫을 못 말한다. 배지가 값 쪽으로 넘어간다.
  it('비율이면 결정석 몫 하나만 적는다', async () => {
    const { getByTestId, queryByText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={이대일} onPress={jest.fn()} />,
    )

    expect(getByTestId('party-share-badge')).toHaveTextContent('66.7%')
    expect(queryByText('결정석')).toBeNull()
    expect(queryByText('파티 2인')).toBeNull()
  })

  // 두 크기가 같은 수를 말한다. 카드만 반올림하면 같은 비율이 화면마다 다른 수로 보인다(사용자 지정).
  it('compact 도 소수 첫째 자리까지 적는다', async () => {
    const 작은 = await renderAtom(
      <PartyShareSummary
        label="스우"
        partySize={2}
        crystal={이대일}
        size="compact"
        onPress={jest.fn()}
      />,
    )

    expect(작은.getByText('66.7%')).toBeTruthy()
  })

  // 보스 수익 카드는 금액과 한 줄을 나눠 쓴다. 이 줄이 커지면 카드가 통째로 커진다.
  it('compact 는 배지를 줄인다', async () => {
    const 기본 = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={이대일} onPress={jest.fn()} />,
    )
    const 작은 = await renderAtom(
      <PartyShareSummary
        label="스우"
        partySize={2}
        crystal={이대일}
        size="compact"
        onPress={jest.fn()}
      />,
    )

    const 크기 = (view: typeof 기본): number =>
      flattenStyle(view.getByText('66.7%').props.style).fontSize as number

    expect(크기(작은)).toBeLessThan(크기(기본))
  })

  it('변경을 누르면 알린다', async () => {
    const onPress = jest.fn()
    const { getByLabelText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={EVEN} onPress={onPress} />,
    )

    await fireEvent.press(getByLabelText('스우 파티 인원과 비율 변경'))

    expect(onPress).toHaveBeenCalled()
  })

  it('고칠 수 없는 행에는 변경이 없다', async () => {
    const { queryByLabelText } = await renderAtom(
      <PartyShareSummary label="스우" partySize={2} crystal={EVEN} disabled onPress={jest.fn()} />,
    )

    expect(queryByLabelText('스우 파티 인원과 비율 변경')).toBeNull()
  })
})
