/**
 * 이어서 하는 작업의 러너. 작업은 가짜(남은 일을 세는 숫자 둘)이고 표시는 가짜 preferences 에 적힌다.
 */
jest.mock('../../toast/store', () => ({
  useToastStore: { getState: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }) },
}))

var mockShowSuccess: jest.Mock
var mockShowError: jest.Mock
mockShowSuccess = jest.fn()
mockShowError = jest.fn()

import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getPendingTasks, setPendingTasks } from '../../../storage/pending-tasks'
import type { ResumableTask } from '../task'
import { useTaskRunnerStore } from '../store'

/** 남은 일이 단계마다 숫자 하나인 작업. `runChunk` 는 그 수를 줄인다. */
function 작업(id: string, left: number[], options: { failAt?: number; gate?: Promise<void> } = {}) {
  const state = { left: [...left], chunks: 0 }
  const task: ResumableTask = {
    id,
    name: `${id} 작업`,
    title: `${id} 하고 있어요`,
    icon: 'crown',
    steps: left.map((_, index) => ({
      label: `단계 ${index + 1}`,
      remaining: async () => state.left[index]!,
      runChunk: async (limit: number) => {
        if (options.gate !== undefined) await options.gate
        state.chunks += 1
        if (options.failAt === state.chunks) throw new Error('저장소 오류')
        const done = Math.min(limit, state.left[index]!)
        state.left[index]! -= done
        return done
      },
    })),
    doneToast: (count) => `${id} ${count}건 끝`,
  }
  return { task, state }
}

const find = (tasks: ResumableTask[]) => (id: string) => tasks.find((task) => task.id === id)

beforeEach(() => {
  jest.clearAllMocks()
  installFakePreferences()
  useTaskRunnerStore.setState({ progress: null, resume: null, running: false, checked: false })
})

