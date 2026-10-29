// 넥슨 공지 본문을 그리는 자리. 서버가 HTML 을 블록으로 바꿔 주므로 여기서는 종류마다
// 무엇을 세우는지만 지킨다.
//
// **이벤트·캐시샵 본문은 이미지 한 장뿐이다**(실측). 그래서 이미지를 못 그리면 그 두 분류는
// 상세 화면이 통째로 빈칸이 된다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { openInAppBrowser } from '../../../native/browser'
import type { NoticeBlock } from '../../../types/notice'
import { NoticeBlocks } from '../NoticeBlocks'

jest.mock('../../../native/browser', () => ({ openInAppBrowser: jest.fn() }))

describe('공지 본문 블록', () => {
  // 넥슨이 실제 크기를 알려 주기 전에는 비율을 모른다. 높이가 0이면 이미지가 안 보인다.
  it('비율을 받기 전에도 높이를 갖는다', async () => {
    const view = await renderOverlay(
      <NoticeBlocks blocks={[{ type: 'image', src: 'https://x.test/a.png' }]} />,
    )

    expect(view.getByTestId('notice-image').props.style.aspectRatio).toBeGreaterThan(0)
  })

  // 그림 한 장이 수 MB 라 받는 데 수 초가 걸린다. 그동안 빈칸이면 본문이 없는 공지로 읽힌다.
  it('받는 동안만 스켈레톤이 선다', async () => {
    const view = await renderOverlay(
      <NoticeBlocks blocks={[{ type: 'image', src: 'https://x.test/a.png' }]} />,
    )

    expect(view.getByTestId('notice-image-skeleton', { includeHiddenElements: true })).toBeTruthy()

    await act(async () => {
      fireEvent(view.getByTestId('notice-image'), 'load', {
        nativeEvent: { cacheType: 'none', source: { url: 'https://x.test/a.png', width: 876, height: 4000 } },
      })
    })

    expect(view.queryByTestId('notice-image-skeleton', { includeHiddenElements: true })).toBeNull()
  })

  // 그냥 두면 자리만 잡은 빈칸이 남는다. 이벤트·캐시샵은 본문이 이미지 한 장뿐이라 그 빈칸이
  // 곧 `본문이 없는 공지` 로 읽힌다.
  it('못 받은 이미지는 못 받았다고 말한다', async () => {
    const view = await renderOverlay(
      <NoticeBlocks blocks={[{ type: 'image', src: 'https://x.test/없는것.png' }]} />,
    )

    await act(async () => {
      fireEvent(view.getByTestId('notice-image'), 'error', { nativeEvent: { error: 'not found' } })
    })

    expect(view.getByTestId('notice-image-failed')).toBeTruthy()
    expect(view.queryByTestId('notice-image')).toBeNull()
  })

  it('링크를 누르면 인앱 브라우저로 연다', async () => {
    const blocks: NoticeBlock[] = [
      { type: 'link', text: '[바로가기]', href: 'https://maplestory.nexon.com/News/Notice/1' },
    ]

    const view = await renderOverlay(<NoticeBlocks blocks={blocks} />)
    fireEvent.press(view.getByLabelText('[바로가기]'))

    expect(openInAppBrowser).toHaveBeenCalledWith('https://maplestory.nexon.com/News/Notice/1')
  })

})
