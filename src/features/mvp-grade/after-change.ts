import { useToastStore } from '../toast/store'
import { recalculateAutoFees } from './recalculate-fees'
import { useMvpGradeStore } from './store'

/** 등급 기록을 바꾼 뒤의 뒷정리. 자동 수수료를 다시 계산해 알리고, 화면이 읽는 등급 문맥을 다시 읽는다. */
export async function afterGradeChange(): Promise<void> {
  const recalculated = await recalculateAutoFees()
  if (recalculated > 0) useToastStore.getState().showSuccess(`자동 수수료 기록 ${recalculated}건을 다시 계산했어요`)
  await useMvpGradeStore.getState().reload()
}
