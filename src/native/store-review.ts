import { getStoreReviewPort } from './ports'

/**
 * OS 의 앱 안 리뷰 팝업 요청. 저장 뒤 리뷰 요청(`features/app-review/request.ts`)이 부른다.
 *
 * 팝업이 떴는지는 알 수 없다. 거절은 부른 쪽이 삼킨다.
 */
export function requestStoreReview(): Promise<void> {
  return getStoreReviewPort().request()
}
