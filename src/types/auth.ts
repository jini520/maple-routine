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

/**
 * 저장된 API 키 하나.
 *
 * **이름이 붙는다.** 값이 비슷하게 생겨서 이름 없이는 목록에서 구분이 안 된다. 우리가 지어내지
 * 않으므로 사용자가 안 붙였으면 빈 문자열이다.
 */
export interface NexonApiKeyMethod {
  kind: 'apiKey'
  label: string
  value: string
}

/**
 * 넥슨 로그인 하나. 토큰은 서버가 들고 앱은 세션만 받는다.
 *
 * **자리는 있지만 아직 아무도 안 채운다.** 채우는 것은 로그인 흐름이다.
 */
export interface NexonLoginMethod {
  kind: 'login'
  /** 서버가 발급한 세션 식별자. `x-nexon-session` 헤더로 서버에 되돌아간다. */
  session: string
}

/**
 * 기기에 저장된 인증 수단 전부.
 *
 * **넥슨 로그인 0~1개 + API 키 0개 이상**이다. 로그인이 0~1개인 것은 그것이 앱 사용자를
 * 식별하는 축이고 키는 거기 붙는 자원이기 때문이다. 복수 키의 목적은 **다른 넥슨 계정의
 * 캐릭터까지 보는 것**이라, 같은 계정의 키를 여럿 둘 이유는 없다.
 *
 * 둘 다 없으면 저장된 설정 자체가 `null` 이고 앱은 로그인 화면을 세운다.
 */
export interface NexonAuthConfig {
  login: NexonLoginMethod | null
  apiKeys: NexonApiKeyMethod[]
}
