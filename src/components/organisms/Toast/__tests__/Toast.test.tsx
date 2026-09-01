// 웹판 열둘을 옮겼다. 갈린 것 넷.
//
// · **액션 아이콘 케이스**: 웹은 `svg.classList` 로 lucide 아이콘을 구분했다. RN 의 lucide 는
//   `testID` 를 삼키므로(`nativewind-interop.ts`) 그 아이콘이 실제로 그린 **`Path` 의 `d`** 를
//   비교한다 — 기대값을 손으로 적지 않고 두 아이콘을 나란히 렌더해 서로 다름을 본다.
//   **한 케이스 안에서 `unmount()` 후 다시 렌더하지 않는다** — RNTL 14 에서 그러면 이후 렌더가
//   빈 트리가 되고(실측), 그 트리를 스냅샷으로 굳히면 아무것도 안 지키는 기준선이 남는다.
// · **스와이프**: `fireEvent.pointer` → responder 이벤트. 좌표가 `clientX` → `pageX` 로 바뀔 뿐
//   임계값 판정은 같은 `shouldDismissFromSwipe` 다.
// · `role`·`aria-live` 는 그대로 남았다(RN 이 같은 이름의 프롭을 받는다).
// · 타이머 바는 **있고 없음만** 지킨다 — 줄어드는 것은 Reanimated 가 UI 스레드에서 하는 일이라
//   렌더 트리에는 선언(`animationName`·`animationDuration`)만 남는다. 그 선언을 웹
//   `@keyframes toast-shrink` 와 대조하던 `keyframes-parity.test.ts` 는 웹 소스와 함께 지워졌다
//   ([[ADR-155]]·[[ADR-156]]).
jest.mock('react-native-reanimated', () =>
  // `jest.mock` 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다** — 그래서 `require` 가
  // 선택이 아니라 유일한 길이다(`reduced-motion.ts` 「쓰는 법」).
  require('../../../__tests__/reduced-motion').reanimatedWithReducedMotion(),
)

import { fireEvent } from '@testing-library/react-native'

import type { ToastAction, ToastItem } from '../../../../features/toast/store'

import { mockReducedMotion } from '../../../__tests__/reduced-motion'
import { renderAtom, type AtomElement } from '../../../__tests__/render-atom'
import { SettingsIcon } from '../../../../lib/icons'
import { Toast } from '../Toast'

afterEach(() => {
  mockReducedMotion(false)
})

function makeToast(overrides: Partial<ToastItem> = {}): ToastItem {
  return {
    id: 'toast-1',
    variant: 'success',
    message: '저장했어요',
    duration: 2000,
    ...overrides }
}

/** 어떤 요소 아래의 SVG path `d` 목록 — 아이콘 그림이 실제로 바뀌었는지 본다. */
function pathsUnder(node: AtomElement): string[] {
  const out: string[] = []
  const visit = (current: AtomElement | string): void => {
    if (typeof current === 'string') return
    if (current.type === 'RNSVGPath') out.push(String(current.props.d))
    for (const child of current.children) visit(child as AtomElement | string)
  }
  visit(node)
  return out
}

const noop = (): void => {}

