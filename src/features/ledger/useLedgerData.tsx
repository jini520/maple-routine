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
import { collectEnhancementHistory } from '../enhancement-history/collect'
import { datesBetween } from '../../lib/calendar'
import { useLedgerProgress } from './progress'
import { syncScheduleWindow } from '../schedule-window/sync'

export interface LedgerDataState {
  /** `filling` 인 동안 모달이 뜬다. **마운트와 당김에만** 선다. */
  status: 'idle' | 'filling' | 'ready'
  /**
   * 지금 회차가 도는 중인가. `status` 와 갈리는 자리가 **기간 이동**이다. 거기는 모달을 안 띄우고
   * 값이 들어오는 대로 칸에 붙이므로, 화면이 **확정 전 숫자**를 흐리게 그릴 근거가 이것이다.
   *
   * 없으면 아직 안 받은 지출이 `0` 으로 단정된 채 진하게 서고, 값이 들어오며 네 번 바뀐다.
   */
  collecting: boolean
  /** 회차가 끝날 때마다 오른다. 자식이 **다시 읽을 계기**로 쓰는 유일한 신호다. */
  revision: number
  /**
   * 전부 다시 불러온다. **두 하위 화면의 당김이 이것만 부른다.**
   *
   * 오늘(라이브 동기화 · 자동 기록)과 과거(창)를 함께 받는다. 둘을 자식이 조합하면 어느 쪽이
   * 무엇을 부르는지가 화면마다 갈린다.
   */
  reload: () => Promise<void>
  /**
   * 가계부가 **그리는 날짜 범위**를 층에 알린다. 그 범위의 강화 사용 내역을 층이 받는다.
   *
   * 층은 마운트에서 주간 보기의 기본 범위를 쓴다. 사용자가 달을 옮기면 화면이 이것으로 새 범위를
   * 말하고 층이 그 회차를 돈다. 같은 범위를 두 번 말해도 안 돈다.
   */
  requestDateRange: (range: CashbookRange) => void
}

/**
 * 회차 도중에 화면을 다시 읽히는 간격.
 *
 * `revision` 이 컨텍스트 값이라 오를 때마다 층이 통째로 다시 그려진다. 칸마다 올리면 105번이고,
 * 아예 안 올리면 회차가 끝날 때까지 빈 달력이다. 그 사이를 이 값이 잡는다.
 */
const REVISION_FLUSH_MS = 600

const IDLE: LedgerDataState = {
  status: 'idle',
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
   * @param live 오늘(라이브 동기화 · 자동 기록)까지 받을 것인가
   * @param range 강화 사용 내역을 받을 날짜 범위
   *
   * 마운트에서 `live` 가 거짓이다. 오늘은 보스 수익 스토어의 진입 경로(`loadTrackedOcids`)가
   * 10분 TTL 로 이미 맡고 있어, 여기서 또 부르면 진입마다 조회가 두 번 나간다.
   *
   * **창과 히스토리를 함께 돌린다.** 둘 다 콜 없이 원장만 읽어 자기 분모를 알리므로, 진행 바가
   * 도는 중에 뒤로 가지 않는다.
   */
  const run = useCallback(async (live: boolean, range: CashbookRange) => {
    running.current += 1
    const progress = useLedgerProgress.getState()
    progress.reset()

    /**
     * 들어온 것을 **회차 도중에** 화면에 흘린다. 끝에서 한 번만 올리면 지난 달로 옮긴 사용자가
     * 105콜이 다 끝날 때까지 빈 달력을 본다.
     *
     * 묶어서 올리는 이유는 `revision` 이 컨텍스트 값이라 오를 때마다 층이 통째로 다시 그려지기
     * 때문이다. 칸마다 올리면 105번이다.
     */
    let lastFlushedAt = 0
    const flush = (): void => {
      const now = Date.now()
      if (now - lastFlushedAt < REVISION_FLUSH_MS) return
      lastFlushedAt = now
      if (alive.current) setRevision((value) => value + 1)
    }

    const ocids = await getTrackedCharacterOcids().catch(() => null)
    if (live && ocids !== null && ocids.length > 0) {
      await useBossProfitStore
        .getState()
        .refresh(ocids, { inPlace: true })
        .catch(() => undefined)
    }

    // 칸은 각자 자기 분모를 알리는 순간 잡힌다. 그 전까지 분모가 0 이라 바가 안 그려진다.
    const slotOf = (): ((done: number, total: number) => void) => {
      let slot: number | null = null
      return (done, total) => {
        if (slot === null) slot = useLedgerProgress.getState().start(total)
        useLedgerProgress.getState().advance(slot, done)
      }
    }

    await Promise.all([
      ocids !== null && ocids.length > 0
        ? syncScheduleWindow(ocids, new Date(), slotOf()).catch(() => undefined)
        : Promise.resolve(),
      collectEnhancementHistory(
        datesBetween(range.from, range.to),
        new Date(),
        slotOf(),
        flush,
      ).catch(() => undefined),
    ])

    running.current -= 1
    if (!alive.current) return
    progress.reset()
    if (running.current === 0) setCollecting(false)
    setStatus('ready')
    setRevision((value) => value + 1)
  }, [])

  // 지금 회차가 도는 범위. 화면이 알려 주기 전에는 주간 보기의 기본값이다. 렌더에 안 쓰므로
  // state 가 아니다. state 로 두면 범위가 바뀔 때마다 층이 통째로 다시 그려진다.
  const range = useRef<CashbookRange>(defaultCashbookRange(new Date()))

  /** 당김이 부르는 자리라 여기서 `filling` 을 세워도 연쇄 렌더가 아니다. */
  const reload = useCallback(async () => {
    setStatus('filling')
    setCollecting(true)
    await run(true, range.current)
  }, [run])

  /**
   * 기간을 옮겼다. **모달을 안 띄운다.**
   *
   * 사용자가 달력을 보려고 옮긴 것인데 그 위를 모달이 덮으면 105콜이 끝날 때까지 아무것도 못
   * 본다. 값은 들어오는 대로 `revision` 을 타고 칸에 붙으므로, 채워지는 것 자체가 진행 표시다.
   */
  const requestDateRange = useCallback(
    (next: CashbookRange) => {
      // 같은 범위를 두 번 말하는 것이 정상이다. 화면이 다시 그릴 때마다 부른다.
      if (next.from === range.current.from && next.to === range.current.to) return
      range.current = next
      setCollecting(true)
      void run(false, next)
    },
    [run],
  )

  useEffect(() => {
    void run(false, range.current)
  }, [run])

  const value = useMemo(
    () => ({ status, collecting, revision, reload, requestDateRange }),
    [status, collecting, revision, reload, requestDateRange],
  )

  return <LedgerDataContext.Provider value={value}>{props.children}</LedgerDataContext.Provider>
}
