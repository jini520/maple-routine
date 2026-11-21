import { assetIdOfPath } from '../../../../assets/__tests__/asset-uri'
import { useState } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../../../theme/appearance-store'
import { buildSheetScopeVariables } from '../../../../theme/theme-vars'
import { flattenStyle, renderOverlay, 기본테마, type AtomElement } from '../../../__tests__/render-atom'
import { crystalPayoutMeso } from '../../../../lib/boss/party-shares'
import { PartySizeModal } from '../PartySizeModal'

type Props = React.ComponentProps<typeof PartySizeModal>

/** 비율을 안 쓰는 파티. 칸 다섯이 전부 null 이다. */
const EVEN_SHARES = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    bossName: '스우',
    portraitAssetId: assetIdOfPath('bosses/lotus.webp') ?? null,
    difficulties: ['normal', 'hard', 'extreme'],
    difficulty: 'hard',
    partySize: 4,
    maxPartySize: 6,
    shares: EVEN_SHARES,
    onSelectDifficulty: jest.fn(),
    onApply: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  }
}

/**
 * 난이도를 들고 있는 호출부. 모달은 난이도를 자기가 안 쥐고 프롭으로 받으므로, 그것이 바뀔 때
 * 초안이 다시 뜨는지는 이 배선이 있어야 잰다.
 */
function DifficultyHost(hostProps: { onApply: Props['onApply'] }): React.JSX.Element {
  const [difficulty, setDifficulty] = useState<Props['difficulty']>('hard')
  return (
    <PartySizeModal
      {...props({ onApply: hostProps.onApply })}
      difficulty={difficulty}
      partySize={difficulty === 'hard' ? 4 : 2}
      maxPartySize={difficulty === 'hard' ? 6 : 2}
      onSelectDifficulty={setDifficulty}
    />
  )
}

interface State {
  selected?: boolean
  disabled?: boolean
}

function stateOf(node: AtomElement): State {
  return (node.props.accessibilityState ?? {}) as State
}

/** 난이도 고르개를 펼치고 그 난이도를 고른다. 고르개는 접힌 동안 고른 난이도 하나만 보인다. */
async function pickDifficulty(getByLabelText: (label: string | RegExp) => AtomElement, name: string): Promise<void> {
  await fireEvent.press(getByLabelText(/^스우 난이도 .+, 눌러서 바꾸기$/))
  await fireEvent.press(getByLabelText(`스우 ${name}`))
}

