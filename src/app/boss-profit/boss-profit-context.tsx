import { createContext, useContext } from 'react'
import type { BossProfitStore } from '../../features/boss-profit/store'
import type { RecordedDrop } from '../../types/drops'

// 보스 수익 화면의 기간·탭 맥락과 스토어 바인딩을 자손에게 내리는 컨텍스트.
//
// 이 값들은 `BossProfitScreen → CharacterAccordion → Weekly/MonthlyAccordionBody →
// `BossProfitBossRow` 4단계를 타고 내려가며 타입 선언 25곳 + JSX 전달 26곳, 합쳐 51지점을
// 만들고 있었다. 그중 어느 것도 중간 컴포넌트가 쓰지 않고 그냥 통과시키기만 한다.
//
// 화면 전체가 공유하는 맥락만 담는다. 특정 캐릭터·특정 보스에 매인 값(`group` `row` `issue`
// `stickyTop`)은 프롭으로 남는다. 컨텍스트가 그런 것까지 삼키면 이 컴포넌트가 무엇에 대한
// 것인지가 시그니처에서 사라진다.

export interface BossProfitContextValue {
  /** 주간/월간 탭. */
  tab: BossProfitStore['tab']
  /** 보고 있는 기간의 키. */
  periodKey: string
  /**
   * 지금 그려지고 있는 데이터의 (탭, 기간). 카운트업 identity 전용.
   *
   * 위의 `tab`·`periodKey` 는 데이터보다 먼저 바뀌므로 identity 에 쓰면 새 키 + 옛 금액 커밋이
   * 기억을 오염시킨다. 라벨·네비게이션은 계속 위의 값을 쓴다.
   */
  loadedTab: BossProfitStore['tab']
  loadedPeriodKey: string
  /**
   * 화면이 한 번만 만든 '지금'. 두 번 호출하면 두 시각이 기간 경계를 사이에 두고 갈려
   * "현재 기간 판정"과 "기간 라벨"이 서로 다른 기간을 가리킬 수 있다.
   */
  now: Date
  /** 보스 행 키 → 기록된 드롭. */
  dropsByRowKey: Record<string, RecordedDrop[]>
  setPartySize: BossProfitStore['setPartySize']
  setBossDrops: BossProfitStore['setBossDrops']
  /** 월간 탭에서 이 기간을 실제로 조회할 수 있는지. */
  isMonthlyBossQueryable: boolean
  /** 주차 행의 조회·다시 시도. 이 기간을 다시 로드한다(store.retryPeriod). */
  onRetryPeriod: () => void
}

const BossProfitContext = createContext<BossProfitContextValue | null>(null)

export const BossProfitContextProvider = BossProfitContext.Provider

/**
 * 보스 수익 맥락을 읽는다.
 *
 * Provider 밖에서 부르면 **던진다**. 조용히 기본값을 돌려주면 잘못된 기간의 값으로 화면이
 * 그려지고, 그 오류는 "왜 지난주 금액이 보이지"처럼 한참 뒤에야 드러난다.
 */
export function useBossProfitContext(): BossProfitContextValue {
  const value = useContext(BossProfitContext)
  if (value === null) {
    throw new Error('useBossProfitContext는 BossProfitContextProvider 안에서만 쓸 수 있습니다')
  }
  return value
}
