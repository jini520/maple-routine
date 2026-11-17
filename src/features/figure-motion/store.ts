import { create } from 'zustand'

import { getFigureMotions, setFigureMotions } from '../../storage/figure-motions'
import type { FigureMotion } from '../../types/figure-motion'
import { parseFigureMotions } from './config'

export interface FigureMotionStore {
  /** 캐릭터마다 고른 값. 고르지 않은 캐릭터는 없다 */
  motions: Readonly<Record<string, FigureMotion>>
  restoreFromStorage(): Promise<void>
  /** 시트의 `적용` */
  save(ocid: string, motion: FigureMotion): Promise<void>
}

export const useFigureMotionStore = create<FigureMotionStore>()((set, get) => ({
  motions: {},

  async restoreFromStorage() {
    set({ motions: parseFigureMotions(await getFigureMotions()) })
  },

  /** 저장이 끝난 뒤에 바꾼다. 저장이 실패하면 다시 켰을 때 되돌아갈 값을 보여 주지 않게 */
  async save(ocid: string, motion: FigureMotion) {
    const motions = { ...get().motions, [ocid]: motion }
    await setFigureMotions(motions)
    set({ motions })
  },
}))
