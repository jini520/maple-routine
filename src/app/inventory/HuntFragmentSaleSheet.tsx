/**
 * 사냥 조각 칸의 `판매`. 가계부의 `사냥 전리품 판매` 시트(`조각` 칸)를 지금 모양 그대로 연다. 사냥 조각은 가계부 사냥 기록에서
 * 생겨 그 시트로 팔아 왔으므로 같은 일을 두 모양으로 하지 않는다.
 */
import { useEffect, useState } from 'react'

import { loadSheetAccounts, type SheetAccount } from '../../features/cashbook/account-names'
import { loadMesoRate } from '../../features/cashbook/meso-rate'
import { historyFloorDateKey } from '../../features/cashbook/range'
import {
  loadFragmentStorage,
  loadHuntFragmentFloor,
  loadLastHunts,
  loadTrackedCharacters,
  recordIncome,
  recordIncomes,
} from '../../features/cashbook/records'
import { useToastStore } from '../../features/toast/store'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import type { LastHunts } from '../../storage/last-hunts'
import { IncomeSheet, type IncomeDraft } from '../cashbook/IncomeSheet'
import type { SheetCharacter } from '../cashbook/income/form-shared'

export function HuntFragmentSaleSheet(props: { onClose: () => void }): React.JSX.Element {
  const [todayDateKey] = useState(() => getCurrentKstDateKey(new Date()))
  const [characters, setCharacters] = useState<readonly SheetCharacter[]>([])
  const [accounts, setAccounts] = useState<readonly SheetAccount[]>([])
  const [lastHunts, setLastHunts] = useState<LastHunts>({})

  useEffect(() => {
    void loadTrackedCharacters().then(setCharacters)
    void loadSheetAccounts().then(setAccounts, () => undefined)
    void loadLastHunts().then(setLastHunts)
  }, [])

  async function save(write: () => Promise<void>): Promise<void> {
    try {
      await write()
    } catch (error) {
      useToastStore.getState().showError('수입을 적지 못했습니다')
      throw error
    }
  }

  return (
    <IncomeSheet
      startCategory="hunt_loot_sale"
      characters={characters}
      accounts={accounts}
      lastPointRate={null}
      lastHunts={lastHunts}
      loadMesoRate={loadMesoRate}
      loadFragmentStorage={loadFragmentStorage}
      loadHuntFragmentFloor={loadHuntFragmentFloor}
      dateKey={todayDateKey}
      todayDateKey={todayDateKey}
      earliestDateKey={historyFloorDateKey(todayDateKey)}
      onSave={(draft: IncomeDraft) => save(() => recordIncome(draft, new Date()))}
      onSaveMany={(drafts) => save(() => recordIncomes(drafts, new Date()))}
      onClose={props.onClose}
    />
  )
}
