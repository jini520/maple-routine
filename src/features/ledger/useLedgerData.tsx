/**
 * 수익·지출 층의 **데이터 소유자**. 두 하위 화면(보스 수익·가계부)이 여기를 구독한다.
 *
 * 자식마다 조립하던 때 결함이 셋 났고 전부 같은 물음에서 났다. 누가 부르나(탭 재진입 시 TTL
 * 게이트 뒤로 빠졌다) · 언제 끝나나(시작 전인지 도는 중인지 몰라 실패로 그렸다) · 누가 결과를
 * 받나(가계부가 먼저 읽고 굳었다).
 *
 * 소유자가 하나면 그 셋이 사라진다. **다시 불러오기의 뜻도 한 곳에서 정한다.** 전에는 두 화면이
 * 각자 조합했다(가계부는 `refreshCashbook`, 보스 수익은 `refresh` + 창).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { useBossProfitStore } from '../boss-profit/store'
import { defaultCashbookRange, type CashbookRange } from '../cashbook/range'
import { collectEnhancementHistory, measureEnhancementHistory } from '../enhancement-history/collect'
import { datesBetween } from '../../lib/calendar'
import { useRefreshProgress } from '../refresh/progress'
import { syncScheduleWindow } from '../schedule-window/sync'
import { planScheduleWindow } from '../schedule-window/window'

/**
 * 한 회차가 받을 것. **화면이 고르고 층이 어떻게 받을지를 안다.**
 *
 * - `live` 오늘. 라이브 동기화와 자동 기록
 * - `window` 지난 날의 창. 두 화면 다 받는다. 가계부의 보스 결정석 줄이 그 기록에서 온다
 * - `enhancement` 강화 사용 내역. **가계부만** 받는다. 보스 수익은 그 값을 안 그린다
 */
export type LedgerReloadPart = 'live' | 'window' | 'enhancement'

export interface LedgerDataState {
  /**
   * `filling` 인 동안 모달이 뜬다. 서는 자리가 셋이다. 마운트 · 당김 · **한 번도 안 받아 본
   * 범위로의 기간 이동**. 셋 다 화면에 그릴 것이 아직 없는 자리다.
   */
  status: 'idle' | 'filling' | 'ready'
  /**
   * 이 회차가 **오래 걸릴 것을 시작 전에 알았나**. 참이면 모달이 400ms 를 안 끈다.
   *
   * 그 문턱은 짧을지 길지 모르는 회차가 화면을 번쩍이지 않게 하는 보험이다. 기간 이동은 원장을
   * 먼저 읽어 답을 이미 아므로, 거기서까지 기다리면 사용자는 빈 격자를 반 초 더 본다.
   */
  knownLong: boolean
  /**
   * 지금 회차가 도는 중인가. `status` 와 갈리는 자리가 **이미 받아 둔 범위로의 기간 이동**이다.
   * 거기는 모달이 안 서지만 화면은 여전히 아무 값도 안 그려야 한다.
   *
   * 없으면 아직 안 받은 지출이 `0` 으로 단정된 채 서고, 값이 들어오며 네 번 바뀐다.
   */
  collecting: boolean
  /** 회차가 끝날 때마다 오른다. 자식이 **다시 읽을 계기**로 쓰는 유일한 신호다. */
  revision: number
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
  revision: 0,
  reload: () => Promise.resolve(),
  requestDateRange: () => undefined,
}

// 프로바이더 밖에서도 터지지 않는다. 층이 없는 것이지 잘못 쓴 것이 아니다(테스트 하네스·
// 단독 렌더가 그 자리다).
const LedgerDataContext = createContext<LedgerDataState>(IDLE)

export function useLedgerData(): LedgerDataState {
  return useContext(LedgerDataContext)
}

