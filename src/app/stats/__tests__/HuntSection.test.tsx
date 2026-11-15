import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { HuntTotals } from '../../../features/stats/aggregate'
import * as assetLookup from '../../../lib/assets/asset-lookup'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { HuntSection } from '../HuntSection'

const 기본: HuntTotals = {
  recorded: true,
  sojae: 112,
  manualCount: 12,
  fragments: 10_512,
  unsoldFragments: 7_512,
  huntMeso: 12_410_000_000,
  fragmentSaleMeso: 477_000_000,
  lootSaleMeso: 233_000_000,
  totalMeso: 13_120_000_000,
}

function opacityOf(element: { props: { style?: unknown } }): unknown {
  return StyleSheet.flatten(element.props.style as StyleProp<ViewStyle>)?.opacity
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
    expect(view.getByTestId('stats-hunt-unsold').props.children).toBe('미판매 조각 7,512개')
    expect(view.getByTestId('stats-hunt-breakdown').props.children).toBe(
      '사냥 메소 124.1억 · 조각 판매 4.77억 · 전리품 판매 2.33억',
    )
    expect(view.getByTestId('stats-hunt-total')).toHaveTextContent('131.2억 메소')
  })

  // 줄이 생기고 사라지면 기간을 옮길 때마다 아래 카드가 움직인다
  it('0 인 둘째 줄은 글자를 숨기고 자리는 남긴다', async () => {
    const view = await renderOverlay(<HuntSection totals={{ ...기본, manualCount: 0, unsoldFragments: 0 }} />)

    expect(opacityOf(view.getByTestId('stats-hunt-manual', HIDDEN_TOO))).toBe(0)
    expect(opacityOf(view.getByTestId('stats-hunt-unsold', HIDDEN_TOO))).toBe(0)
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
      unsoldFragments: 0,
      huntMeso: 0,
      fragmentSaleMeso: 0,
      lootSaleMeso: 0,
      totalMeso: 0,
    }
    const view = await renderOverlay(<HuntSection totals={empty} />)

    expect(view.getByText('이 기간에 사냥 기록이 없어요')).toBeTruthy()
    expect(opacityOf(view.getByTestId('stats-hunt-body', HIDDEN_TOO))).toBe(0)
  })

  // 폭 375 에서 둘째 줄이 쓸 수 있는 폭은 93.5 라서 `미판매 조각 7,512개` 부터 넘친다
  it('타일의 큰 값과 둘째 줄은 한 줄이고 넘치면 글자를 줄인다', async () => {
    const view = await renderOverlay(<HuntSection totals={기본} />)

    for (const testID of ['stats-hunt-sojae', 'stats-hunt-manual', 'stats-hunt-fragments', 'stats-hunt-unsold']) {
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
