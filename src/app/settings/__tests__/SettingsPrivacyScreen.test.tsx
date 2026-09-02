// 개인정보 처리방침 화면. 명세로 삼을 것이 파일 주석뿐이다.
// 그래도 쓰는 이유는 이 화면이 RN 으로 오며 **가장 많이 갈렸기 때문**이다(`iframe` → `WebView`,
// 실패 신호가 하나 늘고, `navigator.onLine` 사전 검사가 사라졌다). 갈린 자리는 지켜 둘 값이 있다.
import { act, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { PRIVACY_URL, SettingsPrivacyScreen } from '../SettingsPrivacyScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const goBack = jest.fn()
const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

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

/** `WebView` 대역이 프롭을 그대로 흘려보내므로 로드 성공·실패를 그대로 재현할 수 있다. */
async function fire(view: Rendered, event: 'load' | 'error'): Promise<void> {
  await act(async () => {
    fireEvent(view.getByTestId('privacy-frame'), event)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockedUseSettingsNavigation.mockReturnValue({
    navigate: jest.fn(),
    goBack,
  } as unknown as ReturnType<typeof useSettingsNavigation>)
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

describe('SettingsPrivacyScreen', () => {
  it('제목과 뒤로 버튼을 그리고, 뒤로를 누르면 pop 한다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    expect(view.getByText('개인정보 처리방침')).toBeTruthy()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })

  // : **사본을 두지 않는다**. 같은 사이트를 싣기만 한다. 그래서 이 화면이
  // 아는 것은 주소 하나뿐이고, 본문은 저장소 루트 `PRIVACY.md` 의 단일 원본에서 온다.
  it('사본이 아니라 사이트를 그대로 싣는다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    expect(view.getByTestId('privacy-frame').props.source).toEqual({ uri: PRIVACY_URL })
  })

  // `ScreenScroll` 을 쓰지 않는다. 문서가 자기 스크롤을 갖는다.
  it('셸의 스크롤 상자를 쓰지 않는다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    expect(view.queryByTestId('screen-scroll')).toBeNull()
  })

  it('불러오는 동안 로딩 표시를 덮는다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    expect(view.getByText('불러오는 중')).toBeTruthy()
  })

  it('로드가 끝나면 로딩 표시가 사라진다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    await fire(view, 'load')

    expect(view.queryByText('불러오는 중')).toBeNull()
    expect(view.getByTestId('privacy-frame')).toBeTruthy()
  })

// 교차 출처 `iframe` 은 실패에 `error` 를 신뢰성 있게 발화하지 않아
  // 타임아웃이 유일한 신호였는데, `WebView` 는 발화한다(`SettingsPrivacyScreen.tsx` 파일 머리).
  it('로드에 실패하면 곧바로 실패 화면으로 간다. 8초를 기다리지 않는다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    await fire(view, 'error')

    expect(view.getByText('처리방침을 불러오지 못했습니다')).toBeTruthy()
    expect(view.queryByTestId('privacy-frame')).toBeNull()
  })

  // 타임아웃은 **보조 신호로 내려갔다**. "받아 놓고 응답하지 않는" 매달림만 맡는다.
  it('응답이 없으면 8초 뒤 실패로 본다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    await act(async () => {
      jest.advanceTimersByTime(8000)
    })

    expect(view.getByText('처리방침을 불러오지 못했습니다')).toBeTruthy()
  })

  it('로드에 성공하면 타임아웃이 더는 발화하지 않는다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    await fire(view, 'load')
    await act(async () => {
      jest.advanceTimersByTime(8000)
    })

    expect(view.queryByText('처리방침을 불러오지 못했습니다')).toBeNull()
    expect(view.getByTestId('privacy-frame')).toBeTruthy()
  })

  // : 실패의 원인을 **실제로 푸는 행동**을 준다. 여기서 안 되는 것을 되는
  // 곳으로 보낸다. "다시 시도"는 오프라인에서 같은 실패를 반복할 뿐이다.
  it('실패하면 "브라우저로 열기"로 앱 밖에서 볼 길을 준다', async () => {
    const view = await renderOverlay(<SettingsPrivacyScreen />)

    await fire(view, 'error')
    await press(buttonOf(view, '브라우저로 열기'))

    expect(openURL).toHaveBeenCalledWith(PRIVACY_URL)
    expect(view.queryByText('다시 시도')).toBeNull()
  })
})
