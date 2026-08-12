// 웹판을 옮긴 것. 갈린 케이스 둘만 적는다.
//
// · *"일러스트가 있으면 카드와 같은 필터·불투명도로 그린다"* → **아직 반만 성립한다.**
//   [[ADR-129]] 로 `getBossPortraitUrl` 이 진짜 에셋을 돌려주게 돼 히어로 **자리**는 생기지만,
//   그 자리에 그림을 앉히려면 CSS `background-size: "220% auto"` / `position: "60% 40%"`
//   ([[ADR-018]] 크롭 표)을 RN 기하로 옮겨야 하고 그 계산에는 **그림의 고유 종횡비**가 필요하다.
//   그래서 지금 케이스는 **"에셋은 왔고 자리도 생겼지만 아직 그림은 안 앉는다"** 이다 — 크롭
//   변환이 붙는 날 이 단언이 깨지면서 그 작업이 드러난다.
// · `aria-pressed` → **`accessibilityState.selected`**(`DifficultySegment` 가 `aria-selected` 를
//   쓴다 — RN 접근성 상태에 *pressed* 가 없다).
import { fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../__tests__/render-atom'
import { PartySizeModal } from '../PartySizeModal'

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
    expect(queryByTestId('party-size-modal-art')).toBeNull()
  })

  // 파일 머리의 계약. 자리는 생겼고(에셋이 해석된다) 그림은 아직 없다 — 크롭 변환 몫이다.
  it('에셋이 있는 슬러그는 일러스트 «자리»를 만든다 (그림은 크롭 변환 몫)', async () => {
    const { getByTestId } = await renderOverlay(<PartySizeModal {...props()} />)

    const art = getByTestId('party-size-modal-art')
    expect(art).toBeTruthy()
    // 그림이 앉으면 자식이 생긴다 — 지금은 빈 View 다.
    expect(art.props.children).toBeUndefined()
  })

  // 반대쪽 — 매핑에 없는 슬러그는 자리도 안 만든다(그림 없는 보스가 타던 분기 그대로).
  it('에셋이 없는 슬러그는 일러스트 자리를 만들지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(
      <PartySizeModal {...props({ portraitSlug: '없는보스' })} />,
    )

    expect(queryByTestId('party-size-modal-art')).toBeNull()
  })

  it('난이도가 하나뿐인 보스도 세그먼트를 그린다', async () => {
    const { getByText } = await renderOverlay(
      <PartySizeModal {...props({ difficulties: ['카오스'], difficulty: '카오스' })} />,
    )

    expect(stateOf(chip(getByText, '카오스')).selected).toBe(true)
  })

  it('트리 스냅샷', async () => {
    const { toJSON } = await renderOverlay(<PartySizeModal {...props()} />)

    expect(toJSON()).toMatchSnapshot()
  })
})
