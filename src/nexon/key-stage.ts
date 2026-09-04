/**
 * API 키가 개발 단계인지 재는 프로브.
 *
 * 넥슨은 키의 단계를 안 알려준다. 대신 호출 제한이 갈리므로(개발 초당 5건 · 서비스 초당 500건)
 * **한 번에 여러 건을 쏴서 429 가 오는지**로 잰다.
 *
 * `character/list` 인 것은 선택이 아니다. ocid 없이 API 키만으로 부를 수 있는 엔드포인트가 그것
 * 하나이고, 이 프로브가 도는 시점에는 아직 ocid 가 없다.
 *
 * @see docs/features/auth.md 이 판정으로 무엇을 막는지
 */
import { CHARACTER_LIST_PATH } from './character/client'
import { NexonRateLimitError } from './errors'
import { requestJson } from './http'

/**
 * 프로브의 판정.
 *
 * **`service` 가 없는 것이 의도다.** 429 를 봤다는 것은 개발 단계라는 뜻이지만, 못 봤다는 것은
 * 못 봤다는 뜻뿐이다. 그 값에 서비스라는 이름을 붙이면 다음 세션이 **여기까지 왔으면 초당 500건이
 * 보장된다**를 그 위에 쌓는다.
 */
export type ApiKeyStageVerdict = 'developmentStage' | 'undetermined'

/** 한 번에 쏘는 건수. 개발 단계 한도가 초당 5건이라 그보다 커야 판정이 선다. */
export const PROBE_CALL_COUNT = 10

/**
 * 키의 단계를 잰다. 어떤 실패에도 던지지 않고 판정만 낸다.
 *
 * **동시에 나가야 한다.** 순차로 부르면 앞이 끝나야 다음이 나가 초당 한도에 닿지 않고, 호출 수와
 * 반환 타입은 그대로인 채 판정만 죽는다.
 *
 * 429 가 아닌 실패는 전부 `undetermined` 다. 차단하는 쪽이 양성 증거를 요구해야, 네트워크가 끊긴
 * 자리에서 멀쩡한 키가 거부되지 않는다.
 */
export async function probeApiKeyStage(apiKey: string): Promise<ApiKeyStageVerdict> {
  const results = await Promise.allSettled(
    Array.from({ length: PROBE_CALL_COUNT }, () =>
      requestJson<unknown>(CHARACTER_LIST_PATH, apiKey),
    ),
  )

  const sawRateLimit = results.some(
    (result) => result.status === 'rejected' && result.reason instanceof NexonRateLimitError,
  )

  return sawRateLimit ? 'developmentStage' : 'undetermined'
}
