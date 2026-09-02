// 웹판(97줄)의 명세를 읽어 다시 쓴 것. 검사하는 것은 [[ADR-104]] 결정 7 —
// **적용은 즉시지만 닫기는 따라오지 않는다.**
//
// 갈린 것 둘
// ① 타일을 `aria-label` 로 잡는다(`ThemeSelector` 테스트와 같은 이유).
// ② 누른 뒤 화면을 보려면 `act` 로 흘려보낸다(`CacheClearConfirm` 테스트 파일 머리 ③).
//
// **테마 이름을 손으로 나열하지 않는다**([[ADR-064]] 결정 10) — 레지스트리에서 둘을 뽑아 쓴다.
import { act, fireEvent } from '@testing-library/react-native'

import { useThemeStore } from '../../../features/theme/store'
import { THEME_NAMES } from '../../../lib/theme/theme-registry'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { ThemeModal } from '../ThemeModal'

jest.mock('../../../features/theme/store', () => ({
  useThemeStore: jest.fn(),
}))

const mockedStore = jest.mocked(useThemeStore)

const [현재테마, 다른테마, 또다른테마] = THEME_NAMES
if (현재테마 === undefined || 다른테마 === undefined || 또다른테마 === undefined) {
  throw new Error('테마가 셋 미만이다 — 이 파일의 케이스가 성립하지 않는다')
}

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

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

function mockThemeStore(overrides: Partial<ReturnType<typeof useThemeStore>> = {}): void {
  mockedStore.mockReturnValue({
    theme: 현재테마,
    restoreFromStorage: jest.fn(),
    selectTheme: jest.fn(async () => {}),
    ...overrides,
  })
}

beforeEach(() => {
  mockThemeStore()
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('ThemeModal', () => {
  it('현재 테마와 선택지를 보여준다', async () => {
    const view = await renderOverlay(<ThemeModal onClose={jest.fn()} />)

    expect(view.getByText('테마')).toBeTruthy()
    expect(view.getByLabelText(현재테마).props.accessibilityState?.selected).toBe(true)
    for (const name of THEME_NAMES) expect(view.getByLabelText(name)).toBeTruthy()
  })

  // [[ADR-104]] 결정 7: 모달 자신이 선택 테마의 색으로 그려지므로 그 자리에서 갈아입혀 보게 둔다.
  it('테마를 선택하면 selectTheme 만 호출하고 모달은 열려 있다', async () => {
    const selectTheme = jest.fn(async () => {})
    const onClose = jest.fn()
    mockThemeStore({ selectTheme })
    const view = await renderOverlay(<ThemeModal onClose={onClose} />)

    await press(view.getByLabelText(다른테마))

    expect(selectTheme).toHaveBeenCalledWith(다른테마)
    expect(onClose).not.toHaveBeenCalled()
    expect(view.getByTestId('theme-modal-overlay')).toBeTruthy()
  })

  it('연달아 고르면 그때마다 적용되고 모달은 그대로 남는다', async () => {
    const selectTheme = jest.fn(async () => {})
    const onClose = jest.fn()
    mockThemeStore({ selectTheme })
    const view = await renderOverlay(<ThemeModal onClose={onClose} />)

    await press(view.getByLabelText(다른테마))
    await press(view.getByLabelText(또다른테마))

    expect(selectTheme).toHaveBeenNthCalledWith(1, 다른테마)
    expect(selectTheme).toHaveBeenNthCalledWith(2, 또다른테마)
    expect(onClose).not.toHaveBeenCalled()
  })

  // 버튼이 "완료" 하나인 이유는 되돌릴 것이 없기 때문이다 — 되돌리려면 원래 테마를 다시 고른다.
  it('완료를 누르면 닫힌다', async () => {
    const onClose = jest.fn()
    const view = await renderOverlay(<ThemeModal onClose={onClose} />)

    expect(view.queryByText('취소')).toBeNull()
    await press(buttonOf(view, '완료'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('오버레이를 누르면 onClose가 호출된다', async () => {
    const onClose = jest.fn()
    const view = await renderOverlay(<ThemeModal onClose={onClose} />)

    await press(view.getByTestId('theme-modal-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
