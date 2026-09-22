/**
 * 이어서 하는 작업을 띄우는 자리. 앱이 열리면 끝나지 않은 작업을 확인해 재진행 확인을 띄우고, 작업이 도는 동안 진행률을 띄운다.
 *
 * 내비게이터 밖(`AppShell`)이라 어느 화면에서든 뜬다.
 *
 * @see docs/foundation/error-resilience.md 앱이 중간에 닫혀도 끝나는 작업
 */
import { useEffect } from 'react'

import { CrownIcon, UsersIcon } from '../../components/atoms'
import { TaskProgressModal } from '../../components/organisms/TaskProgressModal/TaskProgressModal'
import { TaskResumeModal } from '../../components/organisms/TaskResumeModal/TaskResumeModal'
import { useAppEntryStore } from '../../features/app-entry/store'
import { useTaskRunnerStore } from '../../features/resumable-task/store'
import type { TaskIcon } from '../../features/resumable-task/task'
import { findResumableTask } from './registry'

const ICONS: Record<TaskIcon, typeof CrownIcon> = {
  crown: CrownIcon,
  users: UsersIcon,
}

export function TaskHost(): React.JSX.Element | null {
  const isReady = useAppEntryStore((state) => state.stage === 'ready')
  const progress = useTaskRunnerStore((state) => state.progress)
  const resume = useTaskRunnerStore((state) => state.resume)
  const running = useTaskRunnerStore((state) => state.running)

  useEffect(() => {
    if (isReady) void useTaskRunnerStore.getState().checkPending(findResumableTask)
  }, [isReady])

  // 진행률이 먼저다. 이어서 진행하면 재진행 확인이 진행률이 설 때까지 대기로 남는다.
  if (progress !== null) {
    return (
      <TaskProgressModal
        icon={ICONS[progress.icon]}
        title={progress.title}
        unit={progress.unit}
        done={progress.done}
        total={progress.total}
        steps={progress.steps}
      />
    )
  }
  if (resume !== null) {
    return (
      <TaskResumeModal tasks={resume} busy={running} onResume={() => void useTaskRunnerStore.getState().resumePending()} />
    )
  }
  return null
}
