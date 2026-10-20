// 스탈 배너. 파일을 따로 둬서 스냅샷 이름이
// 섞이지 않게 파일을 나눈다).
//
// 문구·라벨은 전부 **호출부가 넘긴 값**이고 컴포넌트는 분기를 갖지 않는다(
// molecule 이 `ScheduleSyncError` 를 알면 계층 의존 방향이 뒤집힌다).
import { fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { StaleBanner } from '../StaleBanner'

describe('StaleBanner', () => {
  it('액션을 누르면 onClick이 호출된다', async () => {
    const onClick = jest.fn()
    const { getByText } = await renderAtom(
      <StaleBanner message="목록이 최신이 아닙니다" action={{ label: '다시 시도', onClick }} />,
    )

    await fireEvent.press(getByText('다시 시도'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // 재시도가 통하지 않는 실패(429·characterUnavailable·401)에는 액션이
  // 없다. 배너는 목록이 남아 있는 자리라 액션이 없어도 막다른 길이 아니다.
  it('액션이 없으면 버튼을 만들지 않는다', async () => {
    const { getByText, queryByRole } = await renderAtom(
      <StaleBanner message="호출 한도를 초과했습니다. 서비스 단계 키인지 확인해주세요" />,
    )

    expect(getByText('호출 한도를 초과했습니다. 서비스 단계 키인지 확인해주세요')).toBeTruthy()
    expect(queryByRole('button')).toBeNull()
  })

})
