// 이 모달이 지키는 것을 적는다.
//
// ① 칸은 이름 글자에서 `role="button"` 까지 올라가 잡는다. RN 은 자식 글자를 합쳐 접근성 이름을
//    만들지 않는다.
// ② 칸을 누르면 모달부터 닫는다. 앱으로 돌아왔을 때 모달이 남아 있으면 다시 고르라는 것처럼 보인다.
// ③ 오픈채팅은 카카오톡의 그 방을 먼저 열고, 카카오톡이 없어 거절될 때만 안내 페이지로 간다.
import { act, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { __resetToastsForTest, useToastStore } from '../../../features/toast/store'
import { openInAppBrowser } from '../../../native/browser'
import { ContactModal } from '../ContactModal'
import { OPEN_CHAT_APP_URL, OPEN_CHAT_WEB_URL } from '../contact-open-chat'

jest.mock('../../../native/browser', () => ({ openInAppBrowser: jest.fn() }))

const openURL = jest.spyOn(Linking, 'openURL')
const MAIL_URL = 'mailto:support.mapleroutine@gmail.com?subject=a&body=b'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function cellOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`칸을 찾지 못했다: ${label}`)
  return node
}

beforeEach(() => {
  openURL.mockReset()
  openURL.mockResolvedValue(true)
  jest.mocked(openInAppBrowser).mockClear()
  __resetToastsForTest()
})

describe('ContactModal', () => {
  it('제목은 더보기 행 이름과 같고, 메일이 오픈채팅보다 위다', async () => {
    const view = await renderOverlay(<ContactModal mailUrl={MAIL_URL} onClose={jest.fn()} />)

    expect(view.getByText('문의 · 버그 제보')).toBeTruthy()
    expect(view.getAllByText(/^(메일|카카오톡 오픈채팅)$/).map((node) => node.children[0])).toEqual([
      '메일',
      '카카오톡 오픈채팅',
    ])
  })

  it('메일 칸은 모달을 닫고 받은 메일 주소를 연다', async () => {
    const onClose = jest.fn()
    const view = await renderOverlay(<ContactModal mailUrl={MAIL_URL} onClose={onClose} />)

    await press(cellOf(view, '메일'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(openURL).toHaveBeenCalledWith(MAIL_URL)
  })

  it('메일 앱을 못 열면 토스트가 뜬다', async () => {
    openURL.mockRejectedValueOnce(new Error('Unable to open URL'))
    const view = await renderOverlay(<ContactModal mailUrl={MAIL_URL} onClose={jest.fn()} />)

    await press(cellOf(view, '메일'))

    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['메일 앱을 열지 못했습니다'])
  })

  // https 주소를 그대로 열면 브라우저의 안내 페이지를 한 번 거친다. `open.kakao.com` 은 앱이 받는 링크가 아니다.
  it('오픈채팅 칸은 모달을 닫고 카카오톡의 그 방을 바로 연다', async () => {
    const onClose = jest.fn()
    const view = await renderOverlay(<ContactModal mailUrl={MAIL_URL} onClose={onClose} />)

    await press(cellOf(view, '카카오톡 오픈채팅'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(openURL.mock.calls).toEqual([[OPEN_CHAT_APP_URL]])
    expect(openInAppBrowser).not.toHaveBeenCalled()
  })

  // 안내 페이지에 카카오톡 설치 버튼이 있다. 웹 주소는 앱 전체가 인앱 브라우저로 연다.
  it('카카오톡이 없어 거절되면 안내 페이지를 인앱 브라우저로 연다', async () => {
    openURL.mockRejectedValueOnce(new Error('Unable to open URL'))
    const view = await renderOverlay(<ContactModal mailUrl={MAIL_URL} onClose={jest.fn()} />)

    await press(cellOf(view, '카카오톡 오픈채팅'))

    expect(openInAppBrowser).toHaveBeenCalledWith(OPEN_CHAT_WEB_URL)
    expect(useToastStore.getState().toasts).toEqual([])
  })
})
