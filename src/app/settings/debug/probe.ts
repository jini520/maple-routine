/**
 * 서버 공지 조회를 **날것 그대로** 들여다보는 임시 도구. 화면과 함께 지운다.
 *
 * `server/notices.ts` 를 안 쓰는 이유가 하나다. 그쪽은 실패를 전부 빈 배열로 접는다 - 화면이
 * 네트워크를 안 보게 하려는 것이고 제품 화면에서는 그게 맞다. 그런데 여기서는 **0건과 조회
 * 실패를 갈라야** 한다. 둘 다 `아무것도 없음` 으로 보이면 서버에 그 분류가 아직 없는 것인지
 * 서버가 죽은 것인지 화면만 보고는 못 가린다.
 *
 * ⚠️ 이 파일은 임시다. `src/app/settings/debug/` 폴더째 지우는 것이 폐기 절차다.
 */
import type { Notice, NoticeKind } from '../../../types/notice'

/**
 * 서버가 준 것 **그대로**. 계약을 검사하지도 채우지도 않는다.
 *
 * `server/notices.ts` 는 `kind` 가 없으면 `app` 으로 채우고 모르는 블록을 버린다. 제품 화면이
 * 언제나 그릴 수 있게 하려는 것이고 거기서는 맞다. 그런데 이 도구가 답해야 하는 질문이
 * **`서버가 계약을 지키고 있나`** 라서, 채운 값을 보면 그 질문에 답할 수가 없다.
 */
export type RawNotice = Partial<Notice> & { id?: string }

/**
 * 썬데이 기록 한 줄. 서버가 주는 것 그대로다.
 *
 * `Notice` 와 달리 **기간을 든다.** 기록에서 가장 중요한 값이 `어느 일요일이었나` 인데
 * `publishedAt` 은 등록 시각이라 그것과 다를 수 있다.
 */
export interface RawSunday {
  id?: string
  title?: string
  publishedAt?: string
  startsAt?: string | null
  endsAt?: string | null
  link?: string
  blocks?: Notice['blocks']
}

const BASE_URL = 'https://mapleroutine.store/v1'
const TIMEOUT_MS = 10_000

export interface ProbeResult<T> {
  url: string
  /** HTTP 상태. `null` 이면 응답 자체를 못 받았다(네트워크·타임아웃). */
  status: number | null
  /** 실패 사유. 성공이면 `null`. */
  error: string | null
  /** 왕복에 걸린 밀리초. */
  ms: number
  data: T | null
}

async function getJson<T>(path: string): Promise<ProbeResult<T>> {
  const url = `${BASE_URL}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const response = await fetch(url, { signal: controller.signal })
    const ms = Date.now() - startedAt

    if (!response.ok) {
      return { url, status: response.status, error: `HTTP ${response.status}`, ms, data: null }
    }

    const body = (await response.json()) as T
    return { url, status: response.status, error: null, ms, data: body }
  } catch (error) {
    // 여기서는 사유를 가린다. 제품 화면과 달리 `무엇이 안 됐나` 가 이 도구의 산출물이다.
    return {
      url,
      status: null,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startedAt,
      data: null,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** 그 분류의 목록. 서버가 분류를 모르면 걸러지지 않은 것이 그대로 온다. */
export function probeList(
  kind: NoticeKind,
  limit = 50,
): Promise<ProbeResult<{ items: RawNotice[]; nextCursor: string | null }>> {
  return getJson(`/notices?limit=${limit}&kind=${kind}`)
}

/**
 * 썬데이 메이플 기록. **넥슨이 안 들고 있는 것을 우리 서버가 든다.**
 *
 * 썬데이는 일요일 하루만 넥슨 목록에 뜨고 지나면 상세도 400 이라, 폴러가 그날 잡아 둔 것이
 * 유일한 사본이다. 이 목록은 `blocks` 를 함께 싣는다(본문이 이미지 한두 장이라 가볍다).
 */
export function probeSunday(limit = 20): Promise<ProbeResult<{ items: RawSunday[] }>> {
  return getJson(`/sunday-maple?limit=${limit}`)
}

/** 한 건의 상세. 여기에만 `blocks` 가 실려 온다. */
export function probeDetail(id: string): Promise<ProbeResult<RawNotice>> {
  return getJson(`/notices/${encodeURIComponent(id)}`)
}