describe('Toast', () => {
  it('메시지를 표시한다', async () => {
    const { getByText } = await renderAtom(<Toast toast={makeToast()} onDismiss={noop} />)

    expect(getByText('저장했어요')).toBeTruthy()
  })

  it('닫기 버튼을 누르면 onDismiss 가 호출된다', async () => {
    const onDismiss = jest.fn()
    const { getByLabelText } = await renderAtom(<Toast toast={makeToast()} onDismiss={onDismiss} />)

    await fireEvent.press(getByLabelText('닫기'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('action 이 있으면 액션 버튼이 렌더되고, 누르면 onClick 과 onDismiss 가 모두 호출된다', async () => {
    const onClick = jest.fn()
    const onDismiss = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Toast toast={makeToast({ action: { label: '다시 시도', onClick } })} onDismiss={onDismiss} />,
    )

    await fireEvent.press(getByLabelText('다시 시도'))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  // [[ADR-063]]: 기본 아이콘은 '다시 시도'를 전제한 RefreshCw 다 — 뜻이 다른 액션은 자기 아이콘을
  // 넘겨야 하고, 그러지 않으면 무엇을 하는 버튼인지 어긋난다.
  it('action.icon 을 주면 기본 새로고침 아이콘 대신 그 아이콘을 그린다', async () => {
    const { getByLabelText } = await renderAtom(
      <>
        <Toast toast={makeToast({ action: { label: '다시 시도', onClick: noop } })} onDismiss={noop} />
        <Toast
          toast={makeToast({
            id: 'toast-2',
            // **core 의 타입이 웹을 향해 있다** — `ToastAction.icon` 이 `lucide-react` 의
            // `LucideIcon` 이라 `lucide-react-native` 아이콘이 그대로 안 들어간다(SVG DOM 프롭이
            // 달라 `fillRule` 에서 갈린다). core 는 이 단계에서 손대지 않는 것이 원칙이라
            // ([[ADR-128]] 원칙 3) 여기서는 캐스팅으로 넘기고, **호출부가 아이콘을 넘기는 화면
            // 단계에서 core 타입을 풀어야 한다**는 사실을 여기 남긴다.
            action: { label: '설정 열기', onClick: noop, icon: SettingsIcon as unknown as ToastAction['icon'] } })}
          onDismiss={noop}
        />
      </>,
    )

    const fallback = pathsUnder(getByLabelText('다시 시도'))
    const custom = pathsUnder(getByLabelText('설정 열기'))

    expect(fallback.length).toBeGreaterThan(0)
    expect(custom).not.toEqual(fallback)
  })

  it('action 이 없으면 액션 버튼을 렌더하지 않는다', async () => {
    const { queryByLabelText } = await renderAtom(<Toast toast={makeToast()} onDismiss={noop} />)

    expect(queryByLabelText('다시 시도')).toBeNull()
  })

  it('error 변형은 role="alert"·aria-live="assertive" 를 갖는다', async () => {
    const { getByTestId } = await renderAtom(
      <Toast toast={makeToast({ variant: 'error', duration: null })} onDismiss={noop} />,
    )

    const root = getByTestId('toast')
    expect(root.props.role).toBe('alert')
    expect(root.props['aria-live']).toBe('assertive')
  })

  it.each(['success', 'info'] as const)('%s 변형은 role="status"·aria-live="polite" 를 갖는다', async (variant) => {
    const { getByTestId } = await renderAtom(
      <Toast toast={makeToast({ variant })} onDismiss={noop} />,
    )

    const root = getByTestId('toast')
    expect(root.props.role).toBe('status')
    expect(root.props['aria-live']).toBe('polite')
  })

  it('duration 이 있으면 자동 소멸 타이머 바를 렌더한다', async () => {
    const { getByTestId } = await renderAtom(<Toast toast={makeToast()} onDismiss={noop} />)

    expect(getByTestId('toast-timer')).toBeTruthy()
  })

  it('duration 이 null 이면 타이머 바를 렌더하지 않는다', async () => {
    const { queryByTestId } = await renderAtom(
      <Toast toast={makeToast({ duration: null })} onDismiss={noop} />,
    )

    expect(queryByTestId('toast-timer')).toBeNull()
  })
})

// 임계값(70px)은 `src/lib/swipe-dismiss` 가 갖는다 — 여기서는 그 판정이 제스처에 이어지는지만 본다.
describe('Toast — 스와이프로 닫기', () => {
  /** 시작 → 이동 → 뗌. 웹판이 `pointerdown/move/up` 을 순서대로 쏘던 것과 같다. */
  async function swipe(root: AtomElement, dx: number): Promise<void> {
    await fireEvent(root, 'responderGrant', { nativeEvent: { pageX: 0 } })
    await fireEvent(root, 'responderMove', { nativeEvent: { pageX: dx } })
    await fireEvent(root, 'responderRelease', { nativeEvent: { pageX: dx } })
  }

  it('임계값을 넘겨 좌우로 끌면 onDismiss 가 호출된다', async () => {
    const onDismiss = jest.fn()
    const { getByTestId } = await renderAtom(<Toast toast={makeToast()} onDismiss={onDismiss} />)

    await swipe(getByTestId('toast'), 120)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('임계값 미만으로 끌면 onDismiss 가 호출되지 않는다', async () => {
    const onDismiss = jest.fn()
    const { getByTestId } = await renderAtom(<Toast toast={makeToast()} onDismiss={onDismiss} />)

    await swipe(getByTestId('toast'), 30)

    expect(onDismiss).not.toHaveBeenCalled()
  })
})

// 모션 줄이기 — 웹의 `motion-reduce:hidden`(파일 머리 ②). 줄지 않는 막대를 남기면 "시간이 안 간다"로
// 읽히므로 통째로 없앤다. **바깥 껍데기(`toast-timer`)는 남는다** — 자리를 차지하지 않는 절대 배치라
// 있고 없고가 레이아웃을 바꾸지 않고, 웹도 `motion-reduce:hidden` 을 안쪽 바에만 걸었다.
describe('Toast — 모션 줄이기', () => {
  it('켜져 있으면 남은 시간 바가 그려지지 않는다', async () => {
    mockReducedMotion(true)
    const { getByTestId } = await renderAtom(<Toast toast={makeToast()} onDismiss={noop} />)

    expect(getByTestId('toast-timer').children).toHaveLength(0)
  })

  it('꺼져 있으면 남은 시간 바가 toast-shrink 를 그 토스트의 지속시간으로 재생한다', async () => {
    mockReducedMotion(false)
    const { getByTestId } = await renderAtom(
      <Toast toast={makeToast({ duration: 2500 })} onDismiss={noop} />,
    )

    const [bar] = getByTestId('toast-timer').children as AtomElement[]
    // 지속시간만 런타임 값이라 여기서 본다. 나머지(키프레임·이징·채우기)를 웹 원본과 대조하던
    // 테스트는 없다(파일 머리).
    expect(bar.props.jestInlineStyle).toMatchObject({
      animationDuration: '2500ms',
      transformOrigin: 'left' })
  })
})

