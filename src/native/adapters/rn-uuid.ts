import { randomUUID } from 'expo-crypto'

import type { UuidPort } from '../ports'

/** `UuidPort` 의 RN 구현. 동기로 부를 수 있는 Expo 공식 모듈이다 */
export const rnUuidPort: UuidPort = {
  random: () => randomUUID(),
}
