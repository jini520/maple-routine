/**
 * 대표 캐릭터가 할 행동 · 표정(JSON 한 칸, ocid 마다 한 몫). 사용자가 고른 것이라 데이터 삭제가 지우지 않는다.
 */
import type { FigureMotion } from '../types/figure-motion'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

async function readObject(): Promise<Record<string, unknown> | null> {
  const raw = await preferences.get(STORAGE_KEYS.figureMotions)
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** 저장된 값을 JSON 으로 읽은 그대로. 없거나 깨졌으면 `null`. 모양 검사는 스토어가 한다 */
export async function getFigureMotions(): Promise<unknown> {
  return readObject()
}

export async function setFigureMotions(motions: Readonly<Record<string, FigureMotion>>): Promise<void> {
  await preferences.set(STORAGE_KEYS.figureMotions, JSON.stringify(motions))
}

/** 월드 리프한 캐릭터의 값을 새 ocid 로 옮기는 함수. 새 ocid 몫이 있으면 리프 뒤에 고른 그 값을 둔다. */
export async function moveFigureMotionToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const current = await readObject()
  if (current === null || !(fromOcid in current)) return
  const { [fromOcid]: moved, ...rest } = current
  await preferences.set(STORAGE_KEYS.figureMotions, JSON.stringify({ [toOcid]: moved, ...rest }))
}
