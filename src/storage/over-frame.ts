import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

// 오버 프레임(머리를 원 밖으로 그리는 얼굴) 켜짐. 저장된 값이 없으면 켜짐이다. 'off' 를 저장했을 때만 끈다.

export async function getOverFrameEnabled(): Promise<boolean> {
  const value = await preferences.get(STORAGE_KEYS.overFrame)
  return value !== 'off'
}

export async function setOverFrameEnabled(enabled: boolean): Promise<void> {
  await preferences.set(STORAGE_KEYS.overFrame, enabled ? 'on' : 'off')
}
