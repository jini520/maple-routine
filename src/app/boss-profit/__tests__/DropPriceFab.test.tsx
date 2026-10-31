// 아이템 가격 입력으로 가는 떠 있는 버튼.
//
// **흔들리는 값은 여기서 안 본다**. 값은 `drop-price-fab-motion.ts` 가 들고 그쪽 테스트가 붙든다.
// 여기서 보는 것은 **무엇이 어디에 섰고 누르면 어디로 가는가** 다.
import { act, fireEvent, within } from '@testing-library/react-native'


import { flattenStyle, renderOverlay, 기본테마 } from '../../../components/__tests__/render-atom'
import { getThemeDefinition } from '../../../lib/theme/theme-registry'
import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../../theme/appearance-store'
import { boxShadowOf } from '../../../lib/shadow'
import { FAB_SHADOW } from '../../../lib/fab-metrics'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../native/ports'
import { useUnpricedDropCount } from '../../../features/boss-profit/use-unpriced-drop-count'
import { TAG_SWING_PIVOT } from '../drop-price-fab-motion'
import { DropPriceFab } from '../DropPriceFab'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))
// 배지 수의 원천(창 채우기 · 판 구독)은 그 훅의 테스트가 본다. 여기서는 받은 수를 어떻게 그리는가다.
jest.mock('../../../features/boss-profit/use-unpriced-drop-count', () => ({ useUnpricedDropCount: jest.fn() }))

const navigate = jest.fn()
const PERIOD = '2026-08-06'

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
  jest.mocked(useUnpricedDropCount).mockReturnValue(null)
})

describe('버튼', () => {
  // 보던 주를 넘긴다. 가격 입력 화면이 보스 수익 스토어를 읽으면, 이 화면이 없을 때 남은 낡은
  // 기간으로 열린다(today 에서 열 때).
  it('누르면 보고 있는 주를 들고 하위 페이지로 push 한다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('아이템 가격 입력'))
    })

    expect(navigate).toHaveBeenCalledWith('DropPrice', { cycle: 'weekly', periodKey: PERIOD })
  })
})

// 수익 내역 상자가 미입력 줄을 안 싣는 대신 이 배지가 값이 빈 드롭이 있다는 신호를 받는다.
// 배지는 장식이라(`aria-hidden`) 숨은 요소까지 찾아야 잡힌다. 뜻은 원의 이름이 읽는다.
describe('미입력 건수 배지', () => {
  const 숨김포함 = { includeHiddenElements: true }

  async function 그리기(count: number | null): Promise<Awaited<ReturnType<typeof renderOverlay>>> {
    jest.mocked(useUnpricedDropCount).mockReturnValue(count)
    return renderOverlay(<DropPriceFab periodKey={PERIOD} />)
  }

  function 배지글자(view: Awaited<ReturnType<typeof renderOverlay>>): string {
    const badge = view.getByTestId('drop-price-fab-badge', 숨김포함)
    return String(within(badge).getByText(/./, 숨김포함).props.children)
  }

  it('보고 있는 주로 수를 묻는다', async () => {
    await 그리기(null)

    expect(useUnpricedDropCount).toHaveBeenCalledWith(PERIOD)
  })

  it('모르는 수(null)면 배지가 안 서고 이름만 읽는다', async () => {
    const view = await 그리기(null)

    expect(view.queryByTestId('drop-price-fab-badge', 숨김포함)).toBeNull()
    expect(view.getByLabelText('아이템 가격 입력')).toBeTruthy()
  })

  it('0 건이면 배지가 안 서고 이름만 읽는다', async () => {
    const view = await 그리기(0)

    expect(view.queryByTestId('drop-price-fab-badge', 숨김포함)).toBeNull()
    expect(view.getByLabelText('아이템 가격 입력')).toBeTruthy()
  })

  it('건수를 배지에 적고 이름에 수를 더해 읽는다', async () => {
    const view = await 그리기(3)

    expect(배지글자(view)).toBe('3')
    expect(view.getByLabelText('아이템 가격 입력, 미입력 3건')).toBeTruthy()
  })

  it('9건까지 그대로 적고 10건부터 9+ 로 적는다. 읽는 이름은 실제 수다', async () => {
    expect(배지글자(await 그리기(9))).toBe('9')

    const view = await 그리기(12)
    expect(배지글자(view)).toBe('9+')
    expect(view.getByLabelText('아이템 가격 입력, 미입력 12건')).toBeTruthy()
  })

  // 뜻은 원의 이름이 읽으므로 배지는 눌리는 원 안에 넣지 않는다.
  it('눌리는 원 밖에 선다', async () => {
    const view = await 그리기(3)

    const circle = view.getByLabelText('아이템 가격 입력, 미입력 3건')
    expect(within(circle).queryByTestId('drop-price-fab-badge', 숨김포함)).toBeNull()
    expect(within(view.getByTestId('drop-price-fab')).getByTestId('drop-price-fab-badge', 숨김포함)).toBeTruthy()
  })

  // 한 자리 수는 글자 폭이 높이보다 좁아 최소 너비가 없으면 세로로 긴 타원이 된다. 이 단언이
  // 없던 동안 `min-w-4` 가 스타일을 하나도 안 내고 있었다(그 계단 이름이 없다).
  it('최소 너비가 높이와 같아 한 자리 수가 정원으로 선다', async () => {
    const badge = (await 그리기(3)).getByTestId('drop-price-fab-badge', 숨김포함)

    const style = flattenStyle(badge.props.style)
    expect(style.minWidth).toBe(style.height)
  })
})

