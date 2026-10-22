import { create } from 'zustand'

import { TEXT_SIZE_SCALE } from '../../lib/text-size'
import { getTextSize, setTextSize } from '../../storage/text-size'
import { setTextScale } from '../../theme/text-scale'
import type { TextSize } from '../../types/text-size'

export interface TextSizeStore {
  size: TextSize
  restoreFromStorage(): Promise<void>
  selectSize(size: TextSize): Promise<void>
}

export const useTextSizeStore = create<TextSizeStore>()((set) => ({
  size: 'default',

  async restoreFromStorage() {
    const size = (await getTextSize()) ?? 'default'
    setTextScale(TEXT_SIZE_SCALE[size])
    set({ size })
  },

  /** 저장이 끝난 뒤에 배수를 바꾼다. 저장이 실패하면 다시 켰을 때 되돌아갈 크기를 보여 주지 않게. */
  async selectSize(size: TextSize) {
    await setTextSize(size)
    setTextScale(TEXT_SIZE_SCALE[size])
    set({ size })
  },
}))
