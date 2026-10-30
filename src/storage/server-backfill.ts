/**
 * 과거 기록을 서버로 어디까지 올렸나. Preferences 의 JSON 한 칸이다.
 *
 * 깨진 값은 빈 진행으로 읽는다. 처음부터 다시 올려도 서버가 기록 id 로 덮어 줄이 늘지 않는다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import type { BackfillKind } from './server-sync-sources'

/** 한 종류의 진행. `after` 는 마지막으로 보낸 기록 id 이고 처음이면 빈 글자다. */
export interface BackfillProgress {
  after: string
  done: boolean
}

export type BackfillState = Partial<Record<BackfillKind, BackfillProgress>>

function isProgress(value: unknown): value is BackfillProgress {
  if (typeof value !== 'object' || value === null) return false
  const one = value as Record<string, unknown>
  return typeof one.after === 'string' && typeof one.done === 'boolean'
}

export async function getBackfillState(): Promise<BackfillState> {
  const raw = await preferences.get(STORAGE_KEYS.serverBackfill)
  if (raw === null) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const state: BackfillState = {}
    // 옛 앱이 적은 다른 종류의 진행은 읽지 않는다. 다음에 적을 때 빠진다.
    for (const kind of ['dropPrice'] as const) {
      if (isProgress(parsed[kind])) state[kind] = parsed[kind]
    }
    return state
  } catch {
    return {}
  }
}

export async function setBackfillState(state: BackfillState): Promise<void> {
  await preferences.set(STORAGE_KEYS.serverBackfill, JSON.stringify(state))
}
