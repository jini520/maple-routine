// 아이템 분배 계산기 화면([[ADR-168]]).
//
// 계산 자체의 불변식은 `lib/__tests__/item-split.test.ts` 가 진다. 여기서 보는 것은 **배선**이다 —
// 어느 입력이 어느 인자로 가는가, 그리고 결과가 없는 두 자리(1인 파티 · 판매가 0)에서 화면이
// 숫자 대신 무엇을 말하는가.

import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
import { ItemSplitScreen } from '../ItemSplitScreen'
import { ITEM_SPLIT_TOOL_NAME } from '../tool-names'

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedUseScreenNavigation = jest.mocked(useScreenNavigation)
const goBack = jest.fn()

beforeEach(() => {
  mockedUseScreenNavigation.mockReturnValue({ goBack } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

async function typeSalePrice(view: Rendered, digits: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByLabelText('판매가'), digits)
  })
}

function transferText(view: Rendered): string {
  return view.getByTestId('item-split-transfer').props.children as string
}

function pressableOf(node: AtomElement | null): AtomElement {
  let current = node
  while (current !== null && current.props.role !== 'button') current = current.parent
  if (current === null) throw new Error('누를 수 있는 자리를 찾지 못했다')
  return current
}

describe('ItemSplitScreen — 골격', () => {
  it('제목과 뒤로 버튼을 그리고, 뒤로를 누르면 pop 한다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)

    // 타일과 같은 글자여야 한다 — `tool-names` 한 벌에서 온다.
    expect(view.getByText(ITEM_SPLIT_TOOL_NAME)).toBeTruthy()
    expect(view.getByTestId('screen-UtilityItemSplit')).toBeTruthy()
    expect(view.getByText('정산 금액')).toBeTruthy()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })
})

describe('ItemSplitScreen — 결과', () => {
  // 기본값은 **2인** · 판매 3% · 분배 3% 다(사용자 지정) — ⌊97,000,000,000 / 197⌋.
  // [[ADR-168]] 결정 2 표의 6인 예시는 `lib/__tests__/item-split.test.ts` 가 고정한다.
  it('판매가 10억을 넣으면 492,385,786 을 보내라고 한다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)

    await typeSalePrice(view, '1000000000')

    expect(transferText(view)).toBe('492,385,786')
  })

  // 분배 수수료가 오르면 **더 많이** 보내야 받는 사람 손에 같은 금액이 남는다 — 이 방향이
  // 뒤집히면 계산기가 정반대 조언을 하는 것이다.
  it('분배 수수료를 5% 로 올리면 보낼 금액이 는다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)
    await typeSalePrice(view, '1000000000')

    await press(view.getByLabelText('분배 수수료 5%'))

    expect(transferText(view)).toBe('497,435,897')
  })

  // 판매 수수료는 정산 대상 자체를 줄이므로 보낼 금액도 준다.
  it('판매 수수료를 5% 로 올리면 보낼 금액이 준다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)
    await typeSalePrice(view, '1000000000')

    await press(view.getByLabelText('판매 수수료 5%'))

    expect(transferText(view)).toBe('482,233,502')
  })

  it('파티원 수를 늘리면 1인당 보낼 금액이 준다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)
    await typeSalePrice(view, '1000000000')

    await press(view.getByLabelText('분배 파티원 수 증가'))

    // 3인 · 판매 3% · 분배 3% — ⌊97,000,000,000 / 297⌋
    expect(transferText(view)).toBe('326,599,326')
  })
})

describe('ItemSplitScreen — 결과가 없는 두 자리', () => {
  it('판매가가 비어 있으면 숫자 대신 입력을 청한다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)

    expect(view.queryByTestId('item-split-transfer')).toBeNull()
    expect(view.getByText('판매가를 입력하세요')).toBeTruthy()
  })

  // 1인이면 보낼 곳이 없다 — `transferPerMember` 가 `null` 을 주는 유일한 경우다.
  it('파티원이 1인이면 나눌 것이 없다고 말한다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)
    await typeSalePrice(view, '1000000000')

    await press(view.getByLabelText('분배 파티원 수 감소'))

    expect(view.queryByTestId('item-split-transfer')).toBeNull()
    expect(view.getByText('혼자서는 나눌 것이 없습니다')).toBeTruthy()
  })
})

describe('ItemSplitScreen — 금액 입력 ([[ADR-168]] 결정 9)', () => {
  // 칩이 자릿수 눈금이다 — 키패드를 두 벌 만들지 않는 대신 이것을 가져왔다.
  it('단위 칩이 금액을 더한다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)

    await press(pressableOf(view.getByText('+1억')))
    await press(pressableOf(view.getByText('+1억')))

    expect(view.getByLabelText('판매가').props.value).toBe('200,000,000')
  })

  // 조건부로 그리면 첫 글자를 치는 순간 줄이 생겨 아래 카드가 통째로 밀린다(사용자 지정).
  it('단위 줄은 금액이 비어 있어도 자리를 지킨다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)

    expect(view.getByTestId('item-split-sale-price-units').props.children).toBe(' ')

    await typeSalePrice(view, '100000000')

    expect(view.getByTestId('item-split-sale-price-units').props.children).toBe('1억')
  })

  it('숫자가 아닌 글자는 흘린다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)

    await typeSalePrice(view, '1,000,000a')

    expect(view.getByLabelText('판매가').props.value).toBe('1,000,000')
  })

  // [[ADR-168]] 결정 10 — 상한을 넘기면 `N × 100` 이 안전 정수를 벗어나 계산이 조용히 틀린다.
  it('상한을 넘는 입력은 상한에서 멈춘다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)

    await typeSalePrice(view, '99999999999999999')

    expect(view.getByLabelText('판매가').props.value).toBe('9,999,999,999,999')
  })

  it('초기화가 금액을 비운다', async () => {
    const view = await renderOverlay(<ItemSplitScreen />)
    await typeSalePrice(view, '1000000000')

    await press(view.getByLabelText('금액 초기화'))

    expect(view.getByLabelText('판매가').props.value).toBe('')
  })
})
