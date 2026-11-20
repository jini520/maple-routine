import { Platform } from 'react-native'

import { rnClipboardPort } from '../rn-clipboard'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))

/**
 * 이 파일이 지키는 것은 **OS 가 복사를 알리는 기기의 경계** 하나다.
 *
 * 안드로이드 13(API 33)부터 OS 가 클립보드에 값이 들어가면 스스로 알림을 띄운다. 경계가 낮으면 12 이하에서
 * 아무 알림도 안 뜨고, 높으면 13 에서 OS 알림과 앱 토스트가 함께 뜬다.
 */
function setPlatform(os: string, version: number | string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true })
  Object.defineProperty(Platform, 'Version', { value: version, configurable: true, writable: true })
}

const originalOs = Platform.OS
const originalVersion = Platform.Version

describe('rnClipboardPort.announcesCopy', () => {
  afterEach(() => {
    setPlatform(originalOs, originalVersion)
  })

  it('안드로이드 13(API 33)부터 OS 가 복사를 알리는 기기로 본다', () => {
    setPlatform('android', 33)
    expect(rnClipboardPort.announcesCopy()).toBe(true)

    setPlatform('android', 32)
    expect(rnClipboardPort.announcesCopy()).toBe(false)
  })
})
