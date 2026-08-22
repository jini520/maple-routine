// 유틸리티 = **도구 목록**([[ADR-168]] 결정 6).
//
// 이 파일이 지키는 것은 카드 하나가 아니라 **구조**다 — 도구가 유틸리티 화면 안의 카드가 아니라
// 루트 스택에 쌓이는 하위 페이지라는 것. 첫 도구가 정한 이 구조를 뒤에 오는 도구들이 물려받는다.

import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
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

function pressableOf(node: AtomElement | null): AtomElement {
  let current = node
  while (current !== null && current.props.role !== 'button') current = current.parent
  if (current === null) throw new Error('누를 수 있는 자리를 찾지 못했다')
  return current
}

describe('UtilityScreen', () => {
  it('«유틸리티» 제목을 그린다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    expect(view.getByText('유틸리티')).toBeTruthy()
    expect(view.getByTestId('screen-Utility')).toBeTruthy()
  })

  // 껍데기였던 자리다([[ADR-132]] 결정 12). 도구가 들어왔으니 «개발 진행중» 은 사라져야 한다 —
  // 남아 있으면 도구 목록 아래에 "아직 없다"가 함께 서는 화면이 된다.
  it('«개발 진행중» 자리표시자가 더는 없다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    expect(view.queryByText('개발 진행중')).toBeNull()
  })

  it('아이템 분배 계산기를 목록에 그리고, 누르면 하위 페이지로 민다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    await press(pressableOf(view.getByText('아이템 분배 계산기')))

    expect(navigate).toHaveBeenCalledWith('UtilityItemSplit')
  })
})