// 흔들려도 구멍 자리는 그대로여야 가격표가 걸려 있는 것처럼 보인다.
describe('가격표', () => {
  it('원 안에 태그 아이콘 하나가 구멍을 축으로 선다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)
    const tag = view.getByTestId('drop-price-fab-tag')

    expect(flattenStyle(tag.props.style).transformOrigin).toBe(TAG_SWING_PIVOT)
    expect(within(view.getByLabelText('아이템 가격 입력')).getByTestId('drop-price-fab-tag')).toBeTruthy()
  })
})

// 입체감. 가계부의 ＋ 와 **같은 값**을 쓴다. 둘은 같은 층에 떠 있는 물건이라 같은 높이로 보여야
// 하고, 값을 각자 적어 두면 한쪽만 손볼 때 조용히 갈린다.
describe('떠 있는 원의 입체감', () => {
  afterEach(__resetThemeAppearanceForTest)

  it('그림자는 원을 감싸는 뷰가 든다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    const elevation = flattenStyle(view.getByTestId('drop-price-fab-elevation').props.style)

    expect(elevation.boxShadow).toBe(boxShadowOf(기본테마.shadowColor, FAB_SHADOW))
    expect(elevation.borderRadius).toBe(999)
  })

  it('원 자신은 그림자를 안 든다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(
      flattenStyle(view.getByLabelText('아이템 가격 입력').props.style).boxShadow,
    ).toBeUndefined()
  })

  it('iOS 전용 프롭과 elevation 을 쓰지 않는다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    const elevation = flattenStyle(view.getByTestId('drop-price-fab-elevation').props.style)

    expect(elevation.shadowOpacity).toBeUndefined()
    expect(elevation.shadowRadius).toBeUndefined()
    expect(elevation.elevation).toBeUndefined()
  })

  it('라이트에서는 테두리가 없다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(
      flattenStyle(view.getByLabelText('아이템 가격 입력').props.style).borderWidth,
    ).toBeUndefined()
  })

  it('다크에서도 원에 테두리가 없다', async () => {
    setThemeAppearance('검은마법사', getThemeDefinition('검은마법사'))

    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(flattenStyle(view.getByLabelText('아이템 가격 입력').props.style).borderWidth).toBeUndefined()
  })
})

// 누르면 가격 입력 화면으로 간다. 화면이 바뀌므로 이동 촉각이다.
describe('떠 있는 버튼의 촉각', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(installNoopNativePorts)

  it('누르면 한 번 난다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('아이템 가격 입력'))
    })

    expect(tap).toHaveBeenCalledTimes(1)
  })
})
