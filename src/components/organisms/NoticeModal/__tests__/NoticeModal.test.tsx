// 배지를 이고 서는 모달의 골격.
//
// 이 파일이 지키는 것은 **영역 여섯의 유무와 그 사이 간격**이다. 문구는 호출부 몫이라 여기서
// 안 본다. 세 호출부(`ApiKeyNoticeModal`·`DevelopmentStageKeyModal`·`UpdatePromptModal`)가
// 각자 그 문구를 단언한다.
import { fireEvent, within } from '@testing-library/react-native'
import { Text as RNText } from 'react-native'

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

describe('NoticeModal: 영역', () => {
  // 짧은 화면에서 카드가 상한에 닿아도 버튼은 늘 보여야 한다. 버튼 줄이 스크롤 밖에 선다.
  it('버튼 줄은 카드의 스크롤 밖에 서고 머리는 스크롤 안에 선다', async () => {
    const { getByTestId } = await renderOverlay(
      <NoticeModal
        {...기본프롭()}
        secondaryAction={{ label: '나중에', onPress: noop }}
        option={<RNText>옵션</RNText>}
      />,
    )

    const scroll = getByTestId('modal-card-scroll')
    expect(within(scroll).getByText('이 키로는 연결할 수 없습니다')).toBeTruthy()
    expect(within(scroll).getByText('옵션')).toBeTruthy()
    expect(within(scroll).queryByText('다시 입력하기')).toBeNull()
    expect(within(scroll).queryByText('나중에')).toBeNull()
  })

  // 나머지 다섯은 선택이다. 안 주면 그 자리가 아예 없어야 한다. 빈 `View` 로 남으면 위아래
  // 간격이 두 번 먹어 덩어리 사이가 벌어진다.
  it('나머지 영역은 안 주면 자리가 없다', async () => {
    const { queryByTestId, queryByText } = await renderOverlay(<NoticeModal {...기본프롭()} />)

    expect(queryByTestId('notice-content')).toBeNull()
    expect(queryByTestId('notice-description')).toBeNull()
    expect(queryByTestId('notice-option')).toBeNull()
    expect(queryByTestId('notice-link')).toBeNull()
    expect(queryByText('나중에')).toBeNull()
  })

  // 설명은 제목보다 작다. 제목이 할 말을 이미 했고 설명은 그 아래 안내라, 둘이 같은 무게로 서면
  // 제목이 눌린다. 세 호출부가 각자 크기를 정하던 자리라 여기서 못박는다.
  it('설명을 주면 제목보다 작게 그린다', async () => {
    const { getByTestId, getByText } = await renderOverlay(
      <NoticeModal {...기본프롭()} description="키 입력 화면으로 이동합니다." />,
    )

    const 설명 = flattenStyle(getByTestId('notice-description').props.style).fontSize
    const 제목 = flattenStyle(getByText('이 키로는 연결할 수 없습니다').props.style).fontSize
    expect(설명).toBe(12)
    expect(제목).toBeGreaterThan(설명 as number)
  })

  // **제목·내용·설명이 한 덩어리다**(사용자 지정, 2026-09-04). 내용은 제목에 딸린 값이라
  // (버전·단계) 떼어 놓으면 따로 선 사실이 되어 무엇에 대한 값인지가 사라진다. 옵션은 그 밖이다.
  it('제목·내용·설명은 8 로 붙고 옵션은 그 덩어리 밖이다', async () => {
    const { getByTestId } = await renderOverlay(
      <NoticeModal
        {...기본프롭()}
        content={<RNText>v1.0.7</RNText>}
        description="설명"
        option={<RNText>펼침판</RNText>}
      />,
    )

    const 덩어리 = getByTestId('notice-body')
    expect(flattenStyle(덩어리.props.style).rowGap).toBe(8)
    expect(within(덩어리).getByText('v1.0.7')).toBeTruthy()
    expect(within(덩어리).getByText('설명')).toBeTruthy()
    expect(within(덩어리).queryByText('펼침판')).toBeNull()
  })
})

describe('NoticeModal: 배지', () => {
  // 표가 바로 아래 오는 자리만 네모다. 모서리를 맞춰 둘이 한 덩어리로 읽히게 한다.
  it('표가 붙는 자리는 네모로 바꾼다', async () => {
    const { getByTestId } = await renderOverlay(
      <NoticeModal {...기본프롭()} badgeShape="square" />,
    )

    expect(flattenStyle(getByTestId('notice-badge').props.style).borderRadius).toBe(16)
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

  it('부 버튼을 누르면 그 핸들러만 불린다', async () => {
    const onPress = jest.fn()
    const 부동작 = jest.fn()
    const { getByText } = await renderOverlay(
      <NoticeModal
        {...기본프롭()}
        action={{ label: '다운로드', onPress }}
        secondaryAction={{ label: '나중에', onPress: 부동작 }}
      />,
    )

    await fireEvent.press(getByText('나중에'))

    expect(부동작).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('링크를 누르면 그 핸들러만 불린다', async () => {
    const onPress = jest.fn()
    const 링크 = jest.fn()
    const { getByText } = await renderOverlay(
      <NoticeModal
        {...기본프롭()}
        action={{ label: '확인', onPress }}
        link={{ label: '발급 방법 자세히 보기', onPress: 링크 }}
      />,
    )

    await fireEvent.press(getByText('발급 방법 자세히 보기'))

    expect(링크).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  // **되돌릴 수 없는 확인에서는 주 버튼이 취소다.** 파괴 동작은 부 버튼에 `danger` 로 내린다.
  // 크기는 `나중에` 와 **같고 글자색만** 갈린다(사용자 지정). 되돌릴 수 없는 것이 취소보다 커
  // 보이면 안 되고, 위험하다는 신호는 색 하나로 충분하다.
  it('danger 부 버튼은 크기가 그대로고 글자색만 error 다', async () => {
    const 위험 = await renderOverlay(
      <NoticeModal
        {...기본프롭()}
        action={{ label: '취소', onPress: noop }}
        secondaryAction={{ label: '삭제', onPress: noop, danger: true }}
      />,
    )
    const 평범 = await renderOverlay(
      <NoticeModal {...기본프롭()} secondaryAction={{ label: '나중에', onPress: noop }} />,
    )

    const 삭제 = flattenStyle(위험.getByText('삭제').props.style)
    const 나중에 = flattenStyle(평범.getByText('나중에').props.style)
    expect(삭제.color).toBe(기본테마.errorInk)
    expect(나중에.color).not.toBe(기본테마.errorInk)
    expect(삭제.fontSize).toBe(나중에.fontSize)
  })

  it('두 버튼 다 대기와 비활성을 받는다', async () => {
    const { getByText } = await renderOverlay(
      <NoticeModal
        {...기본프롭()}
        action={{ label: '취소', onPress: noop, disabled: true }}
        secondaryAction={{ label: '삭제', onPress: noop, danger: true, busy: true, disabled: true }}
      />,
    )

    expect(getByText('취소').parent?.props.accessibilityState).toMatchObject({ disabled: true })
    expect(getByText('삭제').parent?.props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    })
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
