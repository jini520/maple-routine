// 유틸리티 = **도구 목록**.
//
// 이 파일이 지키는 것은 카드 하나가 아니라 **구조**다. 도구가 유틸리티 화면 안의 카드가 아니라
// 루트 스택에 쌓이는 하위 페이지라는 것. 첫 도구가 정한 이 구조를 뒤에 오는 도구들이 물려받는다.

import { act, fireEvent, within } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { BOSS_PROFIT_CALCULATOR_TOOL_NAME, ITEM_SPLIT_TOOL_NAME, MASPI_TOOL_NAME } from '../tool-names'
import { UtilityScreen } from '../UtilityScreen'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

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
  it('계산기 카드를 그리고, 누르면 하위 페이지로 민다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    await press(view.getByLabelText(ITEM_SPLIT_TOOL_NAME))
    expect(navigate).toHaveBeenCalledWith('UtilityItemSplit')

    await press(view.getByLabelText(BOSS_PROFIT_CALCULATOR_TOOL_NAME))
    expect(navigate).toHaveBeenCalledWith('UtilityBossProfitCalculator')
  })

  // MASPI 는 시세를 보는 도구라 금액을 따지는 두 계산기와 분류가 다르다. `데이터` 가 위다.
  it('데이터 분류의 MASPI 가 맨 위이고 계산기 분류가 그 아래다. MASPI 를 누르면 MASPI 화면을 민다', async () => {
    const view = await renderOverlay(<UtilityScreen />)
    const tree = JSON.stringify(view.toJSON())

    expect(tree.indexOf('"데이터"')).toBeLessThan(tree.indexOf(`"${MASPI_TOOL_NAME}"`))
    expect(tree.indexOf(`"${MASPI_TOOL_NAME}"`)).toBeLessThan(tree.indexOf('"계산기"'))
    expect(tree.indexOf('"계산기"')).toBeLessThan(tree.indexOf('"판매"'))

    await press(view.getByLabelText(MASPI_TOOL_NAME))
    expect(navigate).toHaveBeenCalledWith('UtilityMaspi')
  })

  // MASPI 는 베타 기능이라 카드 이름 옆에 `beta` 배지가 선다. 두 계산기는 베타가 아니다.
  it('MASPI 카드에만 이름 옆 `beta` 배지가 서고 두 계산기 카드에는 서지 않는다', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    expect(within(view.getByLabelText(MASPI_TOOL_NAME)).getByText('beta')).toBeTruthy()
    expect(within(view.getByLabelText(ITEM_SPLIT_TOOL_NAME)).queryByText('beta')).toBeNull()
    expect(within(view.getByLabelText(BOSS_PROFIT_CALCULATOR_TOOL_NAME)).queryByText('beta')).toBeNull()
  })

  // RN 의 `Text` 는 한글을 글자 단위로 끊는다(`판매 분배금 계 / 산기`). 단어마다 `Text` 를 두고
  // flex 아이템으로 감싸 **아이템 경계에서만** 줄이 바뀌게 한 것이 이 계약이다.
  it('카드 이름은 단어마다 쪼개져 있다. 줄바꿈이 단어 경계에서만 일어나도록', async () => {
    const view = await renderOverlay(<UtilityScreen />)

    // `계산기` 는 두 카드에 다 있다.
    for (const word of ITEM_SPLIT_TOOL_NAME.split(' ')) {
      expect(view.getAllByText(word).length).toBeGreaterThan(0)
    }
    // 통째로 그리면 글자 단위로 끊긴다. 한 덩어리 노드가 있으면 안 된다.
    expect(view.queryByText(ITEM_SPLIT_TOOL_NAME)).toBeNull()
  })

  // 카드는 이름 아래에 무엇을 하는 도구인지 두 줄로 적는다. 줄은 정해 둔 자리에서만 바뀌고, 줄 안에서도
  // 이름처럼 단어 경계에서만 끊긴다. 스크린리더는 이름을 읽은 뒤 설명을 힌트로 읽는다.
  it.each([
    [MASPI_TOOL_NAME, ['드롭 아이템 시세와', 'MASPI 지수를 매일 확인해요']],
    [ITEM_SPLIT_TOOL_NAME, ['수수료를 떼고도 똑같이 나누려면', '얼마를 보낼지 알려 줘요']],
    [BOSS_PROFIT_CALCULATOR_TOOL_NAME, ['캐릭터마다 보스를 골라', '한 주 수입을 미리 따져 봐요']],
  ])('%s 카드는 이름 아래에 설명 두 줄을 단어 단위로 적고, 설명을 스크린리더 힌트로 준다', async (name, lines) => {
    const view = await renderOverlay(<UtilityScreen />)
    const card = view.getByLabelText(name)

    expect(card.props.accessibilityHint).toBe(lines.join(' '))
    const rows = within(card).getAllByTestId('tool-description-line')
    expect(rows).toHaveLength(lines.length)
    rows.forEach((row, index) => {
      for (const word of lines[index].split(' ')) {
        expect(within(row).getAllByText(word).length).toBeGreaterThan(0)
      }
      expect(within(row).queryByText(lines[index])).toBeNull()
    })
  })
})
