/**
 * 서버로 못 보낸 것을 다시 보내는 고리. 앱을 켤 때 배경으로 한 번 돈다.
 *
 * **고리는 종류를 모른다.** 종류마다 다른 것은 함수 둘(읽기 · 보내기)이고 그 둘은
 * `registry.ts` 가 든다. 여기 있는 것은 그 둘을 부르는 순서와 횟수 세는 규칙뿐이다.
 *
 * ```
 * 표의 줄마다
 *   그 kind 의 읽기 함수를 부른다
 *     값이 오면  → 보내기
 *     null 이면  → 삭제 요청  (원본이 없으면 지우기다. 작업 종류를 칸으로 안 적는다)
 *   보냈다            → 줄을 지운다
 *   응답이 왔고 거절  → attempts += 1, 5 가 되면 줄을 지운다
 *   응답이 안 왔다    → 아무것도 안 한다. 다음 회차에 그대로 다시
 * ```
 *
 * **`attempts` 를 응답을 받은 뒤에 적는다.** 미리 적어 두고 성공하면 되돌리는 모양으로 짜면,
 * 훑는 중에 앱이 꺼졌을 때 그 되돌리기가 못 돌아 한 번 켰다 끈 것이 시도로 남는다.
 */
import type { SendResult } from '../../server/drop-price'
import { MAX_SYNC_ATTEMPTS, type SyncQueueEntry } from '../../storage/server-sync-queue'

/**
 * 종류 하나가 서버와 주고받는 법.
 *
 * `read` 가 `null` 을 주면 그 기록은 서버에서 지운다. **삭제 판정이 종류 안에 있다** - 드롭
 * 가격은 **원본이 없거나 `price_state` 가 `'entered'` 가 아니다** 를 `null` 로 답한다.
 */
export interface SyncHandler<Value> {
  read: (recordId: string) => Promise<Value | null>
  send: (
    headers: Record<string, string>,
    recordId: string,
    value: Value | null,
  ) => Promise<SendResult>
}

/** 이 고리가 밖에 맡기는 일 전부. 저장소와 신원은 어댑터를 거친다. */
export interface SweepDeps {
  /** 서버에 자기를 밝히는 헤더. 밝힐 수단이 없으면 `null` 이고 그 회차는 통째로 건너뛴다. */
  identity: () => Promise<Record<string, string> | null>
  list: () => Promise<SyncQueueEntry[]>
  countAttempt: (recordId: string, lastError: string) => Promise<void>
  remove: (recordId: string) => Promise<void>
  /** 종류마다의 함수 둘. 값의 모양은 종류가 알고 이 고리는 그대로 넘긴다. */
  handlers: Readonly<Record<string, SyncHandler<unknown>>>
}

/** 한 회차가 한 일. 화면에 안 쓰고 로그와 테스트가 본다. */
export interface SweepResult {
  sent: number
  /** 응답이 왔고 거절이었다. */
  rejected: number
  /** 응답이 안 왔다. 시도로 안 센다. */
  offline: number
  /** 5회를 다 쓰거나 레지스트리에 없는 종류라 버렸다. */
  dropped: number
}

const EMPTY: SweepResult = { sent: 0, rejected: 0, offline: 0, dropped: 0 }

/**
 * 한 회차.
 *
 * **밝힐 수단이 없으면 아무것도 안 한다.** 횟수도 안 올린다 - 키를 지웠거나 로그인 전인 상태이고,
 * 그것은 요청의 잘못이 아니다.
 */
export async function sweepServerSync(deps: SweepDeps): Promise<SweepResult> {
  const entries = await deps.list()
  if (entries.length === 0) return { ...EMPTY }

  const headers = await deps.identity()
  if (headers === null) return { ...EMPTY }

  const result: SweepResult = { ...EMPTY }

  for (const entry of entries) {
    const handler = deps.handlers[entry.kind]

    // 레지스트리에 없는 종류다. 두면 줄이 영원히 쌓이고 조용히 안 나간다.
    if (handler === undefined) {
      await deps.remove(entry.recordId)
      result.dropped += 1
      continue
    }

    const value = await handler.read(entry.recordId)
    const outcome = await handler.send(headers, entry.recordId, value)

    if (outcome.outcome === 'sent') {
      await deps.remove(entry.recordId)
      result.sent += 1
      continue
    }

    // 응답이 안 왔다. 서버가 답한 적이 없으므로 요청을 탓할 근거가 없다.
    if (outcome.outcome === 'no-response') {
      result.offline += 1
      continue
    }

    // 마지막 기회를 썼다. 안 버리면 못 보내는 건이 영원히 재시도된다. 기기의 기록은 그대로 남는다.
    if (entry.attempts + 1 >= MAX_SYNC_ATTEMPTS) {
      await deps.remove(entry.recordId)
      result.dropped += 1
      continue
    }

    await deps.countAttempt(entry.recordId, `HTTP ${outcome.status}`)
    result.rejected += 1
  }

  return result
}
