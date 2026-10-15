/**
 * 로그인 사용자의 프렌즈 조회. **서버가 넥슨을 대신 부르고 줄로 흘린다.**
 *
 * 앱은 토큰을 안 든다. 넥슨 보안 가이드라인이 액세스 토큰을 서버에서만 관리하라고 적어서다.
 * 작업 목록 하나를 보내면 서버가 쪽마다 줄 하나를 흘리고(`page`), 작업이 끝나면 `done`, 못 받으면
 * `fail`, 회차가 끝나면 `end` 를 보낸다. 빈 줄은 하트비트라 버린다.
 *
 * `expo/fetch` 인 것은 RN 의 `fetch` 가 응답 몸체를 스트림으로 안 주기 때문이다. gzip 은 네이티브가
 * 풀어 주고 줄 단위로 증분 전달된다(두 플랫폼 실측 2026-10-14).
 */
import { fetch as expoFetch } from 'expo/fetch'

const BASE_URL = 'https://mapleroutine.store/v1'

/** 회차 전체의 상한. 서버가 120초에서 끊으므로 그보다 조금 길다. */
const TIMEOUT_MS = 130_000

/** 서버 작업 하나. `kind` 는 넥슨 경로의 마지막 마디다. `character-state` 의 `date` 가 없으면 오늘이다. */
export type StreamTask =
  | { kind: 'cube' | 'starforce' | 'potential' | 'soul-potential'; date: string }
  | { kind: 'character-state'; ocid: string; date?: string }
  | { kind: 'character-list' }

interface TaskFields {
  kind: StreamTask['kind']
  date?: string
  ocid?: string
}

/** 서버가 흘리는 줄 넷. `code` 는 넥슨 본문의 `error.name` 이고 400 을 가르는 데 쓴다. */
export type StreamLine =
  | ({ t: 'page'; n: number; body: unknown } & TaskFields)
  | ({ t: 'done'; pages: number } & TaskFields)
  | ({ t: 'fail'; status: number; code?: string } & TaskFields)
  | { t: 'end'; reason: 'done' | 'deadline' | 'budget' | 'relogin' }

/** 서버가 회차를 거절했다. 401 은 세션이 죽은 것이고 503 은 상한이라 잠시 뒤 다시 온다. */
export class FriendsStreamRejected extends Error {
  constructor(readonly status: number) {
    super(`프렌즈 스트림이 거절됐습니다 (status: ${status})`)
  }
}

function parseLine(text: string): StreamLine | null {
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null) return null
    return typeof (value as { t?: unknown }).t === 'string' ? (value as StreamLine) : null
  } catch {
    return null
  }
}

/**
 * 작업 목록 하나를 보내고 줄을 전부 모아 돌려준다.
 *
 * 던지는 것은 둘이다. 서버가 거절하면 `FriendsStreamRejected`, 닿지 못하거나 끊기면 `fetch` 의 실패
 * 그대로다. 부르는 쪽(`nexon/http.ts`)이 넥슨 에러 어휘로 바꾼다.
 */
export async function streamFriends(session: string, tasks: readonly StreamTask[]): Promise<StreamLine[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await expoFetch(`${BASE_URL}/friends/stream`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}`, 'content-type': 'application/json' },
      body: JSON.stringify({ tasks }),
      signal: controller.signal,
    })
    if (!res.ok) throw new FriendsStreamRejected(res.status)
    if (res.body === null) return []

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const lines: StreamLine[] = []
    let carry = ''
    const take = (text: string): void => {
      const parts = text.split('\n')
      carry = parts.pop() ?? ''
      for (const part of parts) {
        if (part.length === 0) continue
        const line = parseLine(part)
        if (line !== null) lines.push(line)
      }
    }
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      take(carry + decoder.decode(value, { stream: true }))
    }
    take(`${carry}${decoder.decode()}\n`)
    return lines
  } finally {
    clearTimeout(timer)
  }
}
