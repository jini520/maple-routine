// 사냥 기록을 고치거나 지울 때 확인 창을 거쳐 뒤 기록과 함께 저장하는 흐름. 계획은 저장소가 세므로 목으로 준다.
import { act } from '@testing-library/react-native'

import { FragmentCutsChangedError, type FragmentCutPlan } from '../../../storage/fragment-cuts'
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import { saveHuntWithCuts, useFragmentCutsPrompt } from '../fragment-cuts'

jest.mock('../../../storage/income', () => ({
  previewIncomeCuts: jest.fn(),
  updateIncomeRecord: jest.fn(),
  deleteIncomeRecord: jest.fn(),
}))

jest.mock('../records', () => ({
  loadHexaCandidatesOf: jest.fn(async () => (ocid: string) => [ocid]),
  loadHexaOwnerOf: jest.fn(async () => () => null),
  namesByOcid: jest.fn(async () => new Map([['a', '단풍소녀']])),
  recordCardOf: jest.fn((entry: { record: { id: string } }) => ({ title: '제목', detail: `이름 ${entry.record.id}` })),
}))

const storage = jest.requireMock<{
  previewIncomeCuts: jest.Mock
  updateIncomeRecord: jest.Mock
  deleteIncomeRecord: jest.Mock
}>('../../../storage/income')

const 사냥 = {
  id: 'hunt-17',
  ocid: 'a',
  earnedOn: '2026-09-17',
  category: 'hunting',
  hunt: { mode: 'manual', typedMeso: 0, fragments: 100, fragmentPrice: null },
} as IncomeRecord
const 고친사냥 = { ...사냥, hunt: { mode: 'manual', typedMeso: 0, fragments: 0, fragmentPrice: null } } as IncomeRecord

const 정산 = { id: 'settle-18', ocid: 'a', earnedOn: '2026-09-18', quantity: 20, mesoAmount: 133_000_000 } as IncomeRecord

function 헥사(uses: { ocid: string; fragments: number }[], price: number | null): SpendRecord {
  return {
    id: 'hexa-20',
    ocid: 'a',
    spentOn: '2026-09-20',
    category: 'hexa_matrix',
    item: null,
    itemKey: '헥사 스탯 Ⅰ',
    formItemKeys: null,
    itemKind: null,
    levelFrom: null,
    levelTo: null,
    quantity: null,
    mesoAmount: 0,
    tariffMeso: null,
    pointAmount: null,
    pointPer100mMeso: null,
    mesoMarketFeePercent: null,
    cashAmount: null,
    recordedAt: '2026-09-20T02:00:00.000Z',
    hexa: {
      fragmentCount: 60,
      untradableFragmentCount: 0,
      fragmentPrice: price,
      activation: true,
      useStorage: true,
      storageAsSpend: false,
      storageUses: uses,
    },
  }
}

/** 정산을 지우고, 가격 없이 저장된 헥사의 보관 사용을 0 으로 줄이는 계획. */
const 보이는계획: FragmentCutPlan = {
  changes: [
    { kind: 'settle', before: 정산, after: null },
    { kind: 'hexa', before: 헥사([{ ocid: 'a', fragments: 60 }], null), after: 헥사([], null) },
  ],
  key: 'visible',
}

/** 다른 캐릭터의 보관으로 옮겼을 뿐인 계획. 보관에서 가져온 개수와 금액이 그대로다. */
const 옮기기만: FragmentCutPlan = {
  changes: [{ kind: 'hexa', before: 헥사([{ ocid: 'a', fragments: 60 }], 1), after: 헥사([{ ocid: 'b', fragments: 60 }], 1) }],
  key: 'moved',
}

/** 띄운 확인 창에 답한다. 창이 뜰 때까지 기다린다. */
async function 답하기(prices: Record<string, number> | null): Promise<void> {
  await act(async () => {})
  const prompt = useFragmentCutsPrompt.getState().prompt
  if (prompt === null) throw new Error('확인 창이 안 떴다')
  prompt.answer(prices)
}

beforeEach(() => {
  storage.previewIncomeCuts.mockReset()
  storage.updateIncomeRecord.mockReset().mockResolvedValue(undefined)
  storage.deleteIncomeRecord.mockReset().mockResolvedValue(undefined)
  useFragmentCutsPrompt.setState({ prompt: null })
})

describe('saveHuntWithCuts: 확인 창을 거쳐 함께 저장한다', () => {
  // 바뀌는 것이 어느 캐릭터의 보관을 썼는지뿐이면 화면에 보이는 것이 안 바뀐다. 물을 것이 없다.
  it('다른 캐릭터 보관으로 모두 채워지면 창 없이 그 계획으로 저장한다', async () => {
    storage.previewIncomeCuts.mockResolvedValue(옮기기만)

    await expect(saveHuntWithCuts(사냥, { kind: 'edit', record: 고친사냥 })).resolves.toBe(true)

    expect(useFragmentCutsPrompt.getState().prompt).toBeNull()
    expect(storage.updateIncomeRecord).toHaveBeenCalledWith(고친사냥, expect.objectContaining({ key: 'moved', prices: {} }))
  })

  it('바뀌는 기록을 줄로 보이고, 받은 가격과 계획의 열쇠로 저장한다', async () => {
    storage.previewIncomeCuts.mockResolvedValue(보이는계획)

    const saved = saveHuntWithCuts(사냥, { kind: 'remove', id: 'hunt-17' })
    await act(async () => {})
    const rows = useFragmentCutsPrompt.getState().prompt?.preview.rows
    expect(rows).toEqual([
      expect.objectContaining({ id: 'settle-18', sub: '9월 18일 · 단풍소녀', fragmentsBefore: 20, fragmentsAfter: 0, removed: true, mesoAfter: 0 }),
      expect.objectContaining({ id: 'hexa-20', fragmentsBefore: 60, fragmentsAfter: 0, mesoAfter: null, pricedFragments: 60 }),
    ])
    await 답하기({ 'hexa-20': 0 })

    await expect(saved).resolves.toBe(true)
    expect(storage.deleteIncomeRecord).toHaveBeenCalledWith('hunt-17', expect.objectContaining({ key: 'visible', prices: { 'hexa-20': 0 } }))
  })

  it('취소하면 아무것도 쓰지 않는다', async () => {
    storage.previewIncomeCuts.mockResolvedValue(보이는계획)

    const saved = saveHuntWithCuts(사냥, { kind: 'edit', record: 고친사냥 })
    await 답하기(null)

    await expect(saved).resolves.toBe(false)
    expect(storage.updateIncomeRecord).not.toHaveBeenCalled()
    expect(useFragmentCutsPrompt.getState().prompt).toBeNull()
  })

  // 사용자가 본 것과 다른 기록이 바뀌면 안 된다. 다시 세서 창을 다시 띄운다.
  it('창을 띄운 뒤 계획이 달라졌으면 다시 세서 창을 다시 띄운다', async () => {
    storage.previewIncomeCuts.mockResolvedValueOnce(보이는계획).mockResolvedValueOnce({ ...보이는계획, key: 'again' })
    storage.updateIncomeRecord.mockRejectedValueOnce(new FragmentCutsChangedError())

    const saved = saveHuntWithCuts(사냥, { kind: 'edit', record: 고친사냥 })
    await 답하기({ 'hexa-20': 1 })
    await 답하기({ 'hexa-20': 2 })

    await expect(saved).resolves.toBe(true)
    expect(storage.updateIncomeRecord).toHaveBeenLastCalledWith(고친사냥, expect.objectContaining({ key: 'again', prices: { 'hexa-20': 2 } }))
  })
})
