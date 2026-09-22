/** 끝나지 않은 작업 표시(`pendingTasks`). 이어서 하는 작업이 시작 전에 적고, 남은 일이 0 이 되면 지운다. */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export interface PendingTask {
  /** 작업 등록부의 id */
  id: string
  /** 시작할 때 단계마다 남아 있던 일의 수. 진행률의 분모다 */
  totals: number[]
}

function isPendingTask(value: unknown): value is PendingTask {
  const task = value as PendingTask
  return typeof task?.id === 'string' && Array.isArray(task.totals) && task.totals.every((n) => typeof n === 'number')
}

export async function getPendingTasks(): Promise<PendingTask[]> {
  const raw = await preferences.get(STORAGE_KEYS.pendingTasks)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isPendingTask) : []
  } catch {
    return []
  }
}

/** 목록 전체를 적는다. 비면 키를 지운다. */
export async function setPendingTasks(tasks: readonly PendingTask[]): Promise<void> {
  if (tasks.length === 0) await preferences.remove(STORAGE_KEYS.pendingTasks)
  else await preferences.set(STORAGE_KEYS.pendingTasks, JSON.stringify(tasks))
}
