/**
 * MVP 등급을 물을 것이 있으면 모달을 띄우는 자리. 앱이 열릴 때와 앱으로 돌아올 때 잰다.
 *
 * 내비게이터 밖(`AppShell`)이라 어느 화면에서든 뜬다. 돌아올 때도 재는 것은 켜 둔 채 목요일을 넘긴
 * 사용자에게 주간 확인이 뜨게 하려는 것이다.
 */
import { useCallback, useEffect, useState } from 'react'

import { useAppEntryStore } from '../../features/app-entry/store'
import { useMvpAskStore, type MvpAskResult } from '../../features/mvp-grade/flow-store'
import { useToastStore } from '../../features/toast/store'
import { useReturnToForeground } from '../../hooks/useReturnToForeground'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { MvpGradeModal } from './MvpGradeModal'

export function MvpGradeHost(): React.JSX.Element | null {
  const isReady = useAppEntryStore((state) => state.stage === 'ready')
  const ask = useMvpAskStore((state) => state.ask)
  const accounts = useMvpAskStore((state) => state.accounts)
  const weeklyOff = useMvpAskStore((state) => state.weeklyOff)
  const [busy, setBusy] = useState(false)

  const evaluate = useCallback(() => {
    if (isReady) void useMvpAskStore.getState().evaluate(new Date())
  }, [isReady])

  useEffect(evaluate, [evaluate])
  useReturnToForeground(evaluate)

  if (!isReady || ask === null) return null

  async function done(result: MvpAskResult): Promise<void> {
    setBusy(true)
    try {
      await useMvpAskStore.getState().complete(result, new Date())
    } catch {
      useToastStore.getState().showError('저장하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <MvpGradeModal
      // 물음이 바뀌면 고르던 값을 새로 세운다.
      key={`${ask.kind}:${ask.accountIds.join(',')}`}
      ask={ask}
      accounts={accounts}
      weeklyOff={weeklyOff}
      todayDateKey={getCurrentKstDateKey(new Date())}
      busy={busy}
      onDone={(result) => void done(result)}
    />
  )
}
