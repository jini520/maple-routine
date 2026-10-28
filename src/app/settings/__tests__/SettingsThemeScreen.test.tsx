// 테마 페이지. **고르면 이 페이지만 바뀌고, `적용` 을 눌러야 앱 전체에 적용된다.**
//
// 테마 이름은 손으로 적지 않고 레지스트리에서 뽑는다. 렌더 도우미의 바깥 테마가 첫 테마라,
// 지금 테마도 첫 테마로 둔다.
import { act, fireEvent } from '@testing-library/react-native'

import { useThemeStore } from '../../../features/theme/store'
import { THEME_NAMES, getThemeDefinition } from '../../../lib/theme/theme-registry'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { setStatusBarPort } from '../../../native/ports'
import { getTheme } from '../../../storage/theme'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'

import { flattenStyle, renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsThemeScreen } from '../SettingsThemeScreen'

const mockGoBack = jest.fn()
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  useSettingsNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}))

const 지금테마 = THEME_NAMES[0]
const 다크테마 = THEME_NAMES.find((name) => getThemeDefinition(name).mode === 'dark')
const 라이트테마 = THEME_NAMES.filter((name) => getThemeDefinition(name).mode === 'light')
if (다크테마 === undefined || getThemeDefinition(지금테마).mode !== 'light') {
  throw new Error('첫 테마가 라이트이고 다크 테마가 하나 이상이어야 한다')
}

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

const setStyle = jest.fn<Promise<void>, [boolean]>(async () => {})

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function applyButton(view: Rendered): AtomElement {
  let node: AtomElement | null = view.getByText('적용')
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error('적용 버튼이 없다')
  return node
}

beforeEach(() => {
  installNoopNativePorts()
  installFakePreferences()
  setStatusBarPort({ setStyle })
  useThemeStore.setState({ theme: 지금테마 })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsThemeScreen: 필터', () => {
  it('헤더의 다크를 누르면 라이트 테마가 목록에서 사라진다', async () => {
    const view = await renderOverlay(<SettingsThemeScreen />)

    await press(view.getByLabelText('다크'))

    expect(view.getByLabelText(다크테마)).toBeTruthy()
    for (const name of 라이트테마) expect(view.queryByLabelText(name)).toBeNull()
  })
})

describe('SettingsThemeScreen: 고르기와 적용', () => {
  it('칸을 누르면 페이지가 그 테마로 바뀌고, 저장된 테마는 그대로다', async () => {
    const view = await renderOverlay(<SettingsThemeScreen />)

    await press(view.getByLabelText(다크테마))

    expect(view.getByLabelText(다크테마).props.accessibilityState?.selected).toBe(true)
    expect(flattenStyle(view.getByText('테마').props.style).color).toBe(getThemeDefinition(다크테마).text)
    expect(useThemeStore.getState().theme).toBe(지금테마)
    expect(await getTheme()).toBeNull()
  })

  it('고른 테마가 지금 테마와 같으면 적용이 꺼진다', async () => {
    const view = await renderOverlay(<SettingsThemeScreen />)

    expect(applyButton(view).props.accessibilityState?.disabled).toBe(true)

    await press(view.getByLabelText(다크테마))
    expect(applyButton(view).props.accessibilityState?.disabled).toBe(false)

    await press(view.getByLabelText(지금테마))
    expect(applyButton(view).props.accessibilityState?.disabled).toBe(true)
  })

  it('적용을 누르면 저장하고 설정으로 돌아간다', async () => {
    const view = await renderOverlay(<SettingsThemeScreen />)

    await press(view.getByLabelText(다크테마))
    await press(applyButton(view))

    expect(useThemeStore.getState().theme).toBe(다크테마)
    expect(await getTheme()).toBe(다크테마)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it('상태바 밝기는 고른 테마를 따르고, 적용 없이 나가면 지금 테마로 돌아온다', async () => {
    const view = await renderOverlay(<SettingsThemeScreen />)

    await press(view.getByLabelText(다크테마))
    expect(setStyle).toHaveBeenLastCalledWith(true)

    await act(async () => {
      view.unmount()
    })
    expect(setStyle).toHaveBeenLastCalledWith(false)
    expect(useThemeStore.getState().theme).toBe(지금테마)
  })
})
