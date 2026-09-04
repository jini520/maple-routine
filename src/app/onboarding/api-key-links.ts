/**
 * 키를 받으러 나가는 두 곳. 폼과 개발 단계 안내 모달이 같은 주소를 쓴다.
 *
 * 두 벌로 두면 안내 사이트를 옮기는 날 한쪽만 따라가고, 그때 어긋난 쪽은 아무도 안 누르는
 * 링크가 아니라 **막힌 사용자에게만 보이는** 링크다.
 */

/** 1차 경로. 처음 쓰는 사용자를 넥슨 첫 화면에 떨궈 놓지 않는다. */
export const GUIDE_URL = 'https://mapleroutine.store/api-key'

/** 이미 키를 발급받은 사용자의 동선. 7단계 안내를 경유시키지 않는다. */
export const NEXON_OPEN_API_URL = 'https://openapi.nexon.com'
