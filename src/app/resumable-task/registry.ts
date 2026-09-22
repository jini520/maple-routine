/**
 * 이어서 하는 작업의 등록부. 앱을 다시 열 때 끝나지 않은 작업 표시의 id 로 정의를 찾는다.
 * 새 작업은 여기 한 줄을 더한다. 빠지면 그 작업의 표시는 묻지 않고 지워진다.
 */
import type { ResumableTask } from '../../features/resumable-task/task'
import { mvpBulkFeeTask, mvpRecalcFeeTask } from '../../features/mvp-grade/tasks'

const TASKS: readonly ResumableTask[] = [mvpBulkFeeTask, mvpRecalcFeeTask]

export function findResumableTask(id: string): ResumableTask | undefined {
  return TASKS.find((task) => task.id === id)
}
