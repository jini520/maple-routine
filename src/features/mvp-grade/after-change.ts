import { useTaskRunnerStore } from '../resumable-task/store'
import { useMvpGradeStore } from './store'
import { mvpBulkFeeTask, mvpRecalcFeeTask } from './tasks'

/**
 * 등급 기록을 바꾼 뒤의 뒷정리. 화면이 읽는 등급 문맥을 다시 읽고, 자동 수수료를 다시 세는 작업을 돌린다.
 * 이어서 하는 작업이라 0.3초 넘게 걸리면 진행률이 서고 끝나면 완료 토스트가 뜬다.
 *
 * @param options.bulkApply 기존 사용자의 첫 흐름에서 켠 일괄 적용. 다시 계산보다 먼저 돈다
 * @param options.onRecorded 끝나지 않은 작업 표시를 적은 뒤에 부른다
 */
export async function afterGradeChange(options: { bulkApply?: boolean; onRecorded?: () => Promise<void> } = {}): Promise<void> {
  await useMvpGradeStore.getState().reload()
  const tasks = options.bulkApply === true ? [mvpBulkFeeTask, mvpRecalcFeeTask] : [mvpRecalcFeeTask]
  await useTaskRunnerStore.getState().run(tasks, { onRecorded: options.onRecorded })
}
