/**
 * 넥슨을 부를 때 넘기는 자격 하나.
 *
 * **문자열이 아니라 객체인 것이 요점이다.** 경로마다 실을 것이 달라서(프렌즈는 액세스 토큰,
 * 나머지는 API 키) 부르는 쪽이 **어떤 자격인지** 를 함께 넘겨야 한다. 그 갈림은
 * `nexon/http.ts` 의 `routeOf` 한 자리에 모인다.
 */
export type NexonCredential =
  | {
      type: 'key'
      /** `x-nxopen-api-key` 헤더로 넥슨에 그대로 실린다. */
      value: string
      /** 이 자격의 넥슨 계정 id. 저장 전에 검증하는 키는 아직 계정이 없어 `null` 이다. */
      accountId: string | null
    }
  | {
      type: 'login'
      /**
       * 우리 서버가 발급한 세션. `Authorization: Bearer` 로 **우리 서버**에 간다.
       *
       * 넥슨 액세스 토큰이 아니다. 토큰은 서버만 들고(넥슨 보안 가이드라인), 프렌즈 경로는 서버가
       * 이 세션으로 사람을 가려 대신 부른다.
       */
      value: string
      accountId: string | null
    }

/**
 * 저장된 API 키 하나.
 *
 * **이름이 붙는다.** 값이 비슷하게 생겨서 이름 없이는 목록에서 구분이 안 된다. 우리가 지어내지
 * 않으므로 사용자가 안 붙였으면 빈 문자열이다.
 */
export interface NexonApiKeyMethod {
  type: 'key'
  /** 넥슨 계정 id(uuid). 키 값이 아니라 이 값이 계정을 가리킨다. 키를 다시 받아도 같은 계정이면 그대로다 */
  id: string
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
 * 넥슨 로그인 하나. **앱이 드는 것은 서버 세션뿐이다.**
 *
 * 액세스 토큰과 갱신 토큰은 서버가 든다. 넥슨 보안 가이드라인이 액세스 토큰을 서버에서만 관리하라고
 * 적어서다. 프렌즈 경로는 서버가 이 세션으로 사람을 가려 대신 부르고, 나머지는 번들 개발자 키로
 * 앱이 직접 부른다.
 */
export interface NexonLoginMethod {
  type: 'login'
  /** 넥슨 계정 id(uuid). 다시 로그인해도 그대로다 */
  id: string
  /** 서버가 발급한 세션. 갱신 토큰 14일이 지나면 서버가 지우고 앱은 401 을 받는다. */
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
