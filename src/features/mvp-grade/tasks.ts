/**
 * MVP 등급의 이어서 하는 작업 둘. 기존 사용자의 첫 확인 화면에서 켠 일괄 적용과, 등급 기록을 바꿀 때마다 도는 다시 계산이다.
 *
 * @see docs/features/mvp-grade.md 수수료 기본값
 */
import type { ResumableTask, TaskStep } from '../resumable-task/task'
import { applyAutoDropFees, updateDropFees } from '../../storage/boss-drops'
import { updateProfitSplitFees } from '../../storage/boss-profit'
import { applyAutoIncomeSaleFees, updateIncomeSaleFees } from '../../storage/income'
import { bulkDropUpdates, bulkIncomeUpdates } from './bulk-apply'
import { recalcCrystalUpdates, recalcDropUpdates, recalcIncomeUpdates } from './recalculate-fees'

/** 목록 함수가 남은 일을 세고, 앞에서 `limit` 개를 잘라 쓴다. 쓴 기록은 목록에서 빠져 다시 안 잡힌다. */
function step<T>(label: string, sub: string | undefined, updates: () => Promise<T[]>, write: (chunk: T[]) => Promise<void>): TaskStep {
  return {
    label,
    sub,
    remaining: async () => (await updates()).length,
    runChunk: async (limit) => {
      const chunk = (await updates()).slice(0, limit)
      await write(chunk)
      return chunk.length
    },
  }
}

export const mvpBulkFeeTask: ResumableTask = {
  id: 'mvp-bulk-fee',
  name: '지난 기록 수수료 적용',
  title: '지난 기록에 수수료를 적용하고 있어요',
  icon: 'crown',
  steps: [
    step('판매 기록', '아이템 판매 · 조각 정산 · 사냥의 조각 몫', bulkIncomeUpdates, applyAutoIncomeSaleFees),
    step('드롭 판매가', '판매 · 분배 수수료', bulkDropUpdates, applyAutoDropFees),
  ],
  doneToast: (count) => `지난 기록 ${count.toLocaleString()}건에 수수료를 적용했어요`,
}

export const mvpRecalcFeeTask: ResumableTask = {
  id: 'mvp-recalc-fee',
  name: '자동 수수료 다시 계산',
  title: '자동 수수료를 다시 계산하고 있어요',
  icon: 'crown',
  steps: [
    step('판매 기록', undefined, recalcIncomeUpdates, updateIncomeSaleFees),
    step('드롭 판매가', undefined, recalcDropUpdates, updateDropFees),
    step('결정석 분배', undefined, recalcCrystalUpdates, updateProfitSplitFees),
  ],
  doneToast: (count) => `자동 수수료 기록 ${count.toLocaleString()}건을 다시 계산했어요`,
}
