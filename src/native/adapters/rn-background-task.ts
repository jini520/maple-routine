/**
 * expo-background-task 어댑터. OS 가 앱을 깨워 돌리는 태스크 하나를 정의 · 등록 · 해제한다.
 *
 * iOS 는 BGTaskScheduler 의 processing 작업이라 기기가 쉴 때 OS 가 때를 정하고, 안드로이드는 WorkManager 다. 시뮬레이터에서는
 * 돌지 않는다. Info.plist 의 `processing` 모드와 허용 식별자가 없으면 iOS 가 등록을 거부한다.
 */
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

import type { BackgroundTaskPort } from '../ports'

/** OS 에 거는 태스크 이름. 등록 · 해제 · 정의가 같은 이름을 본다 */
export const BACKGROUND_REFRESH_TASK = 'schedule-refresh'

/**
 * 태스크 몸통을 OS 에 알린다. `index.ts` 최상위에서 부른다. 모듈 최상위가 아니면 OS 가 꺼진 앱을 깨울 때 핸들러를 찾지 못한다.
 * 몸통이 던지면 실패로 답한다. 던진 채 두면 OS 가 태스크를 비정상 종료로 세어 다음 기회를 늦춘다.
 */
export function defineBackgroundRefreshTask(handler: () => Promise<void>): void {
  TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
    try {
      await handler()
      return BackgroundTask.BackgroundTaskResult.Success
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed
    }
  })
}

export const rnBackgroundTaskPort: BackgroundTaskPort = {
  // 제한된 기기(저전력 모드 · 백그라운드 새로고침 꺼짐)에서는 등록이 던진다. 예약은 서 있으므로 조용히 둔다.
  register: async (minimumIntervalMinutes) => {
    if ((await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Restricted) return
    await BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, { minimumInterval: minimumIntervalMinutes })
  },
  // 등록 안 된 태스크를 풀면 던진다.
  unregister: async () => {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_REFRESH_TASK)
    }
  },
}
