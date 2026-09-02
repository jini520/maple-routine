// 이 화면이 지키는 것을 적는다. 검사하는 것은 의 **선택 → 확인** 2단계다.
//
// 갈린 것 셋
// ① 옵션을 **제목 글자에서 위로 올라가** 잡는다. RN 은 자식 글자를 합쳐 접근성 이름을 만들지
//    않는다(온보딩 `TrackingModeStep` 테스트와 같은 헬퍼).
// ② `aria-pressed` → `aria-selected` → `accessibilityState.selected`.
// ③ 누른 뒤 화면을 보려면 `act` 로 흘려보낸다(`CacheClearConfirm` 테스트 파일 머리 ③).
import { act, fireEvent } from '@testing-library/react-native'

import { TRACKING_MODE_OPTIONS } from '../../../features/tracking-mode/copy'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import type { TrackingMode } from '../../../storage/tracking-mode'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { TrackingModeModal } from '../TrackingModeModal'

jest.mock('../../../features/tracking-mode/store', () => ({
  useTrackingModeStore: jest.fn(),
}))

// 이름이 `mock` 으로 시작해야 한다. babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다(다른 화면 테스트와 같은 규칙).
const mockReloadTabStores = jest.fn()
jest.mock('../reload-tab-stores', () => ({
  reloadTabStores: (...args: unknown[]) => mockReloadTabStores(...args),
}))

