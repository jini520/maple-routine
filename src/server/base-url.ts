/**
 * 앱이 부르는 서버의 주소. 앱 박스 nginx 가 서버가 있는 박스로 넘기므로, 서버를 다른 박스로 옮겨도 이 값은 그대로다.
 */
export const SERVER_ORIGIN = 'https://api.mapleroutine.store'

/** 서버 경로(`/v1`)의 앞부분 */
export const API_BASE_URL = `${SERVER_ORIGIN}/v1`
