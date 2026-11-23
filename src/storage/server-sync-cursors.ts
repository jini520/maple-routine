/**
 * 동기화의 받기가 주인마다 마지막으로 받은 변경 번호. Preferences 의 JSON 한 칸이다.
 *
 * 받은 줄을 다 넣은 뒤에 적는다. 넣기 전에 적으면 그 사이에 앱이 꺼질 때 그 줄을 영영 놓친다. 깨진 값은 빈 번호로 읽는다. 처음부터
 * 다시 받아도 같은 줄은 한 번 넣은 것과 같다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export interface ServerSyncCursors {
  /** 사람의 번호와 그 번호를 받은 서버의 넥슨 계정 줄 id. 받은 적이 없으면 `null` */
  nexonAccount: { id: string; changeSeq: number } | null
  /** 메이플 ID 해시마다의 번호 */
  mapleIds: Record<string, number>
}

const EMPTY: ServerSyncCursors = { nexonAccount: null, mapleIds: {} }

function isSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function getServerSyncCursors(): Promise<ServerSyncCursors> {
  const raw = await preferences.get(STORAGE_KEYS.serverSyncCursors)
  if (raw === null) return EMPTY
  try {
    const parsed = JSON.parse(raw) as { nexonAccount?: unknown; mapleIds?: unknown }
    const account = parsed.nexonAccount as { id?: unknown; changeSeq?: unknown } | null | undefined
    const mapleIds: Record<string, number> = {}
    if (typeof parsed.mapleIds === 'object' && parsed.mapleIds !== null) {
      for (const [hash, seq] of Object.entries(parsed.mapleIds)) if (isSeq(seq)) mapleIds[hash] = seq
    }
    return {
      nexonAccount: account != null && typeof account.id === 'string' && isSeq(account.changeSeq) ? { id: account.id, changeSeq: account.changeSeq } : null,
      mapleIds,
    }
  } catch {
    return EMPTY
  }
}

export async function setServerSyncCursors(cursors: ServerSyncCursors): Promise<void> {
  await preferences.set(STORAGE_KEYS.serverSyncCursors, JSON.stringify(cursors))
}

/** 로그인 뒤 첫 받기의 표시. 로그인 화면의 로그인과 메인 키 바꾸기가 저장한 뒤 적는다. */
export interface ServerSyncSignIn {
  /** 앞 계정의 메이플 ID 해시. 응답의 목록과 하나도 겹치지 않으면 다른 사람이다 */
  previousMapleIds: string[]
}

/** 로그인 뒤 첫 받기의 표시. 없거나 깨졌으면 `null` 이다. 깨진 표시로 비우면 같은 사람의 기록을 잃는다. */
export async function getServerSyncSignIn(): Promise<ServerSyncSignIn | null> {
  const raw = await preferences.get(STORAGE_KEYS.serverSyncSignIn)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as { previousMapleIds?: unknown }
    const ids = parsed.previousMapleIds
    return Array.isArray(ids) && ids.every((one) => typeof one === 'string') ? { previousMapleIds: ids } : null
  } catch {
    return null
  }
}

export async function setServerSyncSignIn(previousMapleIds: readonly string[]): Promise<void> {
  await preferences.set(STORAGE_KEYS.serverSyncSignIn, JSON.stringify({ previousMapleIds }))
}

export async function clearServerSyncSignIn(): Promise<void> {
  await preferences.remove(STORAGE_KEYS.serverSyncSignIn)
}
