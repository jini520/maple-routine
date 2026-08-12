// 웹판(198줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① `getByRole('checkbox', { name })` → **`aria-label` 로 잡는다.** 그 프롭이 RN 에서
//    `accessibilityLabel` 이 되므로 `getByLabelText` 가 그대로 그 행을 준다 — 웹에서 라벨이 자식
//    글자에서 계산되던 것을 여기서는 컴포넌트가 명시로 준다(`CacheClearConfirm.tsx` ②).
// ② `toBeDisabled()` → `accessibilityState.disabled`.
// ③ **누른 뒤 화면을 보려면 `act` 로 한 번 흘려보내야 한다**(실측 — 이 파일에서 처음 걸렸다).
//    RNTL 14 에서 `fireEvent` 는 갱신을 **예약만** 하고, 그 프레임의 렌더는 그 뒤에 온다. 그래서
//    `fireEvent` 직후의 질의는 **누르기 전 화면**을 본다(단언이 옛 값을 보고도 초록이 될 수 있다).
//    `onPress` 가 밖으로 나가는 콜백을 부르는 경우(`SettingsRow`·`DisconnectConfirm`)에는 안 걸린다 —
//    그 콜백은 렌더와 무관하게 즉시 불리기 때문이다. **다시 그려진 화면을 볼 때만** 이 헬퍼를 쓴다.
//
// **`role="checkbox"` 와 `aria-checked` 는 갈리지 않는다** — 진짜 다중 선택이라 RN 접근성에도
// 같은 역할·상태가 있다(선택 카드들이 `aria-selected` 로 갈아탄 것과 다른 자리다).
import { useState } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { CacheClearConfirm } from '../CacheClearConfirm'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

const SIZES = { general: 1024, bossRecords: 512 }

/** 누르고 **다시 그려질 때까지** 기다린다(파일 머리 ③). */
async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function buttonOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

/** 삭제 버튼은 선택 용량을 함께 적으므로("삭제 (1.5KB)") 접두로 잡는다. */
function confirmButton(view: Rendered): AtomElement {
  let node: AtomElement | null = view.getByText(/^삭제/)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error('삭제 버튼을 찾지 못했다')
  return node
}

function props(overrides: Partial<React.ComponentProps<typeof CacheClearConfirm>> = {}) {
  return {
    isOpen: true,
    isClearing: false,
    sizes: SIZES,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  }
}