describe('PartySizeModal', () => {
  it('난이도 고르개가 현재 난이도로 접혀 있고, 펼치면 지원 난이도를 모두 보인다', async () => {
    const { getByLabelText, getAllByRole } = await renderOverlay(<PartySizeModal {...props()} />)

    await fireEvent.press(getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))

    expect(getAllByRole('radio')).toHaveLength(3)
    expect(getByLabelText('스우 하드').props.accessibilityState.checked).toBe(true)
  })

  // 행이 난이도를 정하는 곳(보스 관리 · 보스 수익 행 · 계산기)에서 연 모달은 난이도를 바꿀 수 없다.
  // 고르개를 세우면 눌러도 바뀌지 않는 고르개가 된다.
  it('onSelectDifficulty 가 없으면 고르개 없이 난이도 배지만 선다', async () => {
    const { getByText, queryByLabelText } = await renderOverlay(
      <PartySizeModal {...props({ onSelectDifficulty: undefined })} />,
    )

    expect(getByText('하드')).toBeTruthy()
    expect(queryByLabelText(/^스우 난이도 /)).toBeNull()
  })

  it('다른 난이도를 누르면 onSelectDifficulty 를 부른다', async () => {
    const p = props()
    const { getByLabelText } = await renderOverlay(<PartySizeModal {...p} />)

    await pickDifficulty(getByLabelText, '익스트림')

    expect(p.onSelectDifficulty).toHaveBeenCalledWith('extreme')
  })

  // 파티 인원은 (보스 + 난이도)에 붙어 있다. 스우는 하드 6인, 익스트림 2인. 스테퍼는 그 수를
  // 못 말하므로 배지가 옆에서 말한다.
  it.each([
    [{}, '최대 6명'],
    [{ difficulty: 'extreme' as const, partySize: 1, maxPartySize: 2 }, '최대 2명'],
  ])('상한을 배지로 말한다 (%#)', async (overrides, expected) => {
    const { getByText } = await renderOverlay(<PartySizeModal {...props(overrides)} />)

    expect(getByText(expected)).toBeTruthy()
  })

  // 값은 모달 안에 머문다. 밖으로 나가는 길은 적용 하나다.
  it('인원을 바꿔도 적용 전에는 아무것도 안 나간다', async () => {
    const p = props()
    const { getByLabelText } = await renderOverlay(<PartySizeModal {...p} />)

    await fireEvent.press(getByLabelText('스우 파티원 수 증가'))

    expect(p.onApply).not.toHaveBeenCalled()
  })

  it('적용을 누르면 고친 인원이 한 번에 나간다', async () => {
    const p = props()
    const { getByLabelText, getByText } = await renderOverlay(<PartySizeModal {...p} />)

    await fireEvent.press(getByLabelText('스우 파티원 수 증가'))
    await fireEvent.press(getByText('적용'))

    expect(p.onApply).toHaveBeenCalledWith({ partySize: 5, shares: EVEN_SHARES })
  })

  // 적용을 안 눌렀으면 버린다(사용자 결정). 닫기는 저장하는 길이 아니다.
  it('닫으면 고친 값을 안 내보낸다', async () => {
    const p = props()
    const { getByLabelText } = await renderOverlay(<PartySizeModal {...p} />)

    await fireEvent.press(getByLabelText('스우 파티원 수 증가'))
    await fireEvent.press(getByLabelText('닫기'))

    expect(p.onApply).not.toHaveBeenCalled()
    expect(p.onClose).toHaveBeenCalled()
  })

  it('상한에서 + 가 비활성이다', async () => {
    const { getByLabelText } = await renderOverlay(
      <PartySizeModal {...props({ difficulty: 'extreme', partySize: 2, maxPartySize: 2 })} />,
    )

    expect(stateOf(getByLabelText('스우 파티원 수 증가')).disabled).toBe(true)
  })

  // 일러스트 띠가 머리를 높이 104 로 키워 모달이 컸다(사용자 지적). 머리는 원형 초상화와 이름뿐이다.
  it('머리에 원형 초상화와 이름이 서고 일러스트 띠는 없다', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(getByTestId('boss-portrait')).toBeTruthy()
    expect(getByText('스우')).toBeTruthy()
    expect(queryByTestId('party-modal-art', { includeHiddenElements: true })).toBeNull()
  })

  it('난이도가 하나뿐인 보스도 고르개를 그린다', async () => {
    const { getByLabelText } = await renderOverlay(
      <PartySizeModal {...props({ difficulties: ['chaos'], difficulty: 'chaos' })} />,
    )

    expect(getByLabelText('스우 난이도 카오스, 눌러서 바꾸기')).toBeTruthy()
  })
})

