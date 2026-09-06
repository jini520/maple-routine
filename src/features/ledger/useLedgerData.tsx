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
import { useLedgerProgress } from './progress'
import { syncScheduleWindow } from '../schedule-window/sync'

export interface LedgerDataState {
  /** `filling` 인 동안 자식이 불러오는 중 을 그린다. */
  status: 'idle' | 'filling' | 'ready'
  /** 회차가 끝날 때마다 오른다. 자식이 **다시 읽을 계기**로 쓰는 유일한 신호다. */
  revision: number
  /**
   * 전부 다시 불러온다. **두 하위 화면의 당김이 이것만 부른다.**
   *
   * 오늘(라이브 동기화 · 자동 기록)과 과거(창)를 함께 받는다. 둘을 자식이 조합하면 어느 쪽이
   * 무엇을 부르는지가 화면마다 갈린다.
   */
  reload: () => Promise<void>
}

const IDLE: LedgerDataState = {
  status: 'idle',
  revision: 0,
  reload: () => Promise.resolve(),
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
  const [revision, setRevision] = useState(0)
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
   *
   * 마운트에서는 거짓이다. 오늘은 보스 수익 스토어의 진입 경로(`loadTrackedOcids`)가 10분 TTL
   * 로 이미 맡고 있어, 여기서 또 부르면 진입마다 조회가 두 번 나간다.
   */
  const run = useCallback(async (live: boolean) => {
    const progress = useLedgerProgress.getState()
    progress.reset()

    const ocids = await getTrackedCharacterOcids().catch(() => null)
    if (ocids !== null && ocids.length > 0) {
      if (live) {
        await useBossProfitStore
          .getState()
          .refresh(ocids, { inPlace: true })
          .catch(() => undefined)
      }
      // 칸은 창이 자기 분모를 알리는 순간 잡힌다. 그 전까지 분모가 0 이라 바가 안 그려진다.
      let slot: number | null = null
      await syncScheduleWindow(ocids, new Date(), (done, total) => {
        if (slot === null) slot = useLedgerProgress.getState().start(total)
        useLedgerProgress.getState().advance(slot, done)
      }).catch(() => undefined)
    }
    if (!alive.current) return
    progress.reset()
    setStatus('ready')
    setRevision((value) => value + 1)
  }, [])

  /** 당김이 부르는 자리라 여기서 `filling` 을 세워도 연쇄 렌더가 아니다. */
  const reload = useCallback(async () => {
    setStatus('filling')
    await run(true)
  }, [run])

  useEffect(() => {
    void run(false)
  }, [run])

  const value = useMemo(() => ({ status, revision, reload }), [status, revision, reload])

  return <LedgerDataContext.Provider value={value}>{props.children}</LedgerDataContext.Provider>
}
