// 막고 알리는 모달의 골격.
//
// 이 파일이 지키는 것은 **슬롯의 유무와 `tone` 이 정하는 값**이다. 문구는 호출부 몫이라 여기서
// 안 본다. 두 호출부(`ApiKeyNoticeModal`·`DevelopmentStageKeyModal`)가 각자 그 문구를 단언한다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderOverlay, 기본테마 } from '../../../__tests__/render-atom'
import { KeyRoundIcon } from '../../../atoms'
import { NoticeModal } from '../NoticeModal'

const noop = (): void => {}

function 기본프롭(): React.ComponentProps<typeof NoticeModal> {
  return {
    icon: KeyRoundIcon,
    tone: 'primary',
    title: '이 키로는 연결할 수 없습니다',
    action: { label: '다시 입력하기', onPress: noop },
    onClose: noop,
    testId: 'notice',
  }
}

describe('NoticeModal: 슬롯', () => {
  it('제목과 주 버튼은 언제나 있다', async () => {
    const { getByText } = await renderOverlay(<NoticeModal {...기본프롭()} />)

    expect(getByText('이 키로는 연결할 수 없습니다')).toBeTruthy()
    expect(getByText('다시 입력하기')).toBeTruthy()
  })

  // 설명 · 내용 · 링크 셋은 선택이다. 안 주면 그 자리가 아예 없어야 한다. 빈 `View` 로 남으면
  // 위아래 `gap-5` 가 두 번 먹어 머리와 버튼 사이가 벌어진다.
  it('설명·내용·링크를 안 주면 그 자리가 없다', async () => {
    const { queryByTestId } = await renderOverlay(<NoticeModal {...기본프롭()} />)

    expect(queryByTestId('notice-description')).toBeNull()
    expect(queryByTestId('notice-content')).toBeNull()
    expect(queryByTestId('notice-link')).toBeNull()
  })

  // 설명은 제목보다 작다(사용자 지정). 제목이 할 말을 이미 했고 설명은 그 아래 안내라, 둘이
  // 같은 무게로 서면 제목이 눌린다. 두 호출부가 각자 크기를 정하던 자리라 여기서 못박는다.
  it('설명을 주면 제목보다 작게 그린다', async () => {
    const { getByTestId, getByText } = await renderOverlay(
      <NoticeModal {...기본프롭()} description="키 입력 화면으로 이동합니다." />,
    )

    expect(getByText('키 입력 화면으로 이동합니다.')).toBeTruthy()

    const 설명 = flattenStyle(getByTestId('notice-description').props.style).fontSize
    const 제목 = flattenStyle(getByText('이 키로는 연결할 수 없습니다').props.style).fontSize
    expect(설명).toBe(12)
    expect(제목).toBeGreaterThan(설명 as number)
  })

  // 자유 영역이다. 개발 단계 키 모달의 두 줄 표가 여기 든다. 틀은 그것이 어디에 서는지만 정하고
  // 무엇인지는 안 본다.
  it('내용은 넘긴 것을 그대로 그린다', async () => {
    const { getByText } = await renderOverlay(
      <NoticeModal {...기본프롭()} content={<KeyRoundIcon aria-hidden />} description="설명" />,
    )

    expect(getByText('설명')).toBeTruthy()
  })

  it('제목에 손잡이를 달 수 있다. 화면 테스트가 이것으로 모달을 집는다', async () => {
    const { getByTestId } = await renderOverlay(
      <NoticeModal {...기본프롭()} titleTestId="development-stage-key-title" />,
    )

    expect(getByTestId('development-stage-key-title')).toHaveTextContent(
      '이 키로는 연결할 수 없습니다',
    )
  })
})

describe('NoticeModal: tone 이 배지의 색과 모양을 함께 정한다', () => {
  /**
   * 배지 안의 아이콘. `testID` 를 달아도 못 잡는다. lucide 아이콘은 그것을 `data-testid` 로
   * 내려보내고 쿼리는 `testID` 를 본다. 그래서 배지의 첫 자식을 그냥 집는다.
   *
   * 색은 `style` 이 아니라 `stroke` 로 온다. 선으로 그리는 그림이다.
   */
  function 배지아이콘(badge: { children: unknown[] }): { props: { stroke?: string } } {
    return badge.children[0] as { props: { stroke?: string } }
  }

  // 둘을 따로 받으면 붉은 네모 같은 조합이 만들어진다. 원과 네모를 가른 근거가 색과 같다.
  // 실패한 곳인가, 종류가 다른 것을 넣은 곳인가.
  it('error 는 붉은 원이다', async () => {
    const { getByTestId } = await renderOverlay(<NoticeModal {...기본프롭()} tone="error" />)

    const badge = flattenStyle(getByTestId('notice-badge').props.style)
    expect(badge.backgroundColor).toBe(기본테마.errorTint)
    // `rounded-full`. 56 짜리 상자라 반지름이 넘치면 원이다.
    expect(badge.borderRadius).toBe(9999)
  })

  // 네모인 것은 아래 `content` 가 표일 때 모서리를 맞추기 위해서다.
  it('primary 는 모서리를 깎은 네모다', async () => {
    const { getByTestId } = await renderOverlay(<NoticeModal {...기본프롭()} />)

    const badge = flattenStyle(getByTestId('notice-badge').props.style)
    expect(badge.backgroundColor).toBe(기본테마.primaryTint)
    expect(badge.borderRadius).toBe(16)
  })

  it('아이콘 색은 배지와 같은 계열에서 나온다', async () => {
    const 붉은쪽 = await renderOverlay(<NoticeModal {...기본프롭()} tone="error" />)
    const 테마쪽 = await renderOverlay(<NoticeModal {...기본프롭()} />)

    expect(배지아이콘(붉은쪽.getByTestId('notice-badge')).props.stroke).toBe(기본테마.errorInk)
    expect(배지아이콘(테마쪽.getByTestId('notice-badge')).props.stroke).toBe(기본테마.primaryInk)
  })
})

describe('NoticeModal: 배선', () => {
  it('주 버튼을 누르면 그 핸들러만 불린다', async () => {
    const onPress = jest.fn()
    const onClose = jest.fn()
    const { getByText } = await renderOverlay(
      <NoticeModal {...기본프롭()} action={{ label: '확인', onPress }} onClose={onClose} />,
    )

    await fireEvent.press(getByText('확인'))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('링크를 누르면 그 핸들러만 불린다', async () => {
    const onPress = jest.fn()
    const linkPress = jest.fn()
    const { getByText } = await renderOverlay(
      <NoticeModal
        {...기본프롭()}
        action={{ label: '확인', onPress }}
        link={{ label: '발급 방법 자세히 보기', onPress: linkPress }}
      />,
    )

    await fireEvent.press(getByText('발급 방법 자세히 보기'))

    expect(linkPress).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  // 닫을 수 있는가는 틀이 안 본다. `onClose` 가 정한다. 못 닫는 모달은 no-op 을 넘긴다.
  it('오버레이를 누르면 onClose 로 간다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(<NoticeModal {...기본프롭()} onClose={onClose} />)

    await fireEvent.press(getByTestId('notice'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('안드로이드 뒤로가기도 onClose 로 간다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(<NoticeModal {...기본프롭()} onClose={onClose} />)

    await fireEvent(getByTestId('notice-modal'), 'requestClose')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
