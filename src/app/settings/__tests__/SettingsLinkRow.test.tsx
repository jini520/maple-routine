// 이 화면이 지키는 것을 적는다.
//
// 갈린 것 셋
// ① `getByRole('link')` + `href` → **`Linking.openURL` 이 무엇으로 불렸는가**(`ApiKeyForm` 테스트와
//    같은 처방). 역할은 `role="link"` 로 그대로 남는다.
// ② **새 컨텍스트로 열고 opener를 넘기지 않는다는 옮길 계약이 아니다**. `rel="noopener"` 가
//    막던 것은 브라우저 탭 사이의 관계이고, OS 브라우저는 우리 프로세스 밖이라 그 관계가 없다
//    (`SettingsLinkRow.tsx`).
// ③ 라벨 타이포 대조는 클래스가 아니라 **컴파일된 스타일**로 한다.
import { fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

import {
  flattenStyle,
  renderAtom,
  기본테마,
  type AtomElement,
} from '../../../components/__tests__/render-atom'
import { resolveCardInset } from '../../../theme/theme-vars'
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

  // `문의 · 버그 제보` 는 고르는 모달을 먼저 연다. 어느 칸을 골라도 앱을 떠나서 외부 링크 아이콘은 그대로다.
  it('onPress 를 받으면 주소를 열지 않고 누름만 알린다', async () => {
    const onPress = jest.fn()
    const view = await renderAtom(<SettingsLinkRow label="문의 · 버그 제보" onPress={onPress} />)

    let node: AtomElement | null = view.getByText('문의 · 버그 제보')
    while (node !== null && node.props.role !== 'button') node = node.parent
    if (node === null) throw new Error('버튼 행을 찾지 못했다')
    fireEvent.press(node)

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(openURL).not.toHaveBeenCalled()
    expect(view.getByTestId('settings-row-external')).toBeTruthy()
  })

  // chevron 은 "다음 화면이 열린다"는 약속이다. 앱을 떠나는 행이 그것을 쓰면
  // 같은 약속을 하고 다른 일을 한다.
  it('chevron이 아니라 외부 링크 아이콘을 보여준다', async () => {
    const view = await renderAtom(<SettingsLinkRow label="개인정보 처리방침" href="https://x" />)

    expect(view.getByTestId('settings-row-external')).toBeTruthy()
    expect(view.queryByTestId('settings-row-chevron')).toBeNull()
  })

  // 둘을 **한 트리에** 그린다. 렌더를 두 번 하면 앞선 `act` 가 아직 안 닫혀 겹친다(RNTL 14 의
  // `render` 는 비동기다, `RootNavigator` 테스트).
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

  it('행은 SettingsRow 와 같은 card-inset 칸이다', async () => {
    const view = await renderAtom(<SettingsLinkRow label="개발자 응원하기(앱 리뷰)" href="itms-apps://x" />)

    expect(flattenStyle(linkOf(view, '개발자 응원하기(앱 리뷰)').props.style).backgroundColor).toBe(
      resolveCardInset(기본테마),
    )
  })
})
