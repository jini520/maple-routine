// 인앱 브라우저는 **누름을 막으면 안 된다**. 열지 못해도 화면은 그대로 서 있어야 하고, 거절이
// 흘러나가면 링크 누름 하나가 처리되지 않은 거부로 남는다.
import { openInAppBrowser } from '../browser'
import { __resetNativePortsForTest, setBrowserPort } from '../ports'

afterEach(__resetNativePortsForTest)

describe('openInAppBrowser', () => {
  it('포트를 그 주소로 부른다', () => {
    const open = jest.fn().mockResolvedValue(undefined)
    setBrowserPort({ open })

    openInAppBrowser('https://openapi.nexon.com')

    expect(open).toHaveBeenCalledWith('https://openapi.nexon.com')
  })

  it('거절해도 부른 쪽으로 새어 나가지 않는다', async () => {
    setBrowserPort({ open: () => Promise.reject(new Error('열 수 없음')) })

    expect(() => {
      openInAppBrowser('https://openapi.nexon.com')
    }).not.toThrow()
    // 거부가 마이크로태스크 큐에 남아 있으면 여기서 처리되지 않은 거부로 터진다.
    await Promise.resolve()
  })

  // 배선 사고는 조용히 넘어가면 안 된다. 이 기기에서 못 연다 와 구분이 없어진다.
  it('포트가 주입되지 않았으면 던진다', () => {
    __resetNativePortsForTest()

    expect(() => {
      openInAppBrowser('https://openapi.nexon.com')
    }).toThrow(/BrowserPort/)
  })
})
