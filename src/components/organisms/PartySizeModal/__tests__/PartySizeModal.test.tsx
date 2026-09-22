// 갈린 케이스 둘만 적는다.
//
// *"일러스트가 있으면 카드와 같은 필터·불투명도로 그린다"* → **온전히 성립한다.**
//   3단계는 자리만 만들고 그림을 못 앉혔는데(크롭의 CSS 값을 RN 기하로 옮기는 일이 남아 있었다),
// 컨텐츠 카드에서 그 변환을 풀어 두어 이제 **보스 카드와 같은 `FadedIllustration`** 를
//  부른다(요구하는 "같은 값"이 컴포넌트 공유로 성립한다).
//   화면 전용 testID(`party-size-modal-art`)는 사라졌다. 아트와 베일이 둘 다 `absolute inset-0`
//   이라 감싸는 순간 기준 상자가 바뀌어 그림이 사라진다(컴포넌트 주석).
// `aria-pressed` → **`accessibilityState.selected`**(`DifficultySegment` 가 `aria-selected` 를
//   쓴다. RN 접근성 상태에 *pressed* 가 없다).
import { useState } from 'react'
import { fireEvent } from '@testing-library/react-native'

import { findAllOfType, flattenStyle, renderOverlay, type AtomElement } from '../../../__tests__/render-atom'
import { PartySizeModal } from '../PartySizeModal'

/** 아트·베일은 `aria-hidden` 이라 기본 질의에서 빠진다(장식이라 그것이 옳다). */
const HIDDEN = { includeHiddenElements: true } as const

type Props = React.ComponentProps<typeof PartySizeModal>

/** 비율을 안 쓰는 파티. 칸 다섯이 전부 null 이다. */
const EVEN_SHARES = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  dropMyShare: null,
  dropSharesTotal: null,
  splitFeePercent: null,
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    bossName: '스우',
    cycleLabel: '주간 보스',
    portraitSlug: 'lotus',
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

/** 난이도 칩. 글자를 담은 `Text` 에서 위로 올라가 `role="button"` 인 첫 조상. */
function chip(getByText: (text: string) => AtomElement, label: string): AtomElement {
  let node: AtomElement | null = getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`칩을 찾지 못했다: ${label}`)
  return node
}

