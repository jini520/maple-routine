/**
 * 이어서 하는 작업의 러너. 끝나지 않은 작업 표시를 적고 조각씩 처리하며, 앱을 다시 열 때 남은 작업을 묻는다.
 *
 * @see docs/foundation/error-resilience.md 앱이 중간에 닫혀도 끝나는 작업
 */
import { create } from 'zustand'

import { getPendingTasks, setPendingTasks, type PendingTask } from '../../storage/pending-tasks'
import { useToastStore } from '../toast/store'
import type { ResumableTask, TaskIcon } from './task'

/** 조각 하나의 크기. 조각 하나가 트랜잭션 하나다 */
const CHUNK = 200
/** 이보다 빨리 끝나면 진행률 모달을 안 띄운다. 몇 건짜리 일에 모달이 한 프레임 번쩍이지 않게 */
const SHOW_DELAY_MS = 300

export interface TaskStepView {
  label: string
  sub?: string
  state: 'done' | 'run' | 'wait'
  done: number
  total: number
}

export interface TaskProgressView {
  icon: TaskIcon
  title: string
  unit: string
  steps: TaskStepView[]
  done: number
  total: number
}

export interface TaskResumeView {
  name: string
  done: number
  total: number
  unit: string
  /** 앞 작업 뒤에 기다리며 아직 손대지 않은 작업 */
  waiting: boolean
}

interface Entry {
  task: ResumableTask
  totals: number[]
}

interface TaskRunnerState {
  /** 진행률 모달이 그릴 것. 0.3초가 지나기 전과 끝난 뒤에는 `null` */
  progress: TaskProgressView | null
  /** 재진행 확인이 그릴 것 */
  resume: TaskResumeView[] | null
  /** 작업이 도는 중. 모달이 서기 전에도 참이다 */
  running: boolean
  /** 앱을 연 뒤 끝나지 않은 작업을 한 번 확인했다 */
  checked: boolean
  /**
   * 작업들을 차례로 끝까지 돌린다. 시작 전에 표시를 적고, 적은 뒤 `onRecorded` 를 부른다(처리할 것이 없어도).
   * 겹쳐 부르면 앞 호출이 끝난 뒤에 돈다. 실패는 토스트로 알리고 삼킨다.
   */
  run: (tasks: ResumableTask[], options?: { onRecorded?: () => Promise<void> }) => Promise<void>
  /** 끝나지 않은 작업 표시를 읽어 재진행 확인을 세운다. 남은 일이 0 이거나 모르는 작업은 묻지 않고 지운다. */
  checkPending: (find: (id: string) => ResumableTask | undefined) => Promise<void>
  /** 재진행 확인의 `이어서 진행하기`. 곧바로 진행률이 서고, 끝나면(실패해도) 재진행 확인이 내려간다. */
  resumePending: () => Promise<void>
}

let queue: Promise<void> = Promise.resolve()
/** 재진행 확인이 세운 작업. `resumePending` 이 이어서 돌린다 */
let pendingEntries: Entry[] = []

function sum(numbers: readonly number[]): number {
  return numbers.reduce((total, n) => total + n, 0)
}

async function remainingOf(task: ResumableTask): Promise<number[]> {
  return Promise.all(task.steps.map((step) => step.remaining()))
}

async function withPending(update: (tasks: PendingTask[]) => PendingTask[]): Promise<void> {
  await setPendingTasks(update(await getPendingTasks()))
}

