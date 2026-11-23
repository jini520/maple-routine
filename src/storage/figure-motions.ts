/**
 * 대표 캐릭터가 할 행동 · 표정(JSON 한 칸, ocid 마다 한 몫). 사용자가 고른 것이라 데이터 삭제가 지우지 않는다.
 *
 * 저장은 서버 칸과 같은 이름(`restsBetweenActions`)이고 화면은 `rest` 를 든다.
 */
import type { FigureMotion } from '../types/figure-motion'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import { enqueueChangedPreferenceRecords, preferenceRecordIdOf } from './server-sync-queue'

async function readObject(): Promise<Record<string, unknown> | null> {
  await whenRecordsReleased()
  const raw = await preferences.get(STORAGE_KEYS.figureMotions)
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** 저장된 값을 화면이 드는 칸 이름으로. 없거나 깨졌으면 `null`. 모양 검사는 스토어가 한다 */
export async function getFigureMotions(): Promise<unknown> {
  const stored = await readObject()
  if (stored === null) return null
  return Object.fromEntries(
    Object.entries(stored).map(([ocid, motion]) => {
      if (typeof motion !== 'object' || motion === null) return [ocid, motion]
      const { restsBetweenActions, ...rest } = motion as Record<string, unknown>
      return [ocid, { ...rest, rest: restsBetweenActions }]
    }),
  )
}

/** 캐릭터마다 대기 줄 하나. */
function recordsOf(stored: Readonly<Record<string, unknown>> | null): Map<string, unknown> {
  return new Map(
    Object.entries(stored ?? {}).map(([ocid, motion]) => [preferenceRecordIdOf('representativeCharacterMotions', [ocid]), motion]),
  )
}

/** 바꾸거나 지운 캐릭터의 동작을 대기 표에 넣는다. */
export async function setFigureMotions(motions: Readonly<Record<string, FigureMotion>>): Promise<void> {
  await whenRecordsReleased()
  const before = await readObject()
  const stored = Object.fromEntries(
    Object.entries(motions).map(([ocid, { rest, ...motion }]) => [ocid, { ...motion, restsBetweenActions: rest }]),
  )
  await preferences.set(STORAGE_KEYS.figureMotions, JSON.stringify(stored))
  await enqueueChangedPreferenceRecords('representativeCharacterMotions', recordsOf(before), recordsOf(stored))
}

/** 월드 리프한 캐릭터의 값을 새 ocid 로 옮기는 함수. 새 ocid 몫이 있으면 리프 뒤에 고른 그 값을 둔다. */
export async function moveFigureMotionToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const current = await readObject()
  if (current === null || !(fromOcid in current)) return
  const { [fromOcid]: moved, ...rest } = current
  const next = { [toOcid]: moved, ...rest }
  await preferences.set(STORAGE_KEYS.figureMotions, JSON.stringify(next))
  await enqueueChangedPreferenceRecords('representativeCharacterMotions', recordsOf(current), recordsOf(next))
}
