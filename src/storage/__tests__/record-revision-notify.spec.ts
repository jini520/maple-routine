// 기록 표의 판 알림은 반복이 끝날 때 표마다 한 번이다. 반복은 알림을 `Set` 으로 모으므로, 표가 판을 올릴 때마다 함수를 새로
// 만들어 넘기면 같은 알림으로 알아보지 못해 쓰기 수만큼 나간다. 아이폰에서 같은 달 읽기가 897번 돈 원인이다(#1026).
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

import { notifyEnhancementTotalsChanged, subscribeEnhancementTotalsRevision } from '../enhancement-totals'
import { bumpIncomeRecordsRevision, subscribeIncomeRecordsRevision } from '../income'
import { batchRecordWrites } from '../record-revision-batch'
import { bumpSpendRecordsRevision, subscribeSpendRecordsRevision } from '../spend'

const STORAGE = join(__dirname, '..')

describe('기록 표의 판 알림', () => {
  it.each([
    ['수입', subscribeIncomeRecordsRevision, bumpIncomeRecordsRevision],
    ['지출', subscribeSpendRecordsRevision, bumpSpendRecordsRevision],
    ['강화 합계', subscribeEnhancementTotalsRevision, notifyEnhancementTotalsChanged],
  ])('%s 표는 반복 안의 여러 쓰기에 알림을 한 번 낸다', async (_name, subscribe, bump) => {
    const listener = jest.fn()
    const unsubscribe = subscribe(listener)

    await batchRecordWrites(async () => {
      bump()
      bump()
      bump()
    })

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  // 인벤토리처럼 판을 올리는 함수가 밖에 없는 표도 같은 규칙을 지키는지 소스로 본다. 새 표가 생겨도 이 검사에 걸린다.
  it('`notifyAfterBatch` 에는 함수를 그 자리에서 만들어 넘기지 않는다', () => {
    const inline = readdirSync(STORAGE)
      .filter((name) => name.endsWith('.ts') && name !== 'record-revision-batch.ts')
      .filter((name) => /notifyAfterBatch\(\s*(\(\)\s*=>|function\b)/.test(readFileSync(join(STORAGE, name), 'utf8')))

    expect(inline).toEqual([])
  })
})