describe('분배 비율', () => {
  it('`기본` 이면 결정석 % 칸이 안 선다. 균등으로 잡는 대다수가 안 지난다', async () => {
    const { queryByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(queryByTestId('party-share-percent')).toBeNull()
  })

  // 반반(1:2)은 2인 균등과 같은 값이라 켠 티가 안 난다. 비율을 켰으면 뜻이 있는 값이어야 한다.
  it('비율로 갈아타면 2 / 3 이 놓이고 송금 수수료는 자동이다', async () => {
    const onApply = jest.fn()
    const { getByLabelText, getByTestId, getByText } = await renderOverlay(
      <PartySizeModal {...props({ onApply, autoFee: { grade: 'diamond', percent: 3 } })} />,
    )

    await fireEvent.press(getByLabelText('비율'))
    expect(getByTestId('party-share-percent').props.value).toBe('66.667')
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({
      partySize: 4,
      shares: {
        crystalMyShare: 2,
        crystalSharesTotal: 3,
        // 자동이면 요율은 그 등급 요율이다. 보스 수익 행이 이 값으로 그 기록을 다시 센다.
        splitFeePercent: 3,
        splitFeeAuto: true,
      },
    })
  })

  it('자동이면 명패와 요율이 서고, 끄면 그 요율을 고른 0 · 3 · 5 가 선다', async () => {
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3, splitFeeAuto: true }
    const { getByLabelText, getByRole, queryByText } = await renderOverlay(
      <PartySizeModal {...props({ shares, autoFee: { grade: 'gold', percent: 3 } })} />,
    )

    expect(getByLabelText('MVP 골드')).toBeTruthy()
    expect(queryByText('0%')).toBeNull()

    await fireEvent.press(getByRole('checkbox'))

    expect(getByLabelText('3%').props.accessibilityState?.selected).toBe(true)
  })

  // 비율은 `나 : 나머지` 라 두 쪽이다. 몇 명이 그 나머지를 이루는지는 금액에 안 들어가므로,
  // 남겨 두면 아무것도 안 바꾸는 고르개가 모달에 서 있게 된다.
  it('비율을 켜면 파티 인원 줄이 사라진다', async () => {
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3 }
    const { queryByLabelText, queryByText } = await renderOverlay(<PartySizeModal {...props({ shares })} />)

    expect(queryByText('파티 인원')).toBeNull()
    expect(queryByLabelText('스우 파티원 수 증가')).toBeNull()
  })

  it('비율을 끄면 파티 인원 줄이 돌아온다', async () => {
    const { getByLabelText, getByText } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(getByText('파티 인원')).toBeTruthy()
    expect(getByLabelText('스우 파티원 수 증가')).toBeTruthy()
  })

  it('결정석 % 칸은 저장된 비율을 셋째 자리까지 적는다', async () => {
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3 }
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props({ shares })} />)

    expect(getByTestId('party-share-percent').props.value).toBe('66.667')
  })

  // 친 % 는 비율 합 100000 으로 담는다. 부동소수로 옮기면 33.333 이 33332 가 된다.
  it('친 % 를 적용하면 % × 1000 · 100000 으로 내보낸다', async () => {
    const onApply = jest.fn()
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 3 }
    const { getByTestId, getByText } = await renderOverlay(<PartySizeModal {...props({ shares, onApply })} />)

    await fireEvent.changeText(getByTestId('party-share-percent'), '33.333')
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({
      partySize: 4,
      shares: expect.objectContaining({ crystalMyShare: 33_333, crystalSharesTotal: 100_000 }),
    })
  })

  it('넷째 자리와 100 을 넘는 값은 칸에 들어가지 않는다', async () => {
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3 }
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props({ shares })} />)

    await fireEvent.changeText(getByTestId('party-share-percent'), '33.333')
    await fireEvent.changeText(getByTestId('party-share-percent'), '33.3333')
    expect(getByTestId('party-share-percent').props.value).toBe('33.333')

    await fireEvent.changeText(getByTestId('party-share-percent'), '101')
    expect(getByTestId('party-share-percent').props.value).toBe('33.333')
  })

  it('기본으로 갈아타면 비율 칸을 전부 비운다. 되돌리는 길이 이것뿐이다', async () => {
    const onApply = jest.fn()
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3 }
    const { getByLabelText, getByText } = await renderOverlay(
      <PartySizeModal {...props({ shares, onApply })} />,
    )

    await fireEvent.press(getByLabelText('기본'))
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ shares: EVEN_SHARES }))
  })


  it('송금 수수료는 0 · 3 · 5 셋이고 고르면 그 값이 간다', async () => {
    const onApply = jest.fn()
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 3, splitFeeAuto: false }
    const { getByText } = await renderOverlay(<PartySizeModal {...props({ shares, onApply })} />)

    expect(getByText('0%')).toBeTruthy()
    expect(getByText('5%')).toBeTruthy()

    await fireEvent.press(getByText('0%'))
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({
      partySize: 4,
      shares: expect.objectContaining({ splitFeePercent: 0, splitFeeAuto: false }),
    })
  })

  // 난이도마다 인원 상한과 비율이 따로 산다(스우 하드 6인 · 익스트림 2인). 옛 난이도에서
  // 고치던 값이 남으면 적용이 남의 값을 쓴다.
  it('난이도가 바뀌면 초안을 그 난이도의 저장값으로 다시 뜬다', async () => {
    const onApply = jest.fn()
    const { getByLabelText, getByText } = await renderOverlay(<DifficultyHost onApply={onApply} />)

    await fireEvent.press(getByLabelText('스우 파티원 수 증가'))
    await pickDifficulty(getByLabelText, '익스트림')
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({ partySize: 2, shares: EVEN_SHARES })
  })
})

