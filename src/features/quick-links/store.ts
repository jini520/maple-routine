import { create } from 'zustand'

import { getQuickLinks, setQuickLinks } from '../../storage/quick-links'
import type { QuickLinksConfig } from '../../types/quick-links'
import { DEFAULT_QUICK_LINKS, parseQuickLinks } from './config'

export interface QuickLinksStore {
  config: QuickLinksConfig
  restoreFromStorage(): Promise<void>
  /** 편집 시트의 `적용` */
  save(config: QuickLinksConfig): Promise<void>
}

export const useQuickLinksStore = create<QuickLinksStore>()((set) => ({
  config: DEFAULT_QUICK_LINKS,

  async restoreFromStorage() {
    set({ config: parseQuickLinks(await getQuickLinks()) ?? DEFAULT_QUICK_LINKS })
  },

  /** 저장이 끝난 뒤에 바꾼다. 저장이 실패하면 다시 켰을 때 되돌아갈 구성을 보여 주지 않게 */
  async save(config: QuickLinksConfig) {
    await setQuickLinks(config)
    set({ config })
  },
}))
