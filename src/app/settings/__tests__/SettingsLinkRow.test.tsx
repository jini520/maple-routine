// 이 화면이 지키는 것을 적는다.
//
// 갈린 것 셋
// ① `getByRole('link')` + `href` → **`Linking.openURL` 이 무엇으로 불렸는가**(`ApiKeyForm` 테스트와
//    같은 처방). 역할은 `role="link"` 로 그대로 남는다.
// ② **새 컨텍스트로 열고 opener를 넘기지 않는다는 옮길 계약이 아니다**. `rel="noopener"` 가
//    막던 것은 브라우저 탭 사이의 관계이고, OS 브라우저는 우리 프로세스 밖이라 그 관계가 없다
//    (`SettingsLinkRow.tsx` 파일 머리 ②).
// ③ 라벨 타이포 대조는 클래스가 아니라 **컴파일된 스타일**로 한다.
import { fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

import {
  flattenStyle,
  renderAtom,
  type AtomElement,
} from '../../../components/__tests__/render-atom'
import { SettingsLinkRow } from '../SettingsLinkRow'
import { SettingsRow } from '../SettingsRow'

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

type Rendered = Awaited<ReturnType<typeof renderAtom>>

function linkOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'link') node = node.parent
  if (node === null) throw new Error(`링크 행을 찾지 못했다: ${label}`)
  return node
}

beforeEach(() => {
  openURL.mockClear()
})

describe('SettingsLinkRow', () => {
  it('label을 링크 역할로 렌더링하고 누르면 그 주소를 연다', async () => {
    const view = await renderAtom(
      <SettingsLinkRow label="개인정보 처리방침" href="https://mapleroutine.store/privacy" />,
    )

    fireEvent.press(linkOf(view, '개인정보 처리방침'))

    expect(openURL).toHaveBeenCalledWith('https://mapleroutine.store/privacy')
  })

  // : chevron 은 "다음 화면이 열린다"는 약속이다. 앱을 떠나는 행이 그것을 쓰면
  // 같은 약속을 하고 다른 일을 한다.
  it('chevron이 아니라 외부 링크 아이콘을 보여준다', async () => {
    const view = await renderAtom(<SettingsLinkRow label="개인정보 처리방침" href="https://x" />)

    expect(view.getByTestId('settings-row-external')).toBeTruthy()
    expect(view.queryByTestId('settings-row-chevron')).toBeNull()
  })

  // 둘을 **한 트리에** 그린다. 렌더를 두 번 하면 앞선 `act` 가 아직 안 닫혀 겹친다(RNTL 14 의
  // `render` 는 비동기다, `RootNavigator` 테스트 파일 머리).
  it('label 타이포는 SettingsRow의 비-danger 라벨과 같다', async () => {
    const view = await renderAtom(
      <>
        <SettingsLinkRow label="링크행" href="https://x" />
        <SettingsRow label="버튼행" onPress={jest.fn()} />
      </>,
    )

    expect(flattenStyle(view.getByText('링크행').props.style)).toEqual(
      flattenStyle(view.getByText('버튼행').props.style),
    )
  })
})
