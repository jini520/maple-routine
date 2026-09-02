import { NexonAuthError, NexonBadRequestError, NexonNetworkError, NexonRateLimitError } from './errors'

interface NexonErrorBody {
  error?: { name?: string; message?: string }
}

/**
 * 비-2xx 응답 본문에서 넥슨 에러 코드(`error.name`)만 꺼낸다.
 * `message` 는 영문 원문이라 화면에 새면 안 되므로(error-resilience 원칙 4) 여기서 버린다.
 * 본문이 JSON이 아니거나 형태가 다르면 null — 호출 측이 "알 수 없는 실패"로 다룬다.
 */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as NexonErrorBody
    return body?.error?.name ?? null
  } catch {
    return null
  }
}

const API_BASE_URL = 'https://open.api.nexon.com'
const REQUEST_TIMEOUT_MS = 10_000

export async function requestJson<T>(path: string, apiKey: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'x-nxopen-api-key': apiKey },
      signal: controller.signal,
    })
  } catch (error) {
    throw new NexonNetworkError('Nexon API 요청에 실패했습니다', { cause: error })
  } finally {
    clearTimeout(timeoutId)
  }

  if (response.status === 401 || response.status === 403) {
    throw new NexonAuthError('Nexon API 키가 유효하지 않습니다')
  }
  if (response.status === 429) {
    throw new NexonRateLimitError('Nexon API 호출 한도를 초과했습니다 (OPENAPI00007)')
  }
  if (response.status === 400) {
    const code = await readErrorCode(response)
    throw new NexonBadRequestError(
      `Nexon API가 요청을 거부했습니다 (code: ${code ?? '알 수 없음'})`,
      code,
    )
  }
  if (!response.ok) {
    throw new NexonNetworkError(`Nexon API가 오류 응답을 반환했습니다 (status: ${response.status})`)
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new NexonNetworkError('Nexon API 응답을 JSON으로 파싱하지 못했습니다', { cause: error })
  }
}
