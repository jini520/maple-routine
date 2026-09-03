import { StatusBar } from 'react-native'

import { rnStatusBarPort } from '../rn-status-bar'

/**
 * 이 파일이 지키는 것은 **명암의 방향** 하나다.
 *
 * `setStyle(isDarkTheme)` 의 인자는 테마가 어두운가 이고, 상태바 글리프는 그 **반대** 명암이어야
 * 읽힌다. 즉 `isDarkTheme === true` → **밝은 글리프**다. 뒤집으면 어두운 배경에 어두운 글자가
 * 되어 상태바가 통째로 안 보이는데, 그것은 실기기에서만 드러난다.
 */
describe('rnStatusBarPort', () => {
  function spyOnSetBarStyle() {
    return jest.spyOn(StatusBar, 'setBarStyle').mockImplementation(() => {})
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('다크 테마면 밝은 글리프', async () => {
    const setBarStyle = spyOnSetBarStyle()

    await rnStatusBarPort.setStyle(true)

    expect(setBarStyle).toHaveBeenCalledWith('light-content')
  })

  it('라이트 테마면 어두운 글리프(Capacitor Style.Light 와 같은 방향)', async () => {
    const setBarStyle = spyOnSetBarStyle()

    await rnStatusBarPort.setStyle(false)

    expect(setBarStyle).toHaveBeenCalledWith('dark-content')
  })

  // `'default'` 는 **OS 다크모드 설정**을 따르는 값이라 앱이 고른 테마와 어긋난다(라이트 테마를 쓰는
  // 다크모드 기기에서 밝은 배경에 밝은 글자).
  it("OS 설정을 따라가는 'default' 는 쓰지 않는다", async () => {
    const setBarStyle = spyOnSetBarStyle()

    await rnStatusBarPort.setStyle(true)
    await rnStatusBarPort.setStyle(false)

    expect(setBarStyle).not.toHaveBeenCalledWith('default')
    expect(setBarStyle.mock.calls.map(([style]) => style)).toEqual([
      'light-content',
      'dark-content',
    ])
  })

  it('두 입력이 서로 다른 값으로 간다', async () => {
    const setBarStyle = spyOnSetBarStyle()

    await rnStatusBarPort.setStyle(true)
    await rnStatusBarPort.setStyle(false)

    const [dark, light] = setBarStyle.mock.calls.map(([style]) => style)
    expect(dark).not.toBe(light)
  })
})