describe('PartySizeModal', () => {
  it('보스명과 주기를 헤더에 그린다', async () => {
    const { getByText } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(getByText('스우')).toBeTruthy()
    expect(getByText('주간 보스')).toBeTruthy()
  })

  it('난이도 세그먼트에 지원 난이도를 모두 그리고 현재 난이도만 선택 상태다', async () => {
    const { getByText } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(stateOf(chip(getByText, '하드')).selected).toBe(true)
    expect(stateOf(chip(getByText, '노멀')).selected).toBe(false)
    expect(stateOf(chip(getByText, '익스트림')).selected).toBe(false)
  })

  it('다른 난이도를 누르면 onSelectDifficulty 를 부른다', async () => {
    const p = props()
    const { getByText } = await renderOverlay(<PartySizeModal {...p} />)

    await fireEvent.press(chip(getByText, '익스트림'))

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

  it('닫기 버튼을 누르면 onClose 를 부른다', async () => {
    const p = props()
    const { getByLabelText } = await renderOverlay(<PartySizeModal {...p} />)

    await fireEvent.press(getByLabelText('닫기'))

    expect(p.onClose).toHaveBeenCalled()
  })

  it('일러스트가 없는 보스면 히어로를 비우고 이름만 남긴다', async () => {
    const { getByText, queryByTestId } = await renderOverlay(
      <PartySizeModal {...props({ portraitSlug: null })} />,
    )

    expect(getByText('스우')).toBeTruthy()
    expect(queryByTestId('faded-illustration', HIDDEN)).toBeNull()
  })

  it('에셋이 있는 슬러그는 히어로에 일러스트를 그린다', async () => {
    const { getByTestId, queryByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(getByTestId('faded-illustration', HIDDEN)).toBeTruthy()
    // 직선 베일은 안 쓴다. 이 띠는 타원 하나로 덮는다.
    expect(queryByTestId('faded-illustration-veil', HIDDEN)).toBeNull()
  })

  // 페이드 끝점이 카드와 다르다(히어로 42%/82%). 같은 값을 쓰면 넓고 낮은
  // 히어로에서 그림이 너무 일찍 끊긴다.
  // **실기기에서 드러난 결함**(2026-09-22). 크롭은 이미지를 상자보다 크게 그려 창을 옮기는
  // 방식이라, 안 자르면 남는 부분이 띠 밖으로 흘러 글자를 덮는다. 베일은 띠 안만 덮으므로 그
  // 부분이 생그림 사각형으로 남았다.
  it('그림 띠가 넘치는 부분을 자른다', async () => {
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(flattenStyle(getByTestId('party-modal-art', HIDDEN).props.style).overflow).toBe('hidden')
  })

  // 가로·세로는 직선이고 모서리만 깎는다. 타원 하나로 덮으면 위·오른쪽까지 휘어 어색했다
  // (사용자 지적). **왼쪽 끝이 완전히 덮여야** 띠가 끝나는 자리에 이음선이 안 남는다.
  it('베일 셋을 겹치고 왼쪽 끝을 완전히 덮는다', async () => {
    const { toJSON } = await renderOverlay(<PartySizeModal {...props()} />)

    const [horizontal] = findAllOfType(toJSON(), 'RNSVGLinearGradient')
    const [corner] = findAllOfType(toJSON(), 'RNSVGRadialGradient')

    // 가로는 왼쪽(offset 0.05)에서 알파 1 이고, SVG 는 그 앞을 첫 정지점으로 채운다.
    expect((horizontal.props.gradient as number[])[0]).toBe(0.05)
    expect(corner.props.cx).toBe('0%')
    expect(corner.props.cy).toBe('100%')
  })

  // 반대쪽. 매핑에 없는 슬러그는 아트를 안 만든다(그림 없는 보스가 타던 분기 그대로).
  it('에셋이 없는 슬러그는 일러스트를 그리지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(
      <PartySizeModal {...props({ portraitSlug: '없는보스' })} />,
    )

    expect(queryByTestId('faded-illustration', HIDDEN)).toBeNull()
  })

  it('난이도가 하나뿐인 보스도 세그먼트를 그린다', async () => {
    const { getByText } = await renderOverlay(
      <PartySizeModal {...props({ difficulties: ['chaos'], difficulty: 'chaos' })} />,
    )

    expect(stateOf(chip(getByText, '카오스')).selected).toBe(true)
  })
})

describe('분배 비율', () => {
  it('스위치를 끄면 비율 고르개가 안 선다. 균등으로 잡는 대다수가 안 지난다', async () => {
    const { queryByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(queryByTestId('share-field-ratio-결정석')).toBeNull()
  })

  // 반반(1:2)은 2인 균등과 같은 값이라 켠 티가 안 난다. 비율을 켰으면 뜻이 있는 값이어야 한다.
  it('비율로 갈아타면 2 : 1 이 놓인다. 반반은 균등과 같은 값이라 안 쓴다', async () => {
    const onApply = jest.fn()
    const { getByLabelText, getByText } = await renderOverlay(<PartySizeModal {...props({ onApply })} />)

    await fireEvent.press(getByLabelText('비율'))
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({
      partySize: 4,
      shares: {
        crystalMyShare: 2,
        crystalSharesTotal: 3,
        dropMyShare: 2,
        dropSharesTotal: 3,
        splitFeePercent: 3,
      },
    })
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

  it('결정석과 아이템이 각각 선다. 둘을 다르게 약속하는 파티가 있다', async () => {
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3, dropMyShare: 1, dropSharesTotal: 2 }
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props({ shares })} />)

    expect(getByTestId('share-field-ratio-결정석')).toHaveTextContent('66.7%')
    expect(getByTestId('share-field-ratio-아이템')).toHaveTextContent('50%')
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
    const shares = { ...EVEN_SHARES, crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 3 }
    const { getByText } = await renderOverlay(<PartySizeModal {...props({ shares, onApply })} />)

    expect(getByText('0%')).toBeTruthy()
    expect(getByText('5%')).toBeTruthy()

    await fireEvent.press(getByText('0%'))
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({
      partySize: 4,
      shares: expect.objectContaining({ splitFeePercent: 0 }),
    })
  })

  // 난이도마다 인원 상한과 비율이 따로 산다(스우 하드 6인 · 익스트림 2인). 옛 난이도에서
  // 고치던 값이 남으면 적용이 남의 값을 쓴다.
  it('난이도가 바뀌면 초안을 그 난이도의 저장값으로 다시 뜬다', async () => {
    const onApply = jest.fn()
    const { getByLabelText, getByText } = await renderOverlay(<DifficultyHost onApply={onApply} />)

    await fireEvent.press(getByLabelText('스우 파티원 수 증가'))
    await fireEvent.press(chip(getByText, '익스트림'))
    await fireEvent.press(getByText('적용'))

    expect(onApply).toHaveBeenCalledWith({ partySize: 2, shares: EVEN_SHARES })
  })
})
