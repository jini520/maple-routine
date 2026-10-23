// 인앱 브라우저는 **누름을 막으면 안 된다**. 열지 못해도 화면은 그대로 서 있어야 하고, 거절이
// 흘러나가면 링크 누름 하나가 처리되지 않은 거부로 남는다.
import { Linking } from 'react-native'

import { getThemeDefinition } from '../../lib/theme/theme-registry'
import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../theme/appearance-store'
import { openAuthSession, openInAppBrowser } from '../browser'
import { __resetNativePortsForTest, setBrowserPort } from '../ports'

afterEach(() => {
  __resetNativePortsForTest()
  __resetThemeAppearanceForTest()
  // RN 프리셋의 `Linking.openURL` 은 이미 목이라 `spyOn` 이 같은 목을 돌려준다. 되돌리기만 하면 부른 기록이 남는다.
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

const noAuthSession = async () => null

/** 거절이 마이크로태스크 큐를 다 지나가게 기다린다. 남아 있으면 처리되지 않은 거부로 터진다. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('openInAppBrowser', () => {
  // 창 상단 막대가 앱 머리와 같은 바탕이어야 창이 앱의 하위 화면처럼 이어진다. 기본 테마가 아닌
  // 테마로 재야 고정값을 넘기는 실수가 걸린다.
  it('창에 지금 테마의 바탕색과 버튼색을 넘긴다', () => {
    const definition = getThemeDefinition('혼테일')
    setThemeAppearance('혼테일', definition)
    const open = jest.fn(async () => {})
    setBrowserPort({ open, openAuthSession: noAuthSession })

    openInAppBrowser('https://mapleroutine.store/privacy')

    expect(open).toHaveBeenCalledWith('https://mapleroutine.store/privacy', {
      toolbarColor: definition.bg,
      controlsColor: definition.primaryInk,
    })
  })

  // 안드로이드에 Custom Tabs 를 받는 브라우저가 없으면 창이 거절한다. 그대로 삼키면 눌러도 아무
  // 일이 안 일어난다.
  it('창을 못 열면 시스템 브라우저로 넘긴다', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    setBrowserPort({
      open: () => Promise.reject(new Error('No matching browser activity found')),
      openAuthSession: noAuthSession,
    })

    openInAppBrowser('https://openapi.nexon.com')
    await flush()

    expect(openURL).toHaveBeenCalledWith('https://openapi.nexon.com')
  })

  it('창이 열리면 시스템 브라우저를 열지 않는다', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    setBrowserPort({ open: async () => {}, openAuthSession: noAuthSession })

    openInAppBrowser('https://openapi.nexon.com')
    await flush()

    expect(openURL).not.toHaveBeenCalled()
  })

  it('시스템 브라우저마저 거절해도 부른 쪽으로 새어 나가지 않는다', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('열 수 없음'))
    setBrowserPort({
      open: () => Promise.reject(new Error('열 수 없음')),
      openAuthSession: noAuthSession,
    })

    expect(() => {
      openInAppBrowser('https://openapi.nexon.com')
    }).not.toThrow()
    await flush()
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
  it('거절은 부른 쪽으로 그대로 간다', async () => {
    setBrowserPort({
      open: async () => {},
      openAuthSession: () => Promise.reject(new Error('세션 실패')),
    })

    await expect(openAuthSession('https://login', 'app://cb')).rejects.toThrow('세션 실패')
  })
})
