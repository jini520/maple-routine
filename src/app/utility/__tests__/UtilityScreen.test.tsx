// 유틸리티 = **도구 목록**.
//
// 이 파일이 지키는 것은 카드 하나가 아니라 **구조**다. 도구가 유틸리티 화면 안의 카드가 아니라
// 루트 스택에 쌓이는 하위 페이지라는 것. 첫 도구가 정한 이 구조를 뒤에 오는 도구들이 물려받는다.

import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
import { ITEM_SPLIT_TOOL_NAME } from '../tool-names'
import { UtilityScreen } from '../UtilityScreen'

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedUseScreenNavigation = jest.mocked(useScreenNavigation)
const navigate = jest.fn()

beforeEach(() => {
  mockedUseScreenNavigation.mockReturnValue({ navigate } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

describe('UtilityScreen', () => {
  it('**유틸리티** 제목을 그린다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    expect(view.getByText('유틸리티')).toBeTruthy()
    expect(view.getByTestId('screen-Utility')).toBeTruthy()
  })

  // 껍데기였던 자리다. 도구가 들어왔으니 **개발 진행중** 은 사라져야 한다.
  // 남아 있으면 도구 목록 아래에 "아직 없다"가 함께 서는 화면이 된다.
  it('**개발 진행중** 자리표시자가 더는 없다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    expect(view.queryByText('개발 진행중')).toBeNull()
  })

  it('계산기 타일을 그리고, 누르면 하위 페이지로 민다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    await press(view.getByLabelText(ITEM_SPLIT_TOOL_NAME))

    expect(navigate).toHaveBeenCalledWith('UtilityItemSplit')
  })

  // RN 의 `Text` 는 한글을 글자 단위로 끊는다(`판매 분배금 계 / 산기`). 단어마다 `Text` 를 두고
  // flex 아이템으로 감싸 **아이템 경계에서만** 줄이 바뀌게 한 것이 이 계약이다.
  it('타일 이름은 단어마다 쪼개져 있다. 줄바꿈이 단어 경계에서만 일어나도록', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    for (const word of ITEM_SPLIT_TOOL_NAME.split(' ')) {
      expect(view.getByText(word)).toBeTruthy()
    }
    // 통째로 그리면 글자 단위로 끊긴다. 한 덩어리 노드가 있으면 안 된다.
    expect(view.queryByText(ITEM_SPLIT_TOOL_NAME)).toBeNull()
  })
})
