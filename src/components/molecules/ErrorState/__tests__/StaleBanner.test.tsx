// 스탈 배너. 파일을 따로 둬서 스냅샷 이름이
// 섞이지 않게 파일을 나눈다).
//
// 문구·라벨은 전부 **호출부가 넘긴 값**이고 컴포넌트는 분기를 갖지 않는다(
// molecule 이 `ScheduleSyncError` 를 알면 계층 의존 방향이 뒤집힌다).
import { fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { StaleBanner } from '../StaleBanner'

describe('StaleBanner', () => {
  it('문구와 액션 버튼을 렌더링한다', async () => {
    const { getByText } = await renderAtom(
      <StaleBanner message="목록이 최신이 아닙니다" action={{ label: '다시 시도', onClick: () => {} }} />,
    )

    expect(getByText('목록이 최신이 아닙니다')).toBeTruthy()
    expect(getByText('다시 시도')).toBeTruthy()
  })

  // 라벨은 하드코딩된 "다시 시도"가 아니라 호출부가 넘긴 값이다. 피커의 401은 "설정 열기"를
  // 받았고, 지금은 401 이 액션 없이 안내 모달로 간다.
  // **컴포넌트는 그 변화를 몰라야 한다**는 것이 이 케이스가 지키는 것이다.
  it('"다시 시도"가 아닌 라벨도 그대로 렌더링한다', async () => {
    const { getByText, queryByText } = await renderAtom(
      <StaleBanner
        message="API 키가 유효하지 않아 목록을 갱신하지 못했습니다"
        action={{ label: '설정 열기', onClick: () => {} }}
      />,
    )

    expect(getByText('설정 열기')).toBeTruthy()
    expect(queryByText('다시 시도')).toBeNull()
  })

  it('액션을 누르면 onClick이 호출된다', async () => {
    const onClick = jest.fn()
    const { getByText } = await renderAtom(
      <StaleBanner message="목록이 최신이 아닙니다" action={{ label: '다시 시도', onClick }} />,
    )

    await fireEvent.press(getByText('다시 시도'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // : 재시도가 통하지 않는 실패(429·characterUnavailable·401)에는 액션이
  // 없다. 배너는 목록이 남아 있는 자리라 액션이 없어도 막다른 길이 아니다.
  it('액션이 없으면 버튼을 만들지 않는다', async () => {
    const { getByText, queryByRole } = await renderAtom(
      <StaleBanner message="호출 한도를 초과했습니다. 서비스 단계 키인지 확인해주세요" />,
    )

    expect(getByText('호출 한도를 초과했습니다. 서비스 단계 키인지 확인해주세요')).toBeTruthy()
    expect(queryByRole('button')).toBeNull()
  })

  it('role=alert 를 갖는다', async () => {
    const { getByTestId } = await renderAtom(<StaleBanner message="목록이 최신이 아닙니다" />)

    expect(getByTestId('stale-banner').props.role).toBe('alert')
  })

})
