import { Appearance } from 'react-native'

import { rnColorSchemePort } from '../rn-color-scheme'

afterEach(() => {
  jest.restoreAllMocks()
})

describe('rnColorSchemePort', () => {
  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
  ] as const)('OS 가 %s 면 %s 로 답한다', (osValue, expected) => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(osValue)

    expect(rnColorSchemePort.get()).toBe(expected)
  })

  // `Appearance.getColorScheme()` 은 답을 모를 때 `null` 을 준다(네이티브 Appearance 모듈이 없거나
  // OS가 판정을 안 준 경우 — `Appearance.js:76-91`). 모르는 것을 '다크'로 읽으면 **저장된 테마가 없는
  // 첫 실행이 통째로 다크로 열린다.** Capacitor 구현이 `matchMedia` 부재에 라이트로 폴백한 것과 같은
  // 판단이다.
  it.each([[null], [undefined]])('OS 판정을 못 하면(%p) 라이트로 폴백한다', (osValue) => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(osValue)

    expect(rnColorSchemePort.get()).toBe('light')
  })

  // 포트가 동기인 것은 우연이 아니라 계약이다(`ports.ts:29`) — 테마 복원이 첫 페인트 전에 끝나야
  // 라이트 기본값이 한 프레임 새지 않는다.
  it('동기다 — Promise 를 돌려주지 않는다', () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark')

    expect(rnColorSchemePort.get()).not.toBeInstanceOf(Promise)
  })

  // 포트 주석의 판단을 구조로 고정한다 — 부를 곳이 없는 구독 API는 구현마다 죽은 코드가 된다
  // ([[ADR-104]]: 실행 중 OS 설정 변경은 따라가지 않는다).
  it('구독 API 를 두지 않는다 — 키는 get 하나뿐', () => {
    expect(Object.keys(rnColorSchemePort)).toEqual(['get'])
  })

  it('get() 은 OS 변경 구독을 걸지 않는다', () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark')
    const addChangeListener = jest.spyOn(Appearance, 'addChangeListener')

    rnColorSchemePort.get()

    expect(addChangeListener).not.toHaveBeenCalled()
  })
})
