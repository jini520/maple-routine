// 글자 크기 페이지. **단계를 바꾸면 이 페이지만 바뀌고, `적용` 을 눌러야 앱 전체에 적용된다.**
import { act, fireEvent } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { useTextSizeStore } from '../../../features/text-size/store'
import { TEXT_REFERENCE_WIDTH, TEXT_SIZE_LABELS } from '../../../lib/text-size'
import { getTextSize } from '../../../storage/text-size'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { __resetTextScaleForTest, getTextScale } from '../../../theme/text-scale'

import { flattenStyle, renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsTextSizeScreen } from '../SettingsTextSizeScreen'

const mockGoBack = jest.fn()
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  useSettingsNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}))

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

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

function titleSizeOf(view: Rendered): number {
  return flattenStyle(view.getByText('화면 제목').props.style).fontSize as number
}

beforeEach(() => {
  // 상한이 걸리지 않게 넓은 화면으로 둔다.
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: TEXT_REFERENCE_WIDTH * 2, height: 844, scale: 3, fontScale: 1 })
  installFakePreferences()
  __resetTextScaleForTest()
  useTextSizeStore.setState({ size: 'default' })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

describe('SettingsTextSizeScreen', () => {
  it('단계를 바꾸면 미리보기 글자와 숫자만 새 크기가 되고, 저장된 단계는 그대로다', async () => {
    const view = await renderOverlay(<SettingsTextSizeScreen />)
    const before = titleSizeOf(view)
    expect(view.getByText('18')).toBeTruthy()

    await press(view.getByLabelText(TEXT_SIZE_LABELS.xlarge))

    expect(titleSizeOf(view)).toBeCloseTo(before * 1.2)
    expect(view.getByText('21.6')).toBeTruthy()
    expect(useTextSizeStore.getState().size).toBe('default')
    expect(getTextScale()).toBe(1)
  })

  it('고른 단계가 지금 단계와 같으면 적용이 꺼진다', async () => {
    const view = await renderOverlay(<SettingsTextSizeScreen />)

    expect(applyButton(view).props.accessibilityState?.disabled).toBe(true)

    await press(view.getByLabelText(TEXT_SIZE_LABELS.large))
    expect(applyButton(view).props.accessibilityState?.disabled).toBe(false)
  })

  it('적용을 누르면 저장하고 앱 전체 배수를 바꾼 뒤 설정으로 돌아간다', async () => {
    const view = await renderOverlay(<SettingsTextSizeScreen />)

    await press(view.getByLabelText(TEXT_SIZE_LABELS.xlarge))
    await press(applyButton(view))

    expect(useTextSizeStore.getState().size).toBe('xlarge')
    expect(await getTextSize()).toBe('xlarge')
    expect(getTextScale()).toBe(1.2)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
