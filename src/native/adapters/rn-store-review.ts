import { isAvailableAsync, requestReview } from 'expo-store-review'

import type { StoreReviewPort } from '../ports'

/**
 * `StoreReviewPort` 의 RN 구현. iOS 는 `SKStoreReviewController`, 안드로이드는 Play In-App Review API.
 *
 * 쓸 수 없는 환경(TestFlight 설치본 등)에서는 부르지 않는다. 네이티브 모듈이 없으면 라이브러리가 스토어 페이지를
 * 대신 여는데, 사용자가 누르지 않은 화면 이동이 된다.
 */
export const rnStoreReviewPort: StoreReviewPort = {
  async request() {
    if (!(await isAvailableAsync())) return
    await requestReview()
  },
}