export const useTaskRunnerStore = create<TaskRunnerState>()((set) => {
  function view(entry: Entry, done: number[], current: number): TaskProgressView {
    const { task, totals } = entry
    return {
      icon: task.icon,
      title: task.title,
      unit: task.unit ?? '건',
      steps: task.steps.map((step, index) => ({
        label: step.label,
        sub: step.sub,
        state: index < current || done[index]! >= totals[index]! ? 'done' : index === current ? 'run' : 'wait',
        done: done[index]!,
        total: totals[index]!,
      })),
      done: sum(done),
      total: sum(totals),
    }
  }

  /** 표시가 이미 적힌 작업들을 끝까지 돌린다. `immediate` 면 진행률이 곧바로 선다. */
  async function drive(entries: Entry[], immediate: boolean): Promise<void> {
    let shown = immediate
    let latest: TaskProgressView | null = null
    const timer = immediate
      ? null
      : setTimeout(() => {
          shown = true
          set({ progress: latest })
        }, SHOW_DELAY_MS)
    const publish = (next: TaskProgressView): void => {
      latest = next
      if (shown) set({ progress: next })
    }

    try {
      for (const entry of entries) {
        const left = await remainingOf(entry.task)
        // 처음 총수에서 지금 남은 수를 뺀 만큼이 이미 끝난 몫이다. 이어서 할 때 막대가 멈춘 자리에서 시작한다.
        const done = entry.totals.map((total, index) => Math.max(0, total - left[index]!))
        for (let index = 0; index < entry.task.steps.length; index += 1) {
          // 이어서 할 때 이미 끝난 단계는 건너뛴다.
          if (left[index] === 0) continue
          const step = entry.task.steps[index]!
          publish(view(entry, done, index))
          for (;;) {
            const processed = await step.runChunk(CHUNK)
            done[index] = Math.min(entry.totals[index]!, done[index]! + processed)
            if (processed > 0) publish(view(entry, done, index))
            if (processed < CHUNK) break
          }
        }
        await withPending((tasks) => tasks.filter((task) => task.id !== entry.task.id))
        const total = sum(entry.totals)
        if (total > 0) useToastStore.getState().showSuccess(entry.task.doneToast(total))
      }
    } catch {
      useToastStore.getState().showError('작업을 마치지 못했어요')
    } finally {
      if (timer !== null) clearTimeout(timer)
      set({ progress: null })
    }
  }

  function enqueue(job: () => Promise<void>): Promise<void> {
    const next = queue.then(async () => {
      set({ running: true })
      try {
        await job()
      } finally {
        set({ running: false })
      }
    })
    queue = next.catch(() => undefined)
    return next
  }

  return {
    progress: null,
    resume: null,
    running: false,
    checked: false,

    run(tasks, options) {
      return enqueue(async () => {
        const entries: Entry[] = []
        for (const task of tasks) {
          const totals = await remainingOf(task)
          if (sum(totals) > 0) entries.push({ task, totals })
        }
        if (entries.length > 0) {
          const ids = new Set(entries.map((entry) => entry.task.id))
          await withPending((pending) => [
            ...pending.filter((task) => !ids.has(task.id)),
            ...entries.map((entry) => ({ id: entry.task.id, totals: entry.totals })),
          ])
        }
        await options?.onRecorded?.()
        if (entries.length > 0) await drive(entries, false)
      })
    },

    async checkPending(find) {
      const pending = await getPendingTasks()
      const entries: Entry[] = []
      const views: TaskResumeView[] = []
      for (const record of pending) {
        const task = find(record.id)
        if (task === undefined) continue
        const left = await remainingOf(task)
        if (sum(left) === 0) continue
        const total = sum(record.totals)
        const done = Math.max(0, total - sum(left))
        entries.push({ task, totals: record.totals })
        views.push({ name: task.name, done, total, unit: task.unit ?? '건', waiting: entries.length > 1 && done === 0 })
      }
      if (entries.length !== pending.length) await setPendingTasks(entries.map((e) => ({ id: e.task.id, totals: e.totals })))
      pendingEntries = entries
      set({ resume: views.length > 0 ? views : null, checked: true })
    },

    resumePending() {
      const entries = pendingEntries
      pendingEntries = []
      // 재진행 확인은 진행률이 설 때까지 남는다(화면이 먼저 그린다). 사이에 뒤 화면이 비치지 않게 한다.
      return enqueue(async () => {
        try {
          await drive(entries, true)
        } finally {
          set({ resume: null })
        }
      })
    },
  }
})
