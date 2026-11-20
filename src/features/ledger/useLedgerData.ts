/**
 * 수익 · 지출 층의 상태와 그것을 읽는 훅. 회차를 돌리는 공급자는 `LedgerDataProvider.tsx` 다.
 */
import { createContext, useContext } from 'react'

import type { CashbookRange } from '../cashbook/range'

/**
 * 한 회차가 받을 것. **화면이 고르고 층이 어떻게 받을지를 안다.**
 *
 * - `live` 오늘. 스케줄 회차(신선해도 받는다. 자동 기록과 처치 날짜가 그 안에 있다)와 오늘 강화
 * - `window` 지난 날의 창. 두 화면 다 받는다. 가계부의 보스 결정석 줄이 그 기록에서 온다
 * - `enhancement` 강화 사용 내역. **가계부만** 받는다. 보스 수익은 그 값을 안 그린다. 오늘이 범위에 들어 `live` 의 오늘 강화는 건너뛴다
 */
export type LedgerReloadPart = 'live' | 'window' | 'enhancement'

export interface LedgerDataState {
  /**
   * `filling` 인 동안 모달이 뜬다. 서는 자리가 셋이다. **안 받아 둔 지난 날이 있는 마운트** ·
   * 당김 · **한 번도 안 받아 본 범위로의 기간 이동**. 셋 다 화면에 그릴 것이 아직 없는 자리다.
   *
   * 오늘 칸만 받는 마운트는 `idle` 로 시작해 `ready` 로 간다. 그 회차는 지난 방문의 값이 이미
   * 서 있어 덮을 것이 없다.
   */
  status: 'idle' | 'filling' | 'ready'
  /**
   * 이 회차가 **오래 걸릴 것을 시작 전에 알았나**. 참이면 모달이 400ms 를 안 끈다.
   *
   * 그 문턱은 짧을지 길지 모르는 회차가 화면을 번쩍이지 않게 하는 보험이다. 마운트와 기간 이동은
   * 원장을 먼저 읽어 답을 이미 아므로, 거기서까지 기다리면 사용자는 빈 격자를 반 초 더 본다.
   */
  knownLong: boolean
  /**
   * 지금 회차가 도는 중인가. `status` 와 갈리는 자리가 **이미 받아 둔 범위로의 기간 이동**이다.
   * 거기는 모달이 안 서지만 화면은 여전히 아무 값도 안 그려야 한다.
   *
   * 없으면 아직 안 받은 지출이 `0` 으로 단정된 채 서고, 값이 들어오며 네 번 바뀐다.
   *
   * **오늘 칸만 받는 회차에서는 거짓이다.** 그 회차의 기기 DB 는 지난 방문의 값을 다 들고 있어
   * 자라는 중이 아니다. 새로 쓴 것만 회차 끝에 한 번 붙는다. 참으로 두면 탭에 들어올 때마다
   * 화면이 빈다.
   */
  collecting: boolean
  /**
   * 다시 불러온다. **두 하위 화면의 당김이 이것만 부른다.**
   *
   * 받을 조각을 화면이 고른다. 보스 수익은 `['live', 'window']`, 가계부는 거기에
   * `'enhancement'` 를 더한다. 조각을 고를 뿐 도는 법(순서·겹침·진행률)은 층이 진다.
   *
   * @param parts 이 회차가 받을 것
   */
  reload: (parts: readonly LedgerReloadPart[]) => Promise<void>
  /**
   * 가계부가 **그리는 날짜 범위**를 층에 알린다. 그 범위의 강화 사용 내역을 층이 받는다.
   *
   * 층은 마운트에서 주간 보기의 기본 범위를 쓴다. 사용자가 달을 옮기면 화면이 이것으로 새 범위를
   * 말하고 층이 그 회차를 돈다. 같은 범위를 두 번 말해도 안 돈다.
   */
  requestDateRange: (range: CashbookRange) => void
}

const IDLE: LedgerDataState = {
  status: 'idle',
  knownLong: false,
  collecting: false,
  reload: () => Promise.resolve(),
  requestDateRange: () => undefined,
}

// 프로바이더 밖에서도 터지지 않는다. 층이 없는 것이지 잘못 쓴 것이 아니다(테스트 하네스·
// 단독 렌더가 그 자리다).
export const LedgerDataContext = createContext<LedgerDataState>(IDLE)

export function useLedgerData(): LedgerDataState {
  return useContext(LedgerDataContext)
}
