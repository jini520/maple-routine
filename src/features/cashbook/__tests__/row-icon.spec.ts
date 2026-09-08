// 줄 표식을 고르는 열쇠.
//
// **화면 글자로 고르면 안 된다.** 손입력 줄에 적히는 것은 `item ?? category` 라 사용자가 항목
// 이름을 적으면 그것이 뜨고, 갈래 이름은 비었을 때만 선다. 보이는 글자로 그림을 찾으면 이름을
// 적은 줄에서만 그림이 사라진다.
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import type { DayRecord } from '../records'
import { recordIconKeyOf } from '../row-icon'

const income = (over: Partial<IncomeRecord> = {}): DayRecord => ({
  kind: 'income',
  characterName: '',
  record: {
    id: 'i',
    ocid: null,
    earnedOn: '2026-09-05',
    category: '사냥',
    item: null,
    ...over,
  } as IncomeRecord,
})

const spend = (over: Partial<SpendRecord> = {}): DayRecord => ({
  kind: 'spend',
  characterName: '',
  record: {
    id: 's',
    ocid: null,
    spentOn: '2026-09-05',
    category: '버프',
    item: null,
    ...over,
  } as SpendRecord,
})

describe('recordIconKeyOf', () => {
  it('보스 결정석 줄', () => {
    expect(
      recordIconKeyOf({
        kind: 'bossCrystal',
        characterName: '낟낟',
        ocid: 'o',
        payoutMeso: 1,
        count: 1,
        bosses: [],
      } as unknown as DayRecord),
    ).toBe('보스 결정석')
  })

  it('강화 줄은 갈래가 곧 열쇠다', () => {
    expect(
      recordIconKeyOf({
        kind: 'enhancement',
        characterName: '낟낟',
        category: '큐브 재설정',
        payoutMeso: 1,
        count: 1,
        items: [],
      } as unknown as DayRecord),
    ).toBe('큐브 재설정')
  })

  it('손입력 줄은 이름을 적어도 갈래로 잡는다', () => {
    expect(recordIconKeyOf(spend({ item: '세이람의 영약 3개' }))).toBe('버프')
    expect(recordIconKeyOf(income({ item: '아무거나' }))).toBe('사냥')
  })

  // 그림이 없는 갈래도 열쇠는 낸다. 무엇을 그릴지는 조회표가 정하므로, 나중에 그림을 붙일 때
  // 고치는 것이 표 한 줄이지 이 함수가 아니다.
  it('그림이 없는 갈래도 열쇠는 낸다', () => {
    expect(
      recordIconKeyOf({
        kind: 'dropSale',
        characterName: '낟낟',
        ocid: 'o',
        payoutMeso: 1,
        count: 1,
        unpricedCount: 0,
      } as unknown as DayRecord),
    ).toBe('아이템 판매')
    expect(recordIconKeyOf(spend({ category: '컨텐츠' }))).toBe('컨텐츠')
  })
})
