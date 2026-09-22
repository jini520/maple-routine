import { autoFeePercent } from '../../lib/mvp/fees'
import { loadFeeContext, type LoadedFeeContext } from './fee-context'

export type AutoFeePercentOf = (ocid: string, dateKey: string) => Promise<number>

/** 자동 수수료 요율을 찾는 함수. 처음 부를 때 등급 이력과 소속을 한 번만 읽는다. */
export function lazyAutoFeePercent(): AutoFeePercentOf {
  let context: Promise<LoadedFeeContext> | null = null
  return async (ocid, dateKey) => {
    context ??= loadFeeContext()
    return autoFeePercent(await context, ocid, dateKey)
  }
}

/** 파티 설정의 송금 수수료를 그 기록 날짜에 맞춰 푼 두 칸. 설정이 자동이면 그 날 등급 요율이고 기록도 자동이다. */
export async function settingSplitFee(
  setting: { splitFeePercent: number | null; splitFeeAuto?: boolean } | null,
  ocid: string,
  dateKey: string,
  autoFee: AutoFeePercentOf,
): Promise<{ splitFeePercent: number | null; splitFeeAuto: boolean }> {
  if (setting?.splitFeeAuto === true) return { splitFeePercent: await autoFee(ocid, dateKey), splitFeeAuto: true }
  return { splitFeePercent: setting?.splitFeePercent ?? null, splitFeeAuto: false }
}
