import { installFakePreferences } from './fake-preferences'
import { getPendingTasks, setPendingTasks } from '../pending-tasks'
import { preferences } from '../ports'
import { STORAGE_KEYS } from '../keys'

beforeEach(() => {
  installFakePreferences()
})

describe('끝나지 않은 작업 표시', () => {
  it('없으면 빈 목록이다', async () => {
    await expect(getPendingTasks()).resolves.toEqual([])
  })

  it('적은 차례 그대로 되읽는다', async () => {
    const tasks = [
      { id: 'mvp-bulk-fee', totals: [620, 620] },
      { id: 'mvp-recalc-fee', totals: [3, 0, 1] },
    ]
    await setPendingTasks(tasks)

    await expect(getPendingTasks()).resolves.toEqual(tasks)
  })

  it('빈 목록을 적으면 키를 지운다', async () => {
    await setPendingTasks([{ id: 'mvp-bulk-fee', totals: [1] }])
    await setPendingTasks([])

    await expect(preferences.get(STORAGE_KEYS.pendingTasks)).resolves.toBeNull()
  })

  it('깨진 값은 빈 목록으로 읽는다', async () => {
    await preferences.set(STORAGE_KEYS.pendingTasks, '{not json')

    await expect(getPendingTasks()).resolves.toEqual([])
  })
})
