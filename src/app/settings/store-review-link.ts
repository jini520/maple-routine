/**
 * 스토어 리뷰로 나가는 주소.
 *
 * 이 행은 앱 안 리뷰 팝업을 부르지 않는다. 팝업은 OS 할당량을 다 쓰면 아무것도 안 뜨므로, 버튼으로 받는 리뷰는
 * 스토어로 보낸다. 팝업은 저장 뒤 리뷰 요청(`features/app-review/request.ts`)만 부른다.
 *
 * 플랫폼 분기를 화면에 인라인으로 적지 않고 여기 두는 이유는 두 갈래를 다 재기 위해서다.
 *
 * iOS 앱 id 는 업데이트 링크(`native/adapters/rn-live-update.ts`)도 같은 값을 갖는다. 상수로
 * 모으려면 화면이 네이티브 어댑터를 import 해야 해서 안 모았다.
 *
 * @param platform `Platform.OS`. 화면이 넘긴다.
 */
export function storeReviewUrl(platform: string): string {
  if (platform === 'ios') return 'itms-apps://apps.apple.com/app/id6797579391?action=write-review'
  // Play 는 리뷰 작성으로 바로 가는 주소를 안 내준다. 스토어 페이지에 별점 UI 가 있다.
  return 'market://details?id=com.mapleroutine.app'
}
