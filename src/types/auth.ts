/**
 * 넥슨을 부를 때 넘기는 자격 하나.
 *
 * **문자열이 아니라 객체인 것이 요점이다.** 경로마다 실을 것이 달라서(프렌즈는 액세스 토큰,
 * 나머지는 API 키) 부르는 쪽이 **어떤 자격인지** 를 함께 넘겨야 한다. 그 갈림은
 * `nexon/http.ts` 의 `routeOf` 한 자리에 모인다.
 */
export type NexonCredential =
  | {
      kind: 'apiKey'
      /** `x-nxopen-api-key` 헤더로 넥슨에 그대로 실린다. */
      value: string
    }
  | {
      kind: 'login'
      /**
       * 넥슨 액세스 토큰. `Authorization: Bearer` 로 **넥슨에 직접** 간다.
       *
       * 세션이 아니다. 세션은 새 토큰을 받을 때만 우리 서버로 가고, 넥슨에는 안 나간다.
       */
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
 * 앱이 도는 플랫폼. **넥슨 애플리케이션이 플랫폼마다 따로 등록된다.**
 *
 * `client_id` 와 secret 이 쌍으로 갈려서, 서버가 요청마다 어느 쌍을 쓸지 골라야 한다.
 */
export type Platform = 'ios' | 'android'

/**
 * 넥슨 로그인 하나. **액세스 토큰까지 앱이 든다.**
 *
 * 앱이 넥슨을 직접 부른다. 강화 내역 한 회차가 수백 건이라 우리 서버가 중계하면 사용자 한 명의
 * 조작이 서버에 수백 요청이 된다.
 *
 * **갱신 토큰은 여기 없다.** 갱신이 `client_secret` 을 요구해 서버만 할 수 있다.
 */
export interface NexonLoginMethod {
  kind: 'login'
  /** 서버가 발급한 세션 식별자. 새 액세스 토큰을 받을 때만 서버로 되돌아간다. */
  session: string
  /** 넥슨에 `Authorization: Bearer` 로 실린다. 수명 30분. */
  accessToken: string
  /** ISO 8601. 이보다 앞서면 서버에서 새로 받는다. */
  accessExpiresAt: string
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
