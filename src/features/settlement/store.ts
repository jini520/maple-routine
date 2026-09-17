/**
 * 넥슨이 결산 중인가. today 의 안내 줄이 이것을 구독한다.
 *
 * **스토어가 하나라 갱신 자리가 여럿이어도 화면은 하나를 본다.** 스케줄러 데이터를 갱신하는 자리
 * 넷이 각자 `refresh()` 를 부르고, 값이 바뀌면 today 에 바로 선다.
 *
 * **겹쳐 불러도 서버는 한 번만 부른다.** 그 넷이 한 회차에 함께 돌아서, 단일 비행이 없으면 같은
 * 값을 네 번 묻는다.
 */
import { create } from 'zustand'

import { fetchSettlement } from '../../server/settlement'
import { dismissSettlement, getDismissedSettlementAt } from '../../storage/settlement-banner'

interface SettlementState {
  /** 서버가 말하는 지금. 못 받았으면 거짓이다. */
  settling: boolean
  /** 이번 결산의 시작 시각. 닫은 것을 알아보는 열쇠다. */
  startedAt: string | null
  /** 닫을 때 기억한 시작 시각. 기기에 남는다. */
  dismissedAt: string | null
  /** 지금 줄을 세우나. 결산 중이고 이번 결산을 안 닫았을 때만 참이다. */
  visible: boolean
  refresh: () => Promise<void>
  /** 이번 결산 동안 줄을 닫는다. 다음 밤 결산은 시작 시각이 달라 다시 선다. */
  dismiss: () => Promise<void>
}

/** 지금 나가 있는 조회. 겹쳐 부르면 이것을 함께 기다린다. */
let inFlight: Promise<void> | null = null

function visibilityOf(settling: boolean, startedAt: string | null, dismissedAt: string | null): boolean {
  return settling && startedAt !== null && startedAt !== dismissedAt
}

export const useSettlementStore = create<SettlementState>()((set, get) => ({
  settling: false,
  startedAt: null,
  dismissedAt: null,
  visible: false,

  async refresh() {
    if (inFlight !== null) {
      await inFlight
      return
    }

    inFlight = (async () => {
      // 기기의 닫은 기록을 함께 읽는다. 앱을 다시 켠 뒤 첫 회차가 그것을 모르면 이미 닫은 줄이
      // 한 번 선다.
      const [remote, dismissedAt] = await Promise.all([
        fetchSettlement(),
        getDismissedSettlementAt().catch(() => null),
      ])

      // 못 받은 것과 **결산 아님** 은 다른 사실이지만 화면이 하는 일은 같다. 안 세운다.
      const settling = remote?.settling ?? false
      const startedAt = remote?.startedAt ?? null

      set({ settling, startedAt, dismissedAt, visible: visibilityOf(settling, startedAt, dismissedAt) })
    })()

    try {
      await inFlight
    } finally {
      inFlight = null
    }
  },

  async dismiss() {
    const { startedAt } = get()
    if (startedAt === null) return

    // 저장 실패는 삼킨다. 이번 실행 동안은 줄이 내려가고, 그것이 사용자가 보는 결과다. 다음에
    // 켜면 한 번 더 서는데 거짓이 아니라 이미 읽은 안내를 다시 보는 일이다.
    await dismissSettlement(startedAt).catch(() => undefined)
    set({ dismissedAt: startedAt, visible: false })
  },
}))

/**
 * 스케줄러 데이터를 갱신하는 자리가 부르는 문. **실패를 밖으로 안 던진다.**
 *
 * 결산 조회가 실패했다고 스케줄러 동기화가 실패로 끝나면 안 된다. 그쪽이 받아온 데이터는 멀쩡하다.
 *
 * @example void refreshSettlement()
 */
export async function refreshSettlement(): Promise<void> {
  await useSettlementStore.getState().refresh().catch(() => undefined)
}
