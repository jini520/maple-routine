/**
 * 넥슨을 부를 때 넘기는 자격 하나.
 *
 * **문자열이 아니라 객체인 것이 요점이다.** 넥슨 로그인이 붙으면 프렌즈 API 넷만 서버를 거치고
 * 나머지는 지금처럼 넥슨을 직접 부르는데, 그 갈림을 `nexon/http.ts` 한 자리에 모으려면 부르는
 * 쪽이 **어떤 자격인지** 를 함께 넘겨야 한다. 지금은 종류가 하나라 갈리는 것이 없다.
 */
export type NexonCredential = {
  kind: 'apiKey'
  /** `x-nxopen-api-key` 헤더에 그대로 실린다. */
  value: string
}

export interface NexonAuthConfig {
  apiKey: string
}
