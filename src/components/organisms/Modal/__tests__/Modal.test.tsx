// 웹판을 옮긴 것. 사라지거나 형태가 바뀐 케이스만 여기 적는다.
//
// · *"body 직속으로 렌더링한다"* → **`react-native` 의 `Modal` 을 쓴다**로 바뀐다(같은 계약의 RN 판:
//   부모 레이아웃과 무관하게 화면 전체를 덮는다).
// · *"뒷 페이지 스크롤을 막는다"* → **사라진다.** 네이티브 윈도우가 구조적으로 한다.
// · 클래스 문자열을 보던 자리는 **스타일 값**을 본다(`panel-on-scrim` → 실제 테두리 색).
// · `align` 두 케이스는 `pt-[calc(var(--sa-top)+2rem)]` 대신 실제 `paddingTop` 숫자를 잰다.
import { fireEvent } from '@testing-library/react-native'
import { Text, View } from 'react-native'

import { flattenStyle, renderOverlay, 기본테마 } from '../../../__tests__/render-atom'
import { resolvePanelBorder } from '../../../../theme/theme-vars'
import { Modal } from '../Modal'

const noop = (): void => {}

describe('Modal', () => {
  it('children 을 렌더링한다', async () => {
    const { getByText } = await renderOverlay(
      <Modal onClose={noop}>
        <Modal.Card>
          <Text>모달 내용</Text>
        </Modal.Card>
      </Modal>,
    )

    expect(getByText('모달 내용')).toBeTruthy()
  })

  it('오버레이(바깥 영역)를 누르면 onClose 가 호출된다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <Modal onClose={onClose} testId="test-modal">
        <Modal.Card>
          <Text>내용</Text>
        </Modal.Card>
      </Modal>,
    )

    await fireEvent.press(getByTestId('test-modal'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 웹은 `stopPropagation` 이었다. RN 에는 버블링이 없어 **터치를 누가 가져가는지**로 같은 일을
  // 한다. 패널이 responder 를 선언하지 않으면 바깥 `Pressable` 이 받아 모달이 닫힌다.
  it.each([
    ['Modal.Card', <Modal.Card key="card"><Text>내용</Text></Modal.Card>],
    ['Modal.Panel', <Modal.Panel key="panel"><View><Text>내용</Text></View></Modal.Panel>],
  ])('%s 은 안쪽 터치를 자기가 가져간다', async (_label, panel) => {
    const { getByText } = await renderOverlay(<Modal onClose={noop}>{panel}</Modal>)

    let node = getByText('내용').parent
    let claims = false
    while (node !== null) {
      if (typeof node.props.onStartShouldSetResponder === 'function') {
        claims = node.props.onStartShouldSetResponder({} as never) === true
        break
      }
      node = node.parent
    }

    expect(claims).toBe(true)
  })

  it('Modal.Card 는 카드 껍데기(테두리·배경·패딩)를 갖는다', async () => {
    const { getByText } = await renderOverlay(
      <Modal onClose={noop}>
        <Modal.Card>
          <Text>내용</Text>
        </Modal.Card>
      </Modal>,
    )

    const style = flattenStyle(getByText('내용').parent?.props.style)
    expect(style.borderWidth).toBe(1)
    expect(style.backgroundColor).toBe(기본테마.surface)
    expect(style.padding).toBe(24)
  })

  // 업데이트 모달의 부 동작 버튼이 작아 아래 여백이 커 보이던 것.
  it('Modal.Card 의 tight 는 하단 패딩만 줄인다', async () => {
    const { getByText } = await renderOverlay(
      <Modal onClose={noop}>
        <Modal.Card tight>
          <Text>내용</Text>
        </Modal.Card>
      </Modal>,
    )

    const style = flattenStyle(getByText('내용').parent?.props.style)
    expect(style.paddingTop).toBe(24)
    expect(style.paddingBottom).toBe(16)
  })

  it('Modal.Panel 은 카드 테두리/배경 없이 위치만 잡는다', async () => {
    const { getByText } = await renderOverlay(
      <Modal onClose={noop}>
        <Modal.Panel>
          <View>
            <Text>내용</Text>
          </View>
        </Modal.Panel>
      </Modal>,
    )

    // 내용 → 그 래퍼 View → Modal.Panel
    const panel = getByText('내용').parent?.parent
    const style = flattenStyle(panel?.props.style)
    expect(style.borderWidth).toBeUndefined()
    expect(style.backgroundColor).toBeUndefined()
    expect(style.maxWidth).toBe(384)
  })

  // : 라이트에서만 테두리를 배경색 쪽으로 눌러 가라앉힌다. RN 에는 선택자가 없어
  // 그 결과를 `--color-panel-border` 토큰이 값으로 갖고 있고(`theme/theme-vars.ts`), 이 케이스는
  // **`Card` atom 의 `border-border` 를 그것이 실제로 덮는지**를 지킨다. 클래스 순서가 아니라
  // 생성된 스타일시트 순서에 달린 자리라, 조용히 뒤집히면 라이트 모달 테두리가 도드라진다.
  it('Modal.Card 의 테두리는 스크림 위 값으로 덮인다', async () => {
    const { getByText } = await renderOverlay(
      <Modal onClose={noop}>
        <Modal.Card>
          <Text>내용</Text>
        </Modal.Card>
      </Modal>,
    )

    const style = flattenStyle(getByText('내용').parent?.props.style)
    expect(style.borderColor).toBe(resolvePanelBorder(기본테마))
    expect(style.borderColor).not.toBe(기본테마.border)
  })

  it('기본값은 상단 정렬이며 상태바를 피해 여백을 둔다', async () => {
    const { getByTestId } = await renderOverlay(
      <Modal onClose={noop} testId="test-modal">
        <Modal.Card>
          <Text>내용</Text>
        </Modal.Card>
      </Modal>,
    )

    // 안전영역 상단 59 + 2rem
    expect(flattenStyle(getByTestId('test-modal').props.style).paddingTop).toBe(59 + 32)
  })

  it('align="center" 면 세로 중앙에 놓는다. 키보드를 띄우지 않는 모달용', async () => {
    const { getByTestId } = await renderOverlay(
      <Modal onClose={noop} align="center" testId="test-modal">
        <Modal.Card>
          <Text>내용</Text>
        </Modal.Card>
      </Modal>,
    )

    const style = flattenStyle(getByTestId('test-modal').props.style)
    expect(style.justifyContent).toBe('center')
    expect(style.paddingTop).toBeUndefined()
  })

  //  후반. 하드웨어 뒤로가기는 스택을 pop 하지 않고 이 오버레이만 닫는다.
  it('안드로이드 뒤로가기(onRequestClose)가 onClose 로 이어진다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <Modal onClose={onClose} testId="test-modal">
        <Modal.Card>
          <Text>내용</Text>
        </Modal.Card>
      </Modal>,
    )

    const modal = getByTestId('test-modal-modal', { includeHiddenElements: true })
    ;(modal.props.onRequestClose as () => void)()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

})