describe('CacheClearConfirm', () => {
  it('isOpen이 false면 아무것도 렌더링하지 않는다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props({ isOpen: false })} />)

    expect(view.queryByTestId('cache-clear-confirm-overlay')).toBeNull()
  })

  // [[ADR-058]]: 지울 데이터를 2그룹 중 골라서 지운다.
  it('삭제 대상을 2그룹 체크리스트로 보여준다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    expect(view.getByLabelText('일반 데이터')).toBeTruthy()
    expect(view.getByLabelText('보스 수익·드롭 기록')).toBeTruthy()
  })

  // [[ADR-058]] 결정 6: 열고 바로 삭제하면 기존 전체 삭제와 같아야 한다.
  it('기본값은 두 그룹 모두 선택된 상태다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    expect(view.getByLabelText('일반 데이터').props.accessibilityState?.checked).toBe(true)
    expect(view.getByLabelText('보스 수익·드롭 기록').props.accessibilityState?.checked).toBe(true)
  })

  it('각 그룹 행에 그 그룹의 용량을 보여준다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    expect(view.getByText('1.0KB')).toBeTruthy()
    expect(view.getByText('512B')).toBeTruthy()
  })

  // [[ADR-061]] 결정 7: 조회 전에도 같은 자리·같은 타이포로 자리를 잡는다.
  it('용량을 아직 모르면(null) 각 그룹에 "- KB" 자리표시를 보여준다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props({ sizes: null })} />)

    expect(view.getAllByText('- KB')).toHaveLength(2)
  })

  it('선택한 그룹의 용량 합계를 삭제 버튼에 보여준다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    expect(view.getByText('삭제 (1.5KB)')).toBeTruthy()

    await press(view.getByLabelText('보스 수익·드롭 기록'))

    expect(view.getByText('삭제 (1.0KB)')).toBeTruthy()
  })

  it('그룹을 누르면 선택이 토글된다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    await press(view.getByLabelText('일반 데이터'))
    expect(view.getByLabelText('일반 데이터').props.accessibilityState?.checked).toBe(false)

    await press(view.getByLabelText('일반 데이터'))
    expect(view.getByLabelText('일반 데이터').props.accessibilityState?.checked).toBe(true)
  })

  it('아무 그룹도 선택하지 않으면 삭제 버튼이 비활성화된다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    await press(view.getByLabelText('일반 데이터'))
    await press(view.getByLabelText('보스 수익·드롭 기록'))

    expect(confirmButton(view).props.accessibilityState?.disabled).toBe(true)
  })

  it('삭제 버튼을 누르면 선택한 그룹을 onConfirm에 넘긴다', async () => {
    const onConfirm = jest.fn()
    const view = await renderOverlay(<CacheClearConfirm {...props({ onConfirm })} />)

    await press(view.getByLabelText('보스 수익·드롭 기록'))
    await press(confirmButton(view))

    expect(onConfirm).toHaveBeenCalledWith({ general: true, bossRecords: false })
  })

  // [[ADR-058]] 결정 6: 지난번에 해제해둔 체크가 남아 있으면 "열고 바로 삭제"가 사람마다 다른
  // 범위를 지운다.
  //
  // `rerender` 를 쓰지 않고 **부모가 `isOpen` 을 들고 있게** 한다 — RNTL 의 `rerender` 는 넘긴
  // 요소로 루트를 통째로 갈아치워 `renderOverlay` 가 두른 프로바이더가 사라진다(`Modal` 이
  // `useSafeAreaInsets` 에서 즉시 던진다). 실제 호출부(`SettingsAccountDataScreen`)도 이 모달을
  // 늘 마운트해 두고 `isOpen` 만 바꾸므로, 이 모양이 그 자리와도 같다.
  it('닫았다 다시 열면 선택이 기본값(전체)으로 돌아온다', async () => {
    let setOpen: (value: boolean) => void = () => {}
    function Host(): React.JSX.Element {
      const [isOpen, setIsOpen] = useState(true)
      setOpen = setIsOpen
      return <CacheClearConfirm {...props({ isOpen })} />
    }
    const view = await renderOverlay(<Host />)

    await press(view.getByLabelText('일반 데이터'))
    expect(view.getByLabelText('일반 데이터').props.accessibilityState?.checked).toBe(false)

    await act(async () => {
      setOpen(false)
    })
    await act(async () => {
      setOpen(true)
    })

    expect(view.getByLabelText('일반 데이터').props.accessibilityState?.checked).toBe(true)
  })

  // [[ADR-052]] 결정 3: 그룹 문구가 실제 삭제 범위와 어긋나면 사용자가 잘못된 정보 위에서
  // 되돌릴 수 없는 삭제를 승인한다.
  it('일반 데이터 행에 그 그룹이 지우는 대표 항목을 적는다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    expect(view.getByText('캐릭터 정보 · 수동 선택 항목 · 파티 보스 설정 등')).toBeTruthy()
  })

  it('수익·드롭 기록 행에 그 그룹이 지우는 대표 항목과 복구 불가 경고를 적는다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    expect(view.getByText('처치 기록 · 수익 · 드롭 아이템 정보 등')).toBeTruthy()
    expect(
      view.getByText('NEXON Open API가 최근 2주 데이터만 제공해 삭제 후 복구할 수 없습니다.'),
    ).toBeTruthy()
  })

  it('isClearing이 true면 취소·삭제 버튼과 그룹 선택이 모두 비활성화된다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props({ isClearing: true })} />)

    expect(buttonOf(view, '취소').props.accessibilityState?.disabled).toBe(true)
    expect(view.getByLabelText('일반 데이터').props.accessibilityState?.disabled).toBe(true)
    // [[ADR-061]] 결정 5·9 — 스피너 + 말줄임표 없는 '~중' 라벨.
    expect(buttonOf(view, '삭제 중').props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    })
  })

  it('취소 버튼을 누르면 onCancel이 호출된다', async () => {
    const onCancel = jest.fn()
    const view = await renderOverlay(<CacheClearConfirm {...props({ onCancel })} />)

    await press(buttonOf(view, '취소'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
