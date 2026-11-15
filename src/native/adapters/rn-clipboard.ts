import { setStringAsync } from 'expo-clipboard'
import { Platform } from 'react-native'

import type { ClipboardPort } from '../ports'

/** OS 가 클립보드 복사 알림을 스스로 띄우기 시작한 안드로이드 API 레벨. 안드로이드 13 이다. */
const ANDROID_COPY_NOTICE_API = 33

/** `ClipboardPort` 의 RN 구현. */
export const rnClipboardPort: ClipboardPort = {
  async setText(text) {
    await setStringAsync(text)
  },

  announcesCopy() {
    return Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_COPY_NOTICE_API
  },
}
