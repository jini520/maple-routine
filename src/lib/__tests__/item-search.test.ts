import { searchItems } from '../item-search'

const SOUL = { name: '소울 에테르 1단계' }

function names(items: readonly { name: string }[], query: string): string[] {
  return searchItems(items, query).map((item) => item.name)
}

describe('searchItems', () => {
  it.each(['르1', '소울', '울에', '에테르 ', '소에1'])('친 글자 %p 가 이름 안에 차례대로 들어 있으면 찾는다', (query) => {
    expect(names([SOUL], query)).toEqual([SOUL.name])
  })

  it('글자가 모두 들어 있어도 차례가 다르면 찾지 않는다', () => {
    expect(names([SOUL], '1소')).toEqual([])
  })

  it('띄어쓰기는 친 글자에서도 이름에서도 보지 않는다', () => {
    expect(names([SOUL], '소 울에')).toEqual([SOUL.name])
  })

  it.each(['소우', '엩', 'ㅇ'])('아직 치는 중인 마지막 글자 %p 도 맞은 것으로 본다', (query) => {
    expect(names([SOUL], query)).toEqual([SOUL.name])
  })

  it('치는 중인 글자로 보는 것은 마지막 글자뿐이다', () => {
    expect(names([SOUL], '소우에')).toEqual([])
  })

  it('아무것도 치지 않았으면 목록이 비어 있다', () => {
    expect(names([SOUL], '')).toEqual([])
    expect(names([SOUL], '  ')).toEqual([])
  })

  it('붙어서 맞은 이름이 떨어져 맞은 이름보다 위에 선다', () => {
    expect(names([{ name: '가다나' }, { name: '라가나' }], '가나')).toEqual(['라가나', '가다나'])
  })

  it('같은 무리 안에서는 친 첫 글자가 이름 앞쪽에서 맞은 것이 위에 선다', () => {
    expect(names([{ name: '라마가나' }, { name: '가나' }], '가나')).toEqual(['가나', '라마가나'])
  })

  it('맞은 자리까지 같으면 받은 목록의 차례를 그대로 둔다', () => {
    const items = [{ name: '최상급 아이템 결정' }, { name: '상급 아이템 결정' }, { name: '하급 아이템 결정' }, { name: '중급 아이템 결정' }]

    expect(names(items, '아이템 결')).toEqual(['상급 아이템 결정', '하급 아이템 결정', '중급 아이템 결정', '최상급 아이템 결정'])
  })
})
