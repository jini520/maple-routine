// 웹판(108줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① **라우터 프로브가 없다** — 뒤로·이동은 `goBack`/`navigate` 가 무엇으로 불렸는가로 본다
//    (`SettingsScreen` 테스트 파일 머리 ①).
// ② `getByRole('heading')` 이 없다 — RN 에 heading 역할이 없어 **제목 글자**로 본다. 웹의
//    「제목이 하나뿐」 케이스도 그래서 「업데이트 카드가 자기 제목을 그리지 않는다」로만 남는다.
// ③ **OTA 상태를 목으로 만들 수 없다.** 스토어를 값으로 import 하는 것만으로 죽어([[ADR-128]]
//    결정 7) 이 화면이 상태를 **상수로 심는다** — 그래서 웹의 「최신이면 최신 버전입니다」는 여기서
//    검사할 수 없고, 대신 **지금 실제로 도달하는 상태**(`unsupported`)를 검사한다. 문구 열넷의
//    계약은 `AppUpdateSection` 테스트가 프롭을 직접 넣어 지킨다.
import { act, fireEvent } from '@testing-library/react-native'

import packageJson from '../../../../package.json'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsAboutScreen } from '../SettingsAboutScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const navigate = jest.fn()
const goBack = jest.fn()

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

beforeEach(() => {
  mockedUseSettingsNavigation.mockReturnValue({ navigate, goBack } as unknown as ReturnType<
    typeof useSettingsNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsAboutScreen', () => {
  // 골격은 관리 페이지와 같다([[ADR-118]] 결정 2) — `ScreenScroll` + `PageHeader` + `ArrowLeft`.
  it('"앱 정보" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 pop 한다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText('앱 정보')).toBeTruthy()
    expect(view.getByTestId('page-header')).toBeTruthy()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })

  // 스택 위로 올라간 화면에는 탭바가 없다([[ADR-120]] 결정 4) — 셸이 하단 인셋을 그렇게 잡는다.
  it('자기 스크롤 컨테이너를 갖는다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByTestId('screen-scroll')).toBeTruthy()
  })

  it('업데이트 카드(현재 버전·상태)를 품는다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText('현재 버전')).toBeTruthy()
    expect(view.getByText('상태')).toBeTruthy()
  })

  // 페이지 제목이 이미 「앱 정보」라 업데이트 카드가 자기 제목을 또 그리면 중복이다([[ADR-118]] 결정 2).
  it('업데이트 카드가 "앱 업데이트" 제목을 다시 그리지 않는다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.queryByText('앱 업데이트')).toBeNull()
  })

  // [[ADR-128]] 결정 7: `LiveUpdatePort` 가 던져 확인 경로가 없다. **없는 것을 있는 척하지 않는
  // 것이 이 화면의 계약**이라 확인 버튼도 함께 사라진다.
  it('OTA 가 안 붙어 있어 상태는 미지원이고 확인 버튼이 없다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText('이 플랫폼에서는 지원되지 않습니다')).toBeTruthy()
    expect(view.queryByText('업데이트 확인')).toBeNull()
  })

  // 실행 중인 번들 버전을 물을 수 없어 **빌드 시점 값**을 폴백으로 넘긴다(`SettingsScreen` 과 같은 자리).
  it('현재 버전은 빌드 시점 package.json 버전이다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    expect(view.getByText(packageJson.version)).toBeTruthy()
  })

  // [[ADR-118]] 결정 7 · [[ADR-120]] 결정 11: 앱을 벗어나던 링크가 앱 안 하위 페이지가 됐다.
  // 사본을 만드는 것이 아니라 같은 사이트를 싣는 것이라 "법적 문서를 두 벌로 만들지 않는다"는 그대로다.
  it('개인정보 처리방침 행이 앱 밖으로 나가지 않고 하위 페이지를 민다', async () => {
    const view = await renderOverlay(<SettingsAboutScreen />)

    // 외부 링크 행이면 chevron 이 아니라 외부 링크 아이콘이 선다 — 그 표식이 없어야 한다.
    expect(view.queryByTestId('settings-row-external')).toBeNull()

    await press(buttonOf(view, '개인정보 처리방침'))

    expect(navigate).toHaveBeenCalledWith('SettingsPrivacy')
  })
})
