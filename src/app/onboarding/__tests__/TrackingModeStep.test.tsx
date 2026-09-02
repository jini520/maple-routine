// 웹판(91줄)의 명세를 읽어 다시 쓴 것. 각 케이스가 지키는 결정은 웹 주석 그대로다.
//
// 갈린 것 셋
// ① 옵션을 **접근 가능한 이름의 앵커**(`/^자동/`)로 찾던 것이 **제목 글자**로 바뀐다. RN 의
//    `Pressable` 은 자식 글자를 합쳐 하나의 이름으로 만들지 않아 그 정규식이 성립하지 않는다.
//    웹에서 앵커가 필요했던 이유(수동 옵션의 주의 문구에 "자동"이 들어간다)는 여기서도 살아 있어,
//    글자를 정확히 일치로 찾고 위로 올라가 그 카드를 잡는다.
// ② `aria-pressed` → **`accessibilityState.selected`**(RN 접근성 상태에 *pressed* 가 없다).
// ③ `toBeVisible()` → 존재 확인. jsdom 과 달리 RN 렌더 트리에는 "보이지 않게 존재하는" 상태가
//    이 화면에 없다. 접혀 있으면 아예 렌더되지 않는다. 그래서 결정 22("고르기 전에 비교한다")를
//    지키는 검사는 존재 여부로 충분하다.
import { fireEvent } from '@testing-library/react-native'

import { TRACKING_MODE_OPTIONS } from '../../../features/tracking-mode/copy'

import { renderAtom, type AtomElement } from '../../../components/__tests__/render-atom'
import { TrackingModeStep } from '../TrackingModeStep'

type Rendered = Awaited<ReturnType<typeof renderAtom>>

function optionCard(view: Rendered, title: string): AtomElement {
  let node: AtomElement | null = view.getByText(title)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`옵션 카드를 찾지 못했다: ${title}`)
  return node
}

function isSelected(view: Rendered, title: string): boolean | undefined {
  const state = (optionCard(view, title).props.accessibilityState ?? {}) as { selected?: boolean }
  return state.selected
}

function cta(view: Rendered): AtomElement {
  let node: AtomElement | null = view.getByText('계속하기')
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error('계속하기를 찾지 못했다')
  return node
}

describe('TrackingModeStep', () => {
  it('초기에는 어느 옵션도 선택돼 있지 않다', async () => {
    const view = await renderAtom(<TrackingModeStep onSubmit={jest.fn()} />)

    expect(isSelected(view, '자동')).toBe(false)
    expect(isSelected(view, '수동')).toBe(false)
  })

  // : 고르기 **전에** 둘을 비교하는 화면이라 설명·주의를 선택 시에만 펼치지 않는다.
  it('설명과 주의 문구가 선택 전에도 두 옵션 모두 보인다', async () => {
    const view = await renderAtom(<TrackingModeStep onSubmit={jest.fn()} />)

    for (const option of TRACKING_MODE_OPTIONS) {
      expect(view.getByText(option.description)).toBeTruthy()
      expect(view.getByText(option.caution)).toBeTruthy()
    }
  })

  it('한 옵션을 골라도 다른 옵션의 설명·주의가 그대로 남는다', async () => {
    const view = await renderAtom(<TrackingModeStep onSubmit={jest.fn()} />)

    await fireEvent.press(optionCard(view, '자동'))

    for (const option of TRACKING_MODE_OPTIONS) {
      expect(view.getByText(option.description)).toBeTruthy()
      expect(view.getByText(option.caution)).toBeTruthy()
    }
  })

  it('옵션을 고르기 전에는 계속하기가 비활성화된다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<TrackingModeStep onSubmit={onSubmit} />)

    const state = (cta(view).props.accessibilityState ?? {}) as { disabled?: boolean }
    expect(state.disabled).toBe(true)

    await fireEvent.press(cta(view))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('추천 배지는 표시되지 않는다', async () => {
    const view = await renderAtom(<TrackingModeStep onSubmit={jest.fn()} />)

    expect(view.queryByText('추천')).toBeNull()
  })

  it('수동 옵션을 누르면 선택 상태가 바뀐다', async () => {
    const view = await renderAtom(<TrackingModeStep onSubmit={jest.fn()} />)

    await fireEvent.press(optionCard(view, '수동'))

    expect(isSelected(view, '수동')).toBe(true)
    expect(isSelected(view, '자동')).toBe(false)
  })

  it('자동을 선택하고 계속하기를 누르면 auto로 onSubmit이 호출된다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<TrackingModeStep onSubmit={onSubmit} />)

    await fireEvent.press(optionCard(view, '자동'))
    await fireEvent.press(cta(view))

    expect(onSubmit).toHaveBeenCalledWith('auto')
  })

  it('수동을 선택하고 계속하기를 누르면 manual로 onSubmit이 호출된다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<TrackingModeStep onSubmit={onSubmit} />)

    await fireEvent.press(optionCard(view, '수동'))
    await fireEvent.press(cta(view))

    expect(onSubmit).toHaveBeenCalledWith('manual')
  })

  it('제목과 보조문을 보여준다', async () => {
    const view = await renderAtom(<TrackingModeStep onSubmit={jest.fn()} />)

    expect(view.getByText('스케줄러를 어떻게 관리할까요?')).toBeTruthy()
    expect(view.getByText('나중에 설정에서 언제든 바꿀 수 있어요.')).toBeTruthy()
  })
})
