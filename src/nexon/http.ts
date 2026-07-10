import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from './errors'

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
  if (!response.ok) {
    throw new NexonNetworkError(`Nexon API가 오류 응답을 반환했습니다 (status: ${response.status})`)
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new NexonNetworkError('Nexon API 응답을 JSON으로 파싱하지 못했습니다', { cause: error })
  }
}