describe('run', () => {
  it('남은 일을 조각씩 끝까지 처리하고, 끝나면 표시를 지우고 완료 토스트를 띄운다', async () => {
    const { task, state } = 작업('a', [450, 30])

    await useTaskRunnerStore.getState().run([task])

    expect(state.left).toEqual([0, 0])
    // 450 은 200 · 200 · 50 셋, 30 은 하나
    expect(state.chunks).toBe(4)
    await expect(getPendingTasks()).resolves.toEqual([])
    expect(mockShowSuccess).toHaveBeenCalledWith('a 480건 끝')
    expect(useTaskRunnerStore.getState().running).toBe(false)
  })

  it('처리할 것이 없으면 표시도 토스트도 없다', async () => {
    const { task } = 작업('a', [0, 0])

    await useTaskRunnerStore.getState().run([task])

    expect(mockShowSuccess).not.toHaveBeenCalled()
    await expect(getPendingTasks()).resolves.toEqual([])
  })

  it('시작 전에 단계별 남은 수를 표시로 적는다', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const { task } = 작업('a', [5, 2], { gate })

    const running = useTaskRunnerStore.getState().run([task])
    await new Promise((resolve) => setImmediate(resolve))
    await expect(getPendingTasks()).resolves.toEqual([{ id: 'a', totals: [5, 2] }])

    release()
    await running
  })

  it('표시를 적은 뒤 onRecorded 를 부른다. 처리할 것이 없어도 부른다', async () => {
    const order: string[] = []
    const { task } = 작업('a', [0])

    await useTaskRunnerStore.getState().run([task], {
      onRecorded: async () => {
        order.push('recorded')
      },
    })

    expect(order).toEqual(['recorded'])
  })

  it('0.3초 안에 끝나면 진행률 모달을 안 띄운다', async () => {
    const seen: boolean[] = []
    const unsubscribe = useTaskRunnerStore.subscribe((state) => seen.push(state.progress !== null))
    const { task } = 작업('a', [3])

    await useTaskRunnerStore.getState().run([task])
    unsubscribe()

    expect(seen.some(Boolean)).toBe(false)
  })

  it('0.3초가 넘으면 진행률 모달이 서고 단계마다 상태와 건수를 보인다', async () => {
    jest.useFakeTimers()
    try {
      let release!: () => void
      const gate = new Promise<void>((resolve) => (release = resolve))
      const { task } = 작업('b', [200, 10], { gate })

      const running = useTaskRunnerStore.getState().run([task])
      await jest.advanceTimersByTimeAsync(299)
      expect(useTaskRunnerStore.getState().progress).toBeNull()
      await jest.advanceTimersByTimeAsync(1)

      expect(useTaskRunnerStore.getState().progress).toMatchObject({
        title: 'b 하고 있어요',
        done: 0,
        total: 210,
        steps: [
          { label: '단계 1', state: 'run', done: 0, total: 200 },
          { label: '단계 2', state: 'wait', done: 0, total: 10 },
        ],
      })

      release()
      await running
      expect(useTaskRunnerStore.getState().progress).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('실패하면 알리고 닫는다. 표시는 남아 다음에 이어서 한다', async () => {
    const { task, state } = 작업('a', [450], { failAt: 2 })

    await useTaskRunnerStore.getState().run([task])

    expect(mockShowError).toHaveBeenCalledWith('작업을 마치지 못했어요')
    expect(mockShowSuccess).not.toHaveBeenCalled()
    expect(state.left).toEqual([250])
    await expect(getPendingTasks()).resolves.toEqual([{ id: 'a', totals: [450] }])
    expect(useTaskRunnerStore.getState()).toMatchObject({ progress: null, running: false })
  })

  it('겹쳐 부르면 앞 작업이 끝난 뒤에 돈다', async () => {
    const order: string[] = []
    const a = 작업('a', [1])
    const b = 작업('b', [1])
    a.task.doneToast = () => {
      order.push('a')
      return 'a'
    }
    b.task.doneToast = () => {
      order.push('b')
      return 'b'
    }

    await Promise.all([useTaskRunnerStore.getState().run([a.task]), useTaskRunnerStore.getState().run([b.task])])

    expect(order).toEqual(['a', 'b'])
  })
})

describe('checkPending · resumePending', () => {
  it('남은 일이 있는 표시로 재진행 확인을 세운다. 뒤에 기다리는 작업은 대기다', async () => {
    const a = 작업('a', [0, 428])
    const b = 작업('b', [380])
    await setPendingTasks([
      { id: 'a', totals: [620, 620] },
      { id: 'b', totals: [380] },
    ])

    await useTaskRunnerStore.getState().checkPending(find([a.task, b.task]))

    expect(useTaskRunnerStore.getState().resume).toEqual([
      { name: 'a 작업', done: 812, total: 1240, unit: '건', waiting: false },
      { name: 'b 작업', done: 0, total: 380, unit: '건', waiting: true },
    ])
    expect(useTaskRunnerStore.getState().checked).toBe(true)
  })

  it('남은 일이 0 이거나 모르는 작업의 표시는 묻지 않고 지운다', async () => {
    const a = 작업('a', [0])
    await setPendingTasks([
      { id: 'a', totals: [10] },
      { id: 'gone', totals: [3] },
    ])

    await useTaskRunnerStore.getState().checkPending(find([a.task]))

    expect(useTaskRunnerStore.getState().resume).toBeNull()
    await expect(getPendingTasks()).resolves.toEqual([])
  })

  it('이어서 진행하면 곧바로 진행률이 서고, 처음 총수로 이어서 센다', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const a = 작업('a', [0, 428], { gate })
    await setPendingTasks([{ id: 'a', totals: [620, 620] }])
    await useTaskRunnerStore.getState().checkPending(find([a.task]))

    const running = useTaskRunnerStore.getState().resumePending()
    await new Promise((resolve) => setImmediate(resolve))

    expect(useTaskRunnerStore.getState().progress).toMatchObject({
      done: 812,
      total: 1240,
      steps: [
        { state: 'done', done: 620, total: 620 },
        { state: 'run', done: 192, total: 620 },
      ],
    })

    release()
    await running
    expect(useTaskRunnerStore.getState().resume).toBeNull()
    expect(mockShowSuccess).toHaveBeenCalledWith('a 1240건 끝')
    await expect(getPendingTasks()).resolves.toEqual([])
  })
})
