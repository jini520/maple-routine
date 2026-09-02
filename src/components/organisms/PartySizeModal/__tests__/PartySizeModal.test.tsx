// 웹판을 옮긴 것. 갈린 케이스 둘만 적는다.
//
// · *"일러스트가 있으면 카드와 같은 필터·불투명도로 그린다"* → **step 5 에서 온전히 성립한다.**
//   3단계는 자리만 만들고 그림을 못 앉혔는데(크롭의 CSS 값을 RN 기하로 옮기는 일이 남아 있었다),
//   step 4 가 컨텐츠 카드에서 그 변환을 풀어 두어 이제 **보스 카드와 같은 `FadedIllustration`** 를
//   부른다([[ADR-121]] 결정 7 이 요구하는 "같은 값"이 컴포넌트 공유로 성립한다).
//   화면 전용 testID(`party-size-modal-art`)는 사라졌다 — 아트와 베일이 둘 다 `absolute inset-0`
//   이라 감싸는 순간 기준 상자가 바뀌어 그림이 사라진다(컴포넌트 주석).
// · `aria-pressed` → **`accessibilityState.selected`**(`DifficultySegment` 가 `aria-selected` 를
//   쓴다 — RN 접근성 상태에 *pressed* 가 없다).
import { fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../__tests__/render-atom'
import { MEDIA_ART_MASK_HERO } from '../../../../constants/style/media-card'
import { PartySizeModal } from '../PartySizeModal'

/** 아트·베일은 `aria-hidden` 이라 기본 질의에서 빠진다(장식이라 그것이 옳다). */
const HIDDEN = { includeHiddenElements: true } as const

type Props = React.ComponentProps<typeof PartySizeModal>

function props(overrides: Partial<Props> = {}): Props {
  return {
    bossName: '스우',
    cycleLabel: '주간 보스',
    portraitSlug: 'lotus',
    difficulties: ['노멀', '하드', '익스트림'],
    difficulty: '하드',
    partySize: 4,
    maxPartySize: 6,
    onSelectDifficulty: jest.fn(),
    onChangePartySize: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  }
}

interface State {
  selected?: boolean
  disabled?: boolean
}

function stateOf(node: AtomElement): State {
  return (node.props.accessibilityState ?? {}) as State
}

/** 난이도 칩 — 글자를 담은 `Text` 에서 위로 올라가 `role="button"` 인 첫 조상. */
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

    expect(p.onSelectDifficulty).toHaveBeenCalledWith('익스트림')
  })

  // 파티 인원은 (보스 + 난이도)에 붙어 있다 — 스우는 하드 6인, 익스트림 2인. 웹은 한 케이스에서
  // `cleanup()` 뒤 다시 렌더했는데, RNTL 은 케이스마다 자동 정리하므로 둘로 나눈다.
  it.each([
    [{}, '4 / 6'],
    [{ difficulty: '익스트림' as const, partySize: 1, maxPartySize: 2 }, '1 / 2'],
  ])('현재 인원과 상한을 n / max 로 함께 보여준다 (%#)', async (overrides, expected) => {
    const { getByText } = await renderOverlay(<PartySizeModal {...props(overrides)} />)

    expect(getByText(expected)).toBeTruthy()
  })

  it('스테퍼로 인원을 바꾸면 onChangePartySize 를 부른다', async () => {
    const p = props()
    const { getByLabelText } = await renderOverlay(<PartySizeModal {...p} />)

    await fireEvent.press(getByLabelText('스우 파티원 수 증가'))

    expect(p.onChangePartySize).toHaveBeenCalledWith(5)
  })

  it('상한에서 + 가 비활성이다', async () => {
    const { getByLabelText } = await renderOverlay(
      <PartySizeModal {...props({ difficulty: '익스트림', partySize: 2, maxPartySize: 2 })} />,
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
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(getByTestId('faded-illustration', HIDDEN)).toBeTruthy()
    expect(getByTestId('faded-illustration-veil', HIDDEN)).toBeTruthy()
  })

  // 페이드 끝점이 카드와 다르다(`MEDIA_ART_MASK_HERO` — 42%/82%). 같은 값을 쓰면 넓고 낮은
  // 히어로에서 그림이 너무 일찍 끊긴다.
  it('베일은 카드가 아니라 히어로 정지점을 쓴다', async () => {
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    // 웹 마스크(`… 42%, transparent 82%`)의 정지점 + 네이티브 전용 끝점 1.
    const stops = [...MEDIA_ART_MASK_HERO.matchAll(/(\d+)%/g)].map(([, v]) => Number(v) / 100)

    expect(getByTestId('faded-illustration-veil', HIDDEN).props.locations).toEqual([...stops, 1])
  })

  // 반대쪽 — 매핑에 없는 슬러그는 아트를 안 만든다(그림 없는 보스가 타던 분기 그대로).
  it('에셋이 없는 슬러그는 일러스트를 그리지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(
      <PartySizeModal {...props({ portraitSlug: '없는보스' })} />,
    )

    expect(queryByTestId('faded-illustration', HIDDEN)).toBeNull()
  })

  it('난이도가 하나뿐인 보스도 세그먼트를 그린다', async () => {
    const { getByText } = await renderOverlay(
      <PartySizeModal {...props({ difficulties: ['카오스'], difficulty: '카오스' })} />,
    )

    expect(stateOf(chip(getByText, '카오스')).selected).toBe(true)
  })

})
