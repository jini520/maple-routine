jest.mock('../../../storage/mvp-grades', () => ({ deleteEmptyMvpGradeRows: jest.fn() }))
jest.mock('../after-change', () => ({ afterGradeChange: jest.fn() }))

import { deleteEmptyMvpGradeRows } from '../../../storage/mvp-grades'
import { afterGradeChange } from '../after-change'
import { dropEmptyMvpGradeRows } from '../empty-rows'

const m = (fn: unknown) => fn as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('옛 판이 남긴 등급 빈 줄 지우기', () => {
  it('지운 줄이 있으면 자동 수수료를 다시 계산한다', async () => {
    m(deleteEmptyMvpGradeRows).mockResolvedValue(2)

    await dropEmptyMvpGradeRows()

    expect(afterGradeChange).toHaveBeenCalledTimes(1)
  })

  it('지운 줄이 없으면 다시 계산하지 않는다', async () => {
    m(deleteEmptyMvpGradeRows).mockResolvedValue(0)

    await dropEmptyMvpGradeRows()

    expect(afterGradeChange).not.toHaveBeenCalled()
  })
})
