// 웹판의 여섯을 그대로 옮겼다. **문구는 테스트가 만든 값이고, 컴포넌트는 문구를 갖지 않는다** —
// 원인별 문구는 `features/schedule-sync/format.ts` 가 정하고 여기는 껍데기다.
import { fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { ErrorState } from '../ErrorState'

describe('ErrorState', () => {
  it('제목과 설명을 렌더링한다', async () => {
    const { getByText } = await renderAtom(
      <ErrorState title="캐릭터 목록을 불러오지 못했습니다" description="네트워크 연결을 확인해주세요" />,
    )

    expect(getByText('캐릭터 목록을 불러오지 못했습니다')).toBeTruthy()
    expect(getByText('네트워크 연결을 확인해주세요')).toBeTruthy()
  })

  it('설명이 없으면 제목만 렌더링한다', async () => {
    const { getByText, queryByTestId } = await renderAtom(<ErrorState title="요청이 너무 많습니다" />)

    expect(getByText('요청이 너무 많습니다')).toBeTruthy()
    expect(queryByTestId('error-state-description')).toBeNull()
  })

  // : `action` 이 옵셔널인 것은 "액션이 없어도 된다"가 아니라 **그 자리의 진행
  // 경로를 다른 것(모달의 닫기·취소, 위에 덮이는 안내 모달)이 제공할 수 있다**는 뜻이다. 조건이
  // 지켜지는지는 이 컴포넌트가 알 수 없으므로 각 호출부 테스트가 본다(피커·온보딩·설정 계정 변경).
  it('액션이 없으면 버튼을 만들지 않는다', async () => {
    const { queryByRole } = await renderAtom(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(queryByRole('button')).toBeNull()
  })

  it('액션을 누르면 onClick이 호출된다', async () => {
    const onClick = jest.fn()
    const { getByText } = await renderAtom(
      <ErrorState title="캐릭터 목록을 불러오지 못했습니다" action={{ label: '다시 시도', onClick }} />,
    )

    await fireEvent.press(getByText('다시 시도'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // : 세 상태(조회 중 / 빈 상태 / 실패)가 구분 가능해야 한다. EmptyState는 아이콘을
  // 원형 배지로 감싸므로, ErrorState가 배지를 쓰지 않는 것이 그 구분의 시각적 근거다.
  it('아이콘을 배지로 감싸지 않는다', async () => {
    const { queryByTestId } = await renderAtom(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(queryByTestId('empty-state-badge', { includeHiddenElements: true })).toBeNull()
  })

  it('스크린리더에 즉시 알리도록 role=alert 를 갖는다', async () => {
    const { getByTestId } = await renderAtom(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(getByTestId('error-state').props.role).toBe('alert')
  })

})
