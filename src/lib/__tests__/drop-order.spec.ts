// 아이콘 스택은 셋만 보여준다. 이 순서가 곧 **무엇이 보이는가**다.
import valuableDropsData from '../../data/valuable-drops.json'
import type { RecordedDrop } from '../../types/drops'
import { sortDropsForDisplay } from '../drop/drop-order'

const 연출아이템 = valuableDropsData.items[0]
const 다른연출아이템 = valuableDropsData.items[1]

function 드롭(itemName: string, overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { category: 'equipment', itemName, quantity: 1, ...overrides }
}

function 값매김(itemName: string, meso: number): RecordedDrop {
  return 드롭(itemName, { priceState: 'entered', priceMeso: meso, priceShare: 1 })
}

const 이름들 = (drops: RecordedDrop[]): string[] => drops.map((drop) => drop.itemName)

it('연출이 나는 아이템이 먼저다. 값을 안 매겼어도', () => {
  const sorted = sortDropsForDisplay([값매김('평범한 것', 90_000_000_000), 드롭(연출아이템)])

  expect(이름들(sorted)).toEqual([연출아이템, '평범한 것'])
})

it('같은 무리 안에서는 비싼 순이다', () => {
  const sorted = sortDropsForDisplay([값매김('싼 것', 100), 값매김('비싼 것', 900), 값매김('중간', 500)])

  expect(이름들(sorted)).toEqual(['비싼 것', '중간', '싼 것'])
})

it('연출 아이템끼리도 비싼 순이다', () => {
  const sorted = sortDropsForDisplay([값매김(연출아이템, 100), 값매김(다른연출아이템, 900)])

  expect(이름들(sorted)).toEqual([다른연출아이템, 연출아이템])
})

// 값이 없는 것은 0 이라 뒤로 간다. 스킵과 미입력을 여기서 가르지 않는 것은 `dropPayoutMeso` 와
// 같은 규칙이다.
it('값을 안 매긴 것은 매긴 것보다 뒤다', () => {
  const sorted = sortDropsForDisplay([드롭('미입력'), 값매김('입력함', 1)])

  expect(이름들(sorted)).toEqual(['입력함', '미입력'])
})

// 분배 인원이 다르면 총액이 아니라 **내가 받은 몫**으로 견준다. 화면이 세는 값과 같아야 한다.
it('분배 인원을 나눈 몫으로 견준다', () => {
  const sorted = sortDropsForDisplay([
    드롭('4인 분배', { priceState: 'entered', priceMeso: 1_000, priceShare: 4 }),
    드롭('솔로', { priceState: 'entered', priceMeso: 400, priceShare: 1 }),
  ])

  expect(이름들(sorted)).toEqual(['솔로', '4인 분배'])
})

// 정렬이 안정적이어야 같은 목록이 매번 같게 선다.
it('견줄 것이 없으면 기록된 순서를 지킨다', () => {
  const sorted = sortDropsForDisplay([드롭('가'), 드롭('나'), 드롭('다')])

  expect(이름들(sorted)).toEqual(['가', '나', '다'])
})

// 원본을 뒤집으면 부르는 쪽의 배열이 조용히 바뀐다.
it('원본을 안 건드린다', () => {
  const drops = [값매김('싼 것', 100), 값매김('비싼 것', 900)]
  sortDropsForDisplay(drops)

  expect(이름들(drops)).toEqual(['싼 것', '비싼 것'])
})