const mockedStore = jest.mocked(useTrackingModeStore)

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function climb(view: Rendered, text: string): AtomElement {
  let node: AtomElement | null = view.getByText(text)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${text}`)
  return node
}

/** `자동`/`수동` 은 주의 문구 안에도 나오므로 **제목 글자를 정확히 일치**로 찾아 올라간다. */
function optionCard(view: Rendered, mode: TrackingMode): AtomElement {
  const option = TRACKING_MODE_OPTIONS.find((item) => item.mode === mode)
  if (option === undefined) throw new Error(`모드를 찾지 못했다: ${mode}`)
  return climb(view, option.title)
}

function mockTrackingModeStore(
  overrides: Partial<ReturnType<typeof useTrackingModeStore>> = {},
): void {
  mockedStore.mockReturnValue({
    mode: 'auto',
    restoreFromStorage: jest.fn(),
    setMode: jest.fn(async () => {}),
    ...overrides,
  })
}

beforeEach(() => {
  mockTrackingModeStore()
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('TrackingModeModal', () => {
  // : 고르기 **전에** 둘을 비교하는 화면이라 설명·주의를 접지 않는다.
  it('두 옵션의 설명과 주의 문구를 모두 보여준다', async () => {
    const view = await renderOverlay(<TrackingModeModal onClose={jest.fn()} />)

    for (const option of TRACKING_MODE_OPTIONS) {
      expect(view.getByText(option.title)).toBeTruthy()
      expect(view.getByText(option.description)).toBeTruthy()
      expect(view.getByText(option.caution)).toBeTruthy()
    }
  })

  //  의 핵심. 탭은 **고르는 것일 뿐**이다.
  it('옵션을 탭해도 setMode를 부르지 않고 모달도 닫히지 않는다', async () => {
    const setMode = jest.fn(async () => {})
    const onClose = jest.fn()
    mockTrackingModeStore({ setMode })
    const view = await renderOverlay(<TrackingModeModal onClose={onClose} />)

    await press(optionCard(view, 'manual'))

    expect(setMode).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(optionCard(view, 'manual').props.accessibilityState?.selected).toBe(true)
    expect(optionCard(view, 'auto').props.accessibilityState?.selected).toBe(false)
  })

  it('현재 모드가 그대로면 적용 버튼이 비활성이다', async () => {
    const view = await renderOverlay(<TrackingModeModal onClose={jest.fn()} />)

    expect(climb(view, '적용').props.accessibilityState?.disabled).toBe(true)

    // 다른 모드를 고르면 살아나고, 원래 모드로 되돌리면 다시 비활성이다.
    await press(optionCard(view, 'manual'))
    expect(climb(view, '적용').props.accessibilityState?.disabled).toBe(false)

    await press(optionCard(view, 'auto'))
    expect(climb(view, '적용').props.accessibilityState?.disabled).toBe(true)
  })

  it('다른 모드를 고르고 적용을 누르면 그 모드로 setMode를 호출하고 닫힌다', async () => {
    const setMode = jest.fn(async () => {})
    const onClose = jest.fn()
    mockTrackingModeStore({ setMode })
    const view = await renderOverlay(<TrackingModeModal onClose={onClose} />)

    await press(optionCard(view, 'manual'))
    await press(climb(view, '적용'))

    expect(setMode).toHaveBeenCalledWith('manual')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  //  정정: 시드는 저장소를 채우지만 수동 모드의 표시 목록을 정하는 것은 스토어
  // 메모리의 사본이고, RN 탭 화면은 마운트된 채 남아 스스로 다시 읽지 않는다. 그래서 적용이
  // 끝나면 세 탭 스토어를 여기서 다시 읽힌다(안 그러면 자동 → 수동 직후 보스 탭이 빈 상태로 뜬다).
  it('적용이 끝나면 컨텐츠·보스·수익 세 탭 스토어를 다시 읽힌다', async () => {
    const view = await renderOverlay(<TrackingModeModal onClose={jest.fn()} />)

    await press(optionCard(view, 'manual'))
    await press(climb(view, '적용'))

    expect(mockReloadTabStores).toHaveBeenCalledWith(['content', 'boss', 'profit'])
  })

  // 시드가 끝나기 전에 읽히면 그 회차가 옛 멤버십을 담는다. 순서가 계약이다.
  it('setMode가 resolve되기 전에는 다시 읽히지 않는다', async () => {
    let finish: () => void = () => {}
    mockTrackingModeStore({
      setMode: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      ),
    })
    const view = await renderOverlay(<TrackingModeModal onClose={jest.fn()} />)

    await press(optionCard(view, 'manual'))
    await press(climb(view, '적용'))

    expect(mockReloadTabStores).not.toHaveBeenCalled()

    await act(async () => {
      finish()
    })

    expect(mockReloadTabStores).toHaveBeenCalledTimes(1)
  })

  it('취소를 누르면 setMode 없이 닫힌다', async () => {
    const setMode = jest.fn(async () => {})
    const onClose = jest.fn()
    mockTrackingModeStore({ setMode })
    const view = await renderOverlay(<TrackingModeModal onClose={onClose} />)

    await press(optionCard(view, 'manual'))
    await press(climb(view, '취소'))

    expect(setMode).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    // 바뀐 것이 없으면 다시 읽힐 것도 없다(정정).
    expect(mockReloadTabStores).not.toHaveBeenCalled()
  })

  // : 수동 전환의 `setMode` 는 시드가 전부 끝난 뒤에만 resolve 된다. 그동안
  // 닫히면 사용자가 방금 고른 모드가 아직 준비 안 된 상태를 본다.
  it('setMode가 resolve되기 전까지 옵션·취소·적용이 모두 비활성이고 모달이 닫히지 않는다', async () => {
    let finish: () => void = () => {}
    const setMode = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const onClose = jest.fn()
    mockTrackingModeStore({ setMode })
    const view = await renderOverlay(<TrackingModeModal onClose={onClose} />)

    await press(optionCard(view, 'manual'))
    await press(climb(view, '적용'))

    // 스피너가 라벨을 덮고 라벨은 그대로 남는다.
    const applying = climb(view, '적용')
    expect(applying.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
    expect(climb(view, '취소').props.accessibilityState?.disabled).toBe(true)
    expect(optionCard(view, 'auto').props.accessibilityState?.disabled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      finish()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // "저장 도중엔 닫을 수 없다"캐릭터 관리 저장 진행률 모달과 같은 원칙.
  it('적용 중에는 오버레이를 눌러도 닫히지 않는다', async () => {
    const setMode = jest.fn(() => new Promise<void>(() => {}))
    const onClose = jest.fn()
    mockTrackingModeStore({ setMode })
    const view = await renderOverlay(<TrackingModeModal onClose={onClose} />)

    await press(optionCard(view, 'manual'))
    await press(climb(view, '적용'))
    await press(view.getByTestId('tracking-mode-modal-overlay'))

    expect(onClose).not.toHaveBeenCalled()
  })
})
