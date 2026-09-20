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
 * 이 스토어가 드는 것은 **지금 열린 부탁 하나**다. 차례를 안 든다. 드롭 판매가처럼 잇따라 받는
 * 흐름은 확인 안에서 다음 부탁을 다시 열고, 남은 것이 무엇인지는 부르는 쪽이 안다.
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
  /**
   * 확인을 누른 값. 카드는 이 **앞에** 닫힌다. 정리(앞자리 0 걷기 등)는 받는 쪽이 한다.
   *
   * 먼저 닫는 것은 여기서 **다음 카드를 열 수 있게** 하기 위해서다. 드롭 판매가가 그렇게 잇는다.
   *
   * 둘째 인자는 스테퍼를 넘긴 부탁에만 온다.
   */
  onConfirm: (next: string, stepper?: number) => void
}

interface InputCardStore {
  request: InputCardRequest | null
  /**
   * 연 횟수. 카드를 **다시 심는 열쇠**다.
   *
   * 카드는 친 값과 스테퍼 수를 자기가 든다. 부탁만 갈아 끼우면 그 둘이 앞 부탁의 것으로 남아,
   * 다음 아이템에 안 친 값이 저장된다. 이 수가 바뀌면 카드가 새로 서서 씨앗을 다시 심는다.
   */
  seq: number
  open: (request: InputCardRequest) => void
  close: () => void
}

export const useInputCardStore = create<InputCardStore>()((set) => ({
  request: null,
  seq: 0,
  open: (request) => set((state) => ({ request, seq: state.seq + 1 })),
  close: () => set({ request: null }),
}))

/** 칸을 누른 자리에서 부른다. 시트는 이 함수 하나만 알면 된다. */
export function openInputCard(request: InputCardRequest): void {
  useInputCardStore.getState().open(request)
}

/**
 * 밖에서 카드를 닫는다. **잇따라 받는 흐름이 끝날 때** 쓴다.
 *
 * 확인은 카드가 스스로 닫으므로 이것을 안 부른다. 곁들이 버튼(기록 안함 · 다음)은 카드를 안
 * 닫으므로, 남은 것이 없으면 부르는 쪽이 닫아야 한다.
 */
export function closeInputCard(): void {
  useInputCardStore.getState().close()
}
