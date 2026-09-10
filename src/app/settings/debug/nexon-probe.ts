/**
 * 넥슨 Open API 의 공지 목록을 **기기에서 바로** 부른다. 임시 점검용이다.
 *
 * 제품에서는 이 호출을 서버가 자기 키로 한다. 모두에게 똑같은 공개 정보를 사용자마다 각자
 * 캐게 하지 않으려는 것이고, 그 결정은 그대로다. 여기서 기기가 직접 부르는 이유는 하나뿐이다 -
 * **서버에 아직 안 찬 것을 지금 눈으로 보려고.** 그래서 이 파일은 화면과 함께 지운다.
 *
 * 호출은 저장된 **개인 키**로 나간다. 한 번 여는 데 목록 1건 + 펼친 것마다 1건이라 서비스
 * 단계 키(초당 500건 · 일 2,000만건)에서는 없는 것과 같다.
 *
 * ⚠️ 이 파일은 임시다. `src/app/settings/debug/` 폴더째 지우는 것이 폐기 절차다.
 */
import { requestJson } from '../../../nexon/http'
import { getAuthConfig } from '../../../storage/api-key'
import type { NoticeKind } from '../../../types/notice'

/** 넥슨에서 오는 넷. `app`(운영자 공지)은 넥슨에 없다. */
export type NexonNoticeKind = Exclude<NoticeKind, 'app'>

/**
 * 분류마다 경로도 다르고 **응답 배열의 키도 다르다.**
 *
 * 서버 저장소의 `src/nexon.ts` 와 같은 표다. 임시 도구라 공유하지 않고 베껴 둔다 - 지울 때
 * 딸려 갈 것이 없는 편이 낫다.
 */
const ENDPOINTS: Record<NexonNoticeKind, { list: string; detail: string; key: string }> = {
  game: { list: '/maplestory/v1/notice', detail: '/maplestory/v1/notice/detail', key: 'notice' },
  update: {
    list: '/maplestory/v1/notice-update',
    detail: '/maplestory/v1/notice-update/detail',
    key: 'update_notice',
  },
  event: {
    list: '/maplestory/v1/notice-event',
    detail: '/maplestory/v1/notice-event/detail',
    key: 'event_notice',
  },
  cashshop: {
    list: '/maplestory/v1/notice-cashshop',
    detail: '/maplestory/v1/notice-cashshop/detail',
    key: 'cashshop_notice',
  },
}

/** 넥슨이 준 것 그대로. 우리 모양으로 안 접는다. */
export interface NexonRow {
  notice_id?: number
  title?: string
  url?: string
  date?: string
  date_event_start?: string
  date_event_end?: string
  date_sale_start?: string | null
  date_sale_end?: string | null
  ongoing_flag?: string
}

export interface NexonProbe<T> {
  path: string
  error: string | null
  ms: number
  data: T | null
}

async function call<T>(path: string): Promise<NexonProbe<T>> {
  const startedAt = Date.now()

  const auth = await getAuthConfig()
  if (auth === null) {
    return { path, error: '저장된 API 키가 없다. 로그인부터 해야 한다', ms: 0, data: null }
  }

  try {
    return { path, error: null, ms: Date.now() - startedAt, data: await requestJson<T>(path, auth.apiKey) }
  } catch (error) {
    // 사유를 그대로 올린다. `nexon/http` 가 이미 한글 문장으로 만들어 던진다.
    return {
      path,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startedAt,
      data: null,
    }
  }
}

/** 그 분류의 목록. 넥슨은 최근 20건까지 주고 이벤트만 «진행 중인 것» 이라 수가 들쭉날쭉하다. */
export async function probeNexonList(kind: NexonNoticeKind): Promise<NexonProbe<NexonRow[]>> {
  const endpoint = ENDPOINTS[kind]
  const result = await call<Record<string, unknown>>(endpoint.list)

  if (result.data === null) return { ...result, data: null }

  const rows = result.data[endpoint.key]
  return { ...result, data: Array.isArray(rows) ? (rows as NexonRow[]) : [] }
}

/**
 * 한 건의 상세. **목록에 지금 떠 있는 것만 답한다** - 목록 밖 id 는 400 이다.
 *
 * 넥슨은 `contents` 를 HTML 로 준다. 앱은 그것을 해석하지 않는다(서버가 블록으로 바꾼다).
 * 여기서는 그 원문이 어떻게 생겼는지만 보여 준다.
 */
export function probeNexonDetail(
  kind: NexonNoticeKind,
  noticeId: number,
): Promise<NexonProbe<{ title?: string; contents?: string }>> {
  return call(`${ENDPOINTS[kind].detail}?notice_id=${noticeId}`)
}

/** 원문 HTML 이 무엇으로 이루어져 있는지. 파서가 씹을 것을 미리 보는 값이다. */
export function describeContents(contents: string): string {
  const text = contents.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  const images = contents.match(/<img\b/gi)?.length ?? 0
  const tables = contents.match(/<table\b/gi)?.length ?? 0

  return `HTML ${contents.length.toLocaleString()}자 · 텍스트 ${text.length.toLocaleString()}자 · 이미지 ${images} · 표 ${tables}`
}
