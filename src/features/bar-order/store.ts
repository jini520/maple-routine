import { create } from 'zustand'

import { DEFAULT_BAR_ORDER, type BarOrder } from '../../navigation/bar-groups'
import { getBarOrder, setBarOrder } from '../../storage/bar-order'
import { parseBarOrder } from './config'

export interface BarOrderStore {
  order: BarOrder
  restoreFromStorage(): Promise<void>
  /** 편집 페이지의 `적용` */
  save(order: BarOrder): Promise<void>
}

export const useBarOrderStore = create<BarOrderStore>()((set) => ({
  order: DEFAULT_BAR_ORDER,

  async restoreFromStorage() {
    set({ order: parseBarOrder(await getBarOrder()) })
  },

  /** 저장이 끝난 뒤에 바꾼다. 저장이 실패하면 다시 켰을 때 되돌아갈 순서를 보여 주지 않게 */
  async save(order: BarOrder) {
    await setBarOrder(order)
    set({ order })
  },
}))
