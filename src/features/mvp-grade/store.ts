import { useEffect } from 'react'
import { create } from 'zustand'

import type { FeePercent } from '../../lib/cashbook/item-split'
import { auctionFeePercentOf, type MvpGradeKey } from '../../lib/mvp/grades'
import { recordGradeAt } from '../../lib/mvp/fees'
import { loadFeeContext, type LoadedFeeContext } from './fee-context'

interface MvpGradeState {
  /** 등급 이력 · 소속 · 대표 캐릭터. 읽기 전이면 `null` */
  context: LoadedFeeContext | null
  loading: boolean
  /** 아직 안 읽었으면 읽는다. */
  load: () => Promise<void>
  /** 등급 기록을 바꾼 뒤 다시 읽는다. */
  reload: () => Promise<void>
}

export const useMvpGradeStore = create<MvpGradeState>()((set, get) => ({
  context: null,
  loading: false,
  async load() {
    if (get().context !== null || get().loading) return
    await get().reload()
  },
  async reload() {
    set({ loading: true })
    try {
      set({ context: await loadFeeContext(), loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))

/** 수수료 줄의 `자동` 이 보이는 것. 명패는 등급이 없으면 일반이다. */
export interface AutoFee {
  grade: MvpGradeKey
  percent: FeePercent
}

/**
 * 그 캐릭터 · 날짜의 자동 수수료. 등급 기록을 아직 안 읽었거나 캐릭터를 고르기 전이면 `null`.
 *
 * @example const autoFee = useAutoFee(ocid, props.dateKey)
 */
export function useAutoFee(ocid: string | null, dateKey: string): AutoFee | null {
  const context = useMvpGradeStore((state) => state.context)
  const load = useMvpGradeStore((state) => state.load)
  useEffect(() => {
    void load()
  }, [load])
  if (context === null || ocid === null) return null
  const grade = recordGradeAt(context, ocid, dateKey)
  return { grade: grade ?? 'normal', percent: auctionFeePercentOf(grade) as FeePercent }
}
