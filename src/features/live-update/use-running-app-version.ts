/**
 * 화면이 보이는 앱 버전. 부팅 때 `checkOnBoot` 가 채운 도는 번들의 버전이고, 라이브 업데이트
 * 런타임이 없어 비었을 때만 `package.json` 버전.
 *
 * `package.json` 을 바로 읽으면 안 된다. 그 값은 OTA 버전이라 스토어 바이너리의 버전과 따로 움직인다.
 *
 * @example
 * const displayedVersion = useRunningAppVersion()
 */
import packageJson from '../../../package.json'
import { useLiveUpdateStore } from './store'

export function useRunningAppVersion(): string {
  return useLiveUpdateStore((state) => state.currentVersion) ?? packageJson.version
}