export function LedgerDataProvider(props: {
  children: React.ReactNode
}): React.JSX.Element {
  // 마운트하면 반드시 채우므로 시작이 곧 `filling` 이다. 효과 안에서 이 값을 세우면 렌더가
  // 한 번 더 돈다(연쇄 렌더).
  const [status, setStatus] = useState<LedgerDataState['status']>('filling')
  // 마운트 회차는 안 재고 시작한다. 문턱이 그 자리를 든다.
  const [knownLong, setKnownLong] = useState(false)
  // 마운트하면 반드시 채우므로 시작이 곧 참이다. 효과 안에서 세우면 렌더가 한 번 더 돈다.
  const [collecting, setCollecting] = useState(true)
  const [revision, setRevision] = useState(0)
  // 회차가 겹칠 수 있다(기간을 연타하면 앞 회차가 아직 돈다). 세어야 뒤 회차가 도는 중에 앞
  // 회차가 끝나며 `collecting` 을 꺼 버리지 않는다.
  const running = useRef(0)
  // 언마운트 뒤 setState 를 막는 문지기. 창 한 회차가 화면보다 오래 살 수 있다(84건).
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /**
   * @param parts 이 회차가 받을 것
   * @param range 강화 사용 내역을 받을 날짜 범위
   *
   * 마운트에는 `live` 가 없다. 오늘은 보스 수익 스토어의 진입 경로(`loadTrackedOcids`)가
   * 10분 TTL 로 이미 맡고 있어, 여기서 또 부르면 진입마다 조회가 두 번 나간다.
   *
   * **계획을 먼저 다 세우고 그 다음에 돌린다.** 셋 다 콜 없이 원장만 읽어 자기 할 일을 셀 수
   * 있어서, 총합을 첫 순간에 잡을 수 있다. 실행하며 각자 등록하면 바가 뒤로 간다.
   *
   * 회차를 열고 `finally` 에서 닫는다. 그래야 한 갈래가 끝나며 그 칸만 사라져 바가 중간에
   * 꺼지는 일이 없다.
   *
   * @param historyTotal 기간 이동이 **미리 재 둔** 히스토리의 작업 수. 안 주면 여기서 잰다
   */
  const run = useCallback(
    async (parts: readonly LedgerReloadPart[], range: CashbookRange, historyTotal?: number) => {
      running.current += 1
      const endRound = useRefreshProgress.getState().beginRound()

      try {
        const read = await getTrackedCharacterOcids().catch(() => null)
        // 좁힌 값을 따로 든다. 아래 갈래가 async 라 `hasOcids` 로 좁힌 것이 그 안까지 안 간다.
        const ocids: string[] = read ?? []
        const hasOcids = ocids.length > 0
        const now = new Date()
        const wantsLive = parts.includes('live') && hasOcids
        const wantsWindow = parts.includes('window') && hasOcids
        const wantsHistory = parts.includes('enhancement')
        const dates = datesBetween(range.from, range.to)

        // ## 계획을 먼저 다 세운다
        //
        // 셋 다 **콜 없이 원장만 읽어** 자기 할 일을 셀 수 있다. 실행하며 각자 자기 차례에 분모를
        // 등록하면 앞 수집기가 이미 100% 를 찍은 뒤라 **바가 뒤로 간다**(사용자 보고
        // `가계부는 왜 로딩이 두번돼`). 총합을 먼저 잡고 그 다음에 실행한다.
        const [windowPlan, historyPlanned] = await Promise.all([
          wantsWindow ? planScheduleWindow(ocids, now) : Promise.resolve(null),
          wantsHistory && historyTotal === undefined
            ? measureEnhancementHistory(dates, now)
                .then((size) => size.total)
                .catch(() => 0)
            : Promise.resolve(historyTotal ?? 0),
        ])

        /**
         * 칸을 **여기서 연다**. 수집기가 나중에 같은 값을 알려도 칸이 이미 있어 두 번 안 열린다.
         *
         * @param planned 계획이 센 작업 수
         */
        const slotOf = (planned: number): ((done: number, total: number) => void) => {
          const slot = useRefreshProgress.getState().start(planned)
          // 실제로 해 보니 다른 분모가 오면 고친다. 라이브가 그 자리다. 계획은 추적 목록의
          // 캐릭터 수인데 실제로 도는 것은 자격을 지난 수다.
          return (done, total) => {
            useRefreshProgress.getState().advance(slot, done, total)
          }
        }

        const reportLive = wantsLive ? slotOf(ocids.length) : null
        const reportWindow = windowPlan === null ? null : slotOf(windowPlan.jobs.length)
        const reportHistory = wantsHistory ? slotOf(historyPlanned) : null

        // ## 두 갈래가 **함께** 돈다
        //
        // 스케줄 갈래 안에서만 순서가 계약이다. 오늘을 받아야 지난 날의 기록이 오늘 것을 안
        // 빠뜨린다. 강화는 다른 API·다른 표라 그 순서와 무관하다.
        await Promise.all([
          (async () => {
            if (reportLive !== null) {
              await useBossProfitStore
                .getState()
                .refresh(ocids, { inPlace: true }, reportLive)
                .catch(() => undefined)
            }
            if (reportWindow !== null && windowPlan !== null) {
              await syncScheduleWindow(ocids, new Date(), reportWindow, windowPlan).catch(
                () => undefined,
              )
            }
          })(),
          reportHistory === null
            ? Promise.resolve()
            : collectEnhancementHistory(dates, new Date(), reportHistory).catch(() => undefined),
        ])
      } finally {
        running.current -= 1
        endRound()
      }

      if (!alive.current) return
      setRevision((value) => value + 1)

      // 도는 회차가 남아 있으면 안 걷는다. 기간을 연타하면 앞 회차가 끝나며 뒤 회차의 표시를
      // 꺼 버린다. 모달도 같은 계수 뒤에 둔다.
      if (running.current === 0) {
        setStatus('ready')
        setKnownLong(false)
        setCollecting(false)
      }
    },
    [],
  )

  // 지금 회차가 도는 범위. 화면이 알려 주기 전에는 주간 보기의 기본값이다. 렌더에 안 쓰므로
  // state 가 아니다. state 로 두면 범위가 바뀔 때마다 층이 통째로 다시 그려진다.
  const range = useRef<CashbookRange>(defaultCashbookRange(new Date()))

  /** 당김이 부르는 자리라 여기서 `filling` 을 세워도 연쇄 렌더가 아니다. */
  const reload = useCallback(
    async (parts: readonly LedgerReloadPart[]) => {
      // 당김은 안 재고 시작한다. 오늘까지 받는 회차라 원장만 봐서는 길이를 모른다.
      setKnownLong(false)
      setStatus('filling')
      setCollecting(true)
      await run(parts, range.current)
    },
    [run],
  )

  /**
   * 기간을 옮겼다. **아직 안 받은 지난 날이 있는 범위에서만 모달을 띄운다**(사용자 지정).
   *
   * 회차가 도는 동안 화면은 아무 값도 안 그린다. 이미 받아 둔 범위면 그 시간이 몇십 밀리초라
   * 눈에 안 띄지만, 처음 여는 달은 93콜이 끝날 때까지 빈 격자와 `0` 이 서 있는다.
   *
   * 재는 것은 콜이 아니라 원장이라 SQLite 한 번이다. 그 한 번이 두 가지를 함께 준다. 모달을
   * 띄울지(`hasPast`)와 **진행 바의 분모**(`total`)다. 분모를 안 넘기면 바가 모달보다 늦게 뜬다.
   *
   * 못 읽으면 **안 띄운다**. 안 뜨는 모달보다 안 걷히는 모달이 나쁘다.
   */
  const requestDateRange = useCallback(
    (next: CashbookRange) => {
      // 같은 범위를 두 번 말하는 것이 정상이다. 화면이 다시 그릴 때마다 부른다.
      if (next.from === range.current.from && next.to === range.current.to) return
      range.current = next
      setCollecting(true)
      void (async () => {
        const size = await measureEnhancementHistory(
          datesBetween(next.from, next.to),
          new Date(),
        ).catch(() => null)
        // 재는 사이에 또 옮겼으면 이 답은 다른 범위의 것이다.
        if (size?.hasPast === true && range.current === next) {
          // 이미 쟀으므로 모달이 400ms 를 더 끌 이유가 없다.
          setKnownLong(true)
          setStatus('filling')
        }
        // 잰 값을 넘긴다. 안 넘기면 바가 모달보다 늦게 뜬다.
        await run(['window', 'enhancement'], next, size?.total)
      })()
    },
    [run],
  )

  // 마운트는 **창과 강화**를 받는다. 강화를 여기서 빼면 가계부를 처음 누르는 순간 한 달치
  // 수집이 시작돼 없던 자리에 모달이 하나 더 선다(사용자 지정 `보스 수익의 당김에서만 빼자`).
  useEffect(() => {
    void run(['window', 'enhancement'], range.current)
  }, [run])

  const value = useMemo(
    () => ({ status, knownLong, collecting, revision, reload, requestDateRange }),
    [status, knownLong, collecting, revision, reload, requestDateRange],
  )

  return <LedgerDataContext.Provider value={value}>{props.children}</LedgerDataContext.Provider>
}
