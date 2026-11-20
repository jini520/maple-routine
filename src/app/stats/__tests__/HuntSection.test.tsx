import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

import { flattenStyle, renderOverlay, 기본테마, type AtomElement } from '../../../components/__tests__/render-atom'
import type { HuntTotals } from '../../../features/stats/aggregate'
import * as assetLookup from '../../../lib/assets/asset-lookup'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { resolveCardInset } from '../../../theme/theme-vars'
import { HuntSection } from '../HuntSection'

const 기본: HuntTotals = {
  recorded: true,
  sojae: 112,
  manualCount: 12,
  fragments: 10_512,
  heldFragments: 7_512,
  huntMeso: 12_410_000_000,
  fragmentSaleMeso: 477_000_000,
  lootSaleMeso: 233_000_000,
  totalMeso: 13_120_000_000,
}

function opacityOf(element: { props: { style?: unknown } }): unknown {
  return StyleSheet.flatten(element.props.style as StyleProp<ViewStyle>)?.opacity
}

/** 글자에서 위로 올라가 처음 만나는 바탕색. 타일에 바탕이 없으면 카드의 바탕색이 나온다 */
function backgroundOf(element: AtomElement): unknown {
  let node: AtomElement | null = element
  while (node !== null) {
    const color = flattenStyle(node.props.style).backgroundColor
    if (color !== undefined) return color
    node = node.parent
  }
  return undefined
}

/** 숨긴 글자 · 장식 그림도 찾는다. 보이지 않게 그린 것이 자리를 잡는지가 확인할 일이다 */
const HIDDEN_TOO = { includeHiddenElements: true }

beforeEach(() => {
  installNoopNativePorts()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('HuntSection', () => {
  it('타일 둘과 설명 줄 · 합계를 적는다', async () => {
    const view = await renderOverlay(<HuntSection totals={기본} />)

    expect(view.getByTestId('stats-hunt-sojae')).toHaveTextContent('112소재')
    expect(view.getByTestId('stats-hunt-manual').props.children).toBe('직접 입력 12건')
    expect(view.getByTestId('stats-hunt-fragments')).toHaveTextContent('조각 10,512개')
    expect(view.getByTestId('stats-hunt-held').props.children).toBe('보유 조각 7,512개')
    expect(view.getByTestId('stats-hunt-breakdown').props.children).toBe(
      '사냥 메소 124.1억 · 조각 판매 4.77억 · 전리품 판매 2.33억',
    )
    expect(view.getByTestId('stats-hunt-total')).toHaveTextContent('131.2억 메소')
  })

  // 카드 안 칸은 앱 어디서나 card-inset 이다. card-body 는 다크에서 카드보다 어두워 칸이 파여 보인다
  it('소재 · 조각 타일은 card-inset 칸이다', async () => {
    const view = await renderOverlay(<HuntSection totals={기본} />)

    for (const testID of ['stats-hunt-sojae', 'stats-hunt-fragments']) {
      expect(backgroundOf(view.getByTestId(testID))).toBe(resolveCardInset(기본테마))
    }
  })

  // 줄이 생기고 사라지면 기간을 옮길 때마다 아래 카드가 움직인다
  it('0 인 둘째 줄은 글자를 숨기고 자리는 남긴다', async () => {
    const view = await renderOverlay(<HuntSection totals={{ ...기본, manualCount: 0, heldFragments: 0 }} />)

    expect(opacityOf(view.getByTestId('stats-hunt-manual', HIDDEN_TOO))).toBe(0)
    expect(opacityOf(view.getByTestId('stats-hunt-held', HIDDEN_TOO))).toBe(0)
    expect(opacityOf(view.getByTestId('stats-hunt-sojae'))).not.toBe(0)
  })

  // 합계만 있으면 순수 사냥 메소인지 판매 대금이 섞였는지 알 수 없다
  it('판매 대금이 0 인 항목은 설명 줄에서 빠지고 사냥 메소는 0 이어도 선다', async () => {
    const lootOnly = { ...기본, huntMeso: 0, fragmentSaleMeso: 0, lootSaleMeso: 30_000_000, totalMeso: 30_000_000 }
    const view = await renderOverlay(<HuntSection totals={lootOnly} />)

    expect(view.getByTestId('stats-hunt-breakdown').props.children).toBe('사냥 메소 0 · 전리품 판매 3,000만')
  })

  it('기록이 없는 기간은 문구를 적고, 같은 높이를 잡는 본문을 보이지 않게 그린다', async () => {
    const empty: HuntTotals = {
      recorded: false,
      sojae: 0,
      manualCount: 0,
      fragments: 0,
      heldFragments: 0,
      huntMeso: 0,
      fragmentSaleMeso: 0,
      lootSaleMeso: 0,
      totalMeso: 0,
    }
    const view = await renderOverlay(<HuntSection totals={empty} />)

    expect(view.getByText('이 기간에 사냥 기록이 없어요')).toBeTruthy()
    expect(opacityOf(view.getByTestId('stats-hunt-body', HIDDEN_TOO))).toBe(0)
  })

  // 폭 375 에서 둘째 줄이 쓸 수 있는 폭은 93.5 라서 개수가 크면 넘친다
  it('타일의 큰 값과 둘째 줄은 한 줄이고 넘치면 글자를 줄인다', async () => {
    const view = await renderOverlay(<HuntSection totals={기본} />)

    for (const testID of ['stats-hunt-sojae', 'stats-hunt-manual', 'stats-hunt-fragments', 'stats-hunt-held']) {
      const line = view.getByTestId(testID)
      expect([testID, line.props.numberOfLines, line.props.adjustsFontSizeToFit]).toEqual([testID, 1, true])
    }
  })

  // 그림이 있고 없음에 따라 숫자가 서는 가로 자리가 바뀌지 않게 한다
  it('그림을 못 찾아도 그림 자리는 남는다', async () => {
    jest.spyOn(assetLookup, 'mesoBoostIconOf').mockReturnValue(null)
    jest.spyOn(assetLookup, 'solErdaFragmentIcon').mockReturnValue(null)
    const view = await renderOverlay(<HuntSection totals={기본} />)

    for (const testID of ['stats-hunt-icon-potion', 'stats-hunt-icon-fragment']) {
      const icon = view.getByTestId(testID, HIDDEN_TOO)
      const { width, height } = StyleSheet.flatten(icon.props.style)
      expect([testID, icon.props.source, width, height]).toEqual([testID, undefined, 26, 26])
    }
  })
})
