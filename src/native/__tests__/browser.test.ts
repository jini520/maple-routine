// 인앱 브라우저는 **누름을 막으면 안 된다**. 열지 못해도 화면은 그대로 서 있어야 하고, 거절이
// 흘러나가면 링크 누름 하나가 처리되지 않은 거부로 남는다.
import { openAuthSession, openInAppBrowser } from '../browser'
import { __resetNativePortsForTest, setBrowserPort } from '../ports'

afterEach(__resetNativePortsForTest)

const noAuthSession = async () => null

describe('openInAppBrowser', () => {
  it('포트를 그 주소로 부른다', () => {
    const open = jest.fn().mockResolvedValue(undefined)
    setBrowserPort({ open, openAuthSession: noAuthSession })

    openInAppBrowser('https://openapi.nexon.com')

    expect(open).toHaveBeenCalledWith('https://openapi.nexon.com')
  })

  it('거절해도 부른 쪽으로 새어 나가지 않는다', async () => {
    setBrowserPort({
      open: () => Promise.reject(new Error('열 수 없음')),
      openAuthSession: noAuthSession,
    })

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

// 로그인은 실패를 스스로 가려야 해서, 거절을 삼키지 않고 그대로 돌려준다.
describe('openAuthSession', () => {
  it('포트가 돌려준 주소를 그대로 돌려준다', async () => {
    const openAuth = jest.fn().mockResolvedValue('app://cb?receipt=r')
    setBrowserPort({ open: async () => {}, openAuthSession: openAuth })

    await expect(openAuthSession('https://login', 'app://cb')).resolves.toBe('app://cb?receipt=r')
    expect(openAuth).toHaveBeenCalledWith('https://login', 'app://cb')
  })

  it('거절은 부른 쪽으로 그대로 간다', async () => {
    setBrowserPort({
      open: async () => {},
      openAuthSession: () => Promise.reject(new Error('세션 실패')),
    })

    await expect(openAuthSession('https://login', 'app://cb')).rejects.toThrow('세션 실패')
  })
})
