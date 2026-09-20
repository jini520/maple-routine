/**
 * 지금 입력 카드가 받고 있는 칸.
 *
 * **카드를 시트가 직접 그리지 않는다.** 시트는 `BottomSheetModalProvider` 가 자기 자식들 뒤에
 * 그리므로, 시트 안에서 그린 것은 무엇으로 감싸도 시트 위로 못 올라간다. RN 의 `Modal` 로 띄워
 * 봤지만 트리 안에 인라인으로 서서 **카드 안의 누르개가 터치를 하나도 못 받았다**(실기 확인).
 *
 * 그래서 카드는 앱 셸이 `BottomSheetModalProvider` **뒤에** 한 번만 세우고, 시트는 이 스토어로
 * 연다. 그러면 카드가 평범한 터치 트리 안에 있으면서 시트 위에 그려진다.
 *
 * 카드는 칸 하나를 받고 닫히므로 이 스토어가 드는 것도 하나다. 차례를 안 든다.
 */
import { create } from 'zustand'

import type { InputCardProps } from '../../components/organisms/InputCard/InputCard'

/**
 * 칸 하나를 받아 달라는 부탁.
 *
 * 취소는 안 받는다. **확인을 안 누르고 닫으면 버리는 것**이 카드의 규칙이라 부르는 쪽이 따로
 * 할 일이 없다. 자리(`panelStyle`)는 카드를 세우는 껍데기가 준다.
 */
export type InputCardRequest = Omit<InputCardProps, 'panelStyle' | 'onConfirm' | 'onCancel'> & {
  /** 확인을 누른 값. 카드는 이 뒤에 스스로 닫힌다. 정리(앞자리 0 걷기 등)는 받는 쪽이 한다. */
  onConfirm: (next: string) => void
}

interface InputCardStore {
  request: InputCardRequest | null
  open: (request: InputCardRequest) => void
  close: () => void
}

export const useInputCardStore = create<InputCardStore>()((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}))

/** 칸을 누른 자리에서 부른다. 시트는 이 함수 하나만 알면 된다. */
export function openInputCard(request: InputCardRequest): void {
  useInputCardStore.getState().open(request)
}