// 다른 가운데 모달과 같은 패널이다. 테두리 없이 바탕색 차이로만 스크림과 갈리고, 다크에서는 표면을 한 칸 올려 가장자리가 스크림에 안 묻힌다.
describe('분배 방식 `제외`', () => {
  // 나눌 결정석이 없어서 셋 다 금액을 안 바꾼다.
  it('`제외` 를 고르면 인원 · 비율 · 송금 수수료 줄이 모두 사라진다', async () => {
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3 }
    const { getByLabelText, queryByTestId, queryByText } = await renderOverlay(<PartySizeModal {...props({ shares })} />)

    await fireEvent.press(getByLabelText('제외'))

    expect(getByLabelText('제외').props.accessibilityState?.selected).toBe(true)
    expect(queryByText('파티 인원')).toBeNull()
    expect(queryByTestId('party-share-percent')).toBeNull()
    expect(queryByText('수수료')).toBeNull()
  })

  // `제외` 를 고르면 그 전의 인원 · 비율 · 송금 수수료를 지운다. 인원이 없으니 솔로로 다룬다.
  it('적용하면 인원 · 비율 · 수수료를 비운 솔로 `제외` 를 내보낸다', async () => {
    const onApply = jest.fn()
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 3 }
    const { getByLabelText, getByText } = await renderOverlay(<PartySizeModal {...props({ shares, onApply })} />)

    await fireEvent.press(getByLabelText('제외'))
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({ partySize: 1, shares: { ...EVEN_SHARES, crystalExcluded: true } })
  })

  // 다시 `기본` 이나 `비율` 을 고르면 옛 값을 되살리지 않고 새로 정한다.
  it('`제외` 를 골랐다가 `기본` 을 고르면 솔로에서 새로 정한다', async () => {
    const onApply = jest.fn()
    const { getByLabelText, getByText } = await renderOverlay(<PartySizeModal {...props({ onApply })} />)

    await fireEvent.press(getByLabelText('제외'))
    await fireEvent.press(getByLabelText('기본'))
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({ partySize: 1, shares: expect.not.objectContaining({ crystalExcluded: true }) })
  })

  it('`제외` 를 골랐다가 `비율` 을 고르면 옛 비율 대신 처음 비율에서 새로 정한다', async () => {
    const shares = { ...EVEN_SHARES, crystalMyShare: 1, crystalSharesTotal: 4 }
    const { getByLabelText, getByTestId } = await renderOverlay(<PartySizeModal {...props({ shares })} />)

    await fireEvent.press(getByLabelText('제외'))
    await fireEvent.press(getByLabelText('비율'))

    expect(getByTestId('party-share-percent').props.value).toBe('66.667')
  })
})

describe('받는 금액', () => {
  const PRICE = 3_000_000_000

  it('인원 · % · 송금 수수료를 고칠 때마다 다시 센다', async () => {
    const { getByLabelText, getByRole, getByTestId } = await renderOverlay(
      <PartySizeModal {...props({ crystalPriceMeso: PRICE, autoFee: { grade: 'gold', percent: 3 } })} />,
    )
    const amount = () => getByTestId('party-payout')
    const 메소 = (meso: number) => `${meso.toLocaleString()} 메소`

    expect(amount()).toHaveTextContent(메소(PRICE / 4))
    await fireEvent.press(getByLabelText('스우 파티원 수 증가'))
    expect(amount()).toHaveTextContent(메소(PRICE / 5))

    await fireEvent.press(getByLabelText('비율'))
    await fireEvent.changeText(getByTestId('party-share-percent'), '85')
    const 자동 = crystalPayoutMeso(PRICE, 2, { myShare: 85_000, sharesTotal: 100_000, splitFeePercent: 3 })
    expect(amount()).toHaveTextContent(메소(자동))

    await fireEvent.press(getByRole('checkbox'))
    await fireEvent.press(getByLabelText('5%'))
    const 오퍼센트 = crystalPayoutMeso(PRICE, 2, { myShare: 85_000, sharesTotal: 100_000, splitFeePercent: 5 })
    expect(오퍼센트).not.toBe(자동)
    expect(amount()).toHaveTextContent(메소(오퍼센트))
  })

  // 모르는 가격을 0 메소로 적으면 받는 돈이 없는 것처럼 읽힌다.
  it('결정석 가격을 모르면 줄이 없다', async () => {
    const { queryByText } = await renderOverlay(<PartySizeModal {...props({ crystalPriceMeso: null })} />)

    expect(queryByText('받는 금액')).toBeNull()
  })

  it('`제외` 면 줄이 없다. 판 결정석이 없다', async () => {
    const { getByLabelText, getByText, queryByText } = await renderOverlay(
      <PartySizeModal {...props({ crystalPriceMeso: PRICE })} />,
    )

    expect(getByText('받는 금액')).toBeTruthy()
    await fireEvent.press(getByLabelText('제외'))
    expect(queryByText('받는 금액')).toBeNull()
  })
})

describe('패널', () => {
  const 검은마법사 = getThemeDefinition('검은마법사')

  beforeEach(__resetThemeAppearanceForTest)
  afterEach(__resetThemeAppearanceForTest)

  it('테두리가 없다', async () => {
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(flattenStyle(getByTestId('party-size-panel').props.style).borderWidth ?? 0).toBe(0)
  })

  it('다크에서는 표면을 올린 값으로 칠하고 라이트에서는 그대로 둔다', async () => {
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props()} />)
    expect(flattenStyle(getByTestId('party-size-panel').props.style).backgroundColor).toBe(기본테마.surface)

    await act(async () => {
      setThemeAppearance('검은마법사', 검은마법사)
    })

    const lifted = buildSheetScopeVariables(검은마법사)['--color-surface']
    expect(flattenStyle(getByTestId('party-size-panel').props.style).backgroundColor).toBe(lifted)
    // 이 단언에 판별력이 있으려면 올린 값이 원래 값과 달라야 한다.
    expect(lifted).not.toBe(검은마법사.surface)
  })
})
