/**
 * 직접 완료를 열어 둔 보스 조회. `settlement.ts` 와 같은 자리, 같은 규칙이다.
 *
 * **못 받았으면 열지 않는다.** 실패가 어떤 모양이든 밖으로는 `null` 하나만 나가고, 그 값을 받은 쪽은
 * 단추도 배너도 안 세운다. 기기에 사본을 두지 않는 것이 공지와 다른 점이다 - 공지는 읽는 것이고
 * 이쪽은 **쓰는 문**이라, 서버가 끈 뒤에도 열려 있으면 안 된다.
 *
 * 계약은 서버 저장소와 나눠 갖는다. 필드를 더할 때 양쪽을 함께 본다.
 */
import type { ManualCompletionPeriod } from '../types/manual-completion'
import { API_BASE_URL } from './base-url'

/**
 * 얼마나 기다리나. 결산 조회와 같은 값이다.
 *
 * 이 값이 늦게 오면 배너가 늦게 서고 단추가 늦게 나타난다. 화면에서 기다리는 자리가 없다.
 */
const TIMEOUT_MS = 4_000

/** 계약을 지킨 줄만 통과시킨다. 깨진 줄은 그 줄만 버린다. */
function toPeriod(value: unknown): ManualCompletionPeriod | null {
  if (typeof value !== 'object' || value === null) return null
  const one = value as Record<string, unknown>

  if (typeof one.bossId !== 'string' || one.bossId === '') return null
  if (typeof one.fromDate !== 'string' || one.fromDate === '') return null
  return { bossId: one.bossId, fromDate: one.fromDate }
}

/** 못 받았거나 계약을 어겼으면 `null`. 빈 배열은 **아무것도 안 열렸다**는 사실이다. */
export async function fetchManualCompletionBosses(): Promise<ManualCompletionPeriod[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE_URL}/manual-completion`, { signal: controller.signal })
    if (response.status !== 200) return null

    const body = (await response.json()) as unknown
    if (typeof body !== 'object' || body === null) return null
    const periods = (body as Record<string, unknown>).bossManualCompletionPeriods
    if (!Array.isArray(periods)) return null

    return periods.map(toPeriod).filter((period): period is ManualCompletionPeriod => period !== null)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
