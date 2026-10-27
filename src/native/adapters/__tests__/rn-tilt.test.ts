import { Accelerometer } from 'expo-sensors'
import { Platform } from 'react-native'

import { rnTiltPort } from '../rn-tilt'

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}))

/**
 * 이 파일이 지키는 것은 **두 플랫폼이 같은 방향의 기울기를 낸다** 하나다.
 *
 * 안드로이드 가속도계는 iOS 와 부호가 반대다. 맞추지 않으면 같은 쪽으로 기울여도 빛이 플랫폼마다 반대로 밀리고,
 * 한 플랫폼에서만 보면 이상한 줄 모른다.
 */
function setPlatform(os: string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true })
}

const originalPlatform = Platform.OS

/** 센서 한 번의 값을 어댑터에 흘려 보내고, 어댑터가 내보낸 기울기를 돌려준다. */
async function emit(sample: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const listener = jest.fn()
  rnTiltPort.subscribe(listener)
  await Promise.resolve()
  const sensorListener = jest.mocked(Accelerometer.addListener).mock.calls.at(-1)![0]
  sensorListener({ ...sample, z: 0, timestamp: 0 })
  return listener.mock.calls[0][0]
}

describe('rnTiltPort', () => {
  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it('iOS 값은 그대로 낸다', async () => {
    setPlatform('ios')
    expect(await emit({ x: 0.3, y: -0.8 })).toEqual({ x: 0.3, y: -0.8 })
  })

  it('안드로이드 값은 부호를 뒤집어 iOS 와 같은 방향으로 낸다', async () => {
    setPlatform('android')
    expect(await emit({ x: -0.3, y: 0.8 })).toEqual({ x: 0.3, y: -0.8 })
  })
})
