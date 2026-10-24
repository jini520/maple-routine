// 빠른 이동 구성을 다루는 순수 함수. 이 파일이 지키는 것 셋.
// ① 저장된 값이 깨졌거나 옛 화면 id 를 들고 있어도 위젯이 칸을 넘치거나 없는 화면을 그리지 않는다
// ② `한 줄` 로 바꾸면 트레이 차례로 여섯 번째부터 빠진다
// ③ 칸이 다 차면 더 고를 수 없다
import {
  DEFAULT_QUICK_LINKS,
  QUICK_LINK_GROUPS,
  capacityOf,
  parseQuickLinks,
  toggleQuickLink,
  withRows,
} from '../config'
import type { QuickLinksConfig } from '../../../types/quick-links'

const 열개: QuickLinksConfig = {
  rows: 2,
  ids: ['profit', 'stats', 'boss-manage', 'item-split', 'app-settings', 'boss', 'cashbook', 'content', 'utility', 'notices'],
}

describe('parseQuickLinks: 저장된 값을 위젯이 그릴 수 있는 구성으로 읽는다', () => {
  it('모르는 id 와 겹친 id 를 빼고 차례는 지킨다', () => {
    expect(parseQuickLinks({ rows: 1, ids: ['stats', 'drop-history', 'profit', 'stats'] })).toEqual({
      rows: 1,
      ids: ['stats', 'profit'],
    })
  })

  it('줄 수보다 많이 들고 있으면 앞에서부터 칸 수만큼만 남긴다', () => {
    expect(parseQuickLinks({ rows: 1, ids: 열개.ids })?.ids).toEqual(열개.ids.slice(0, 5))
  })

  it.each([
    ['줄 수가 1 · 2 가 아니면', { rows: 3, ids: ['profit'] }],
    ['ids 가 배열이 아니면', { rows: 1, ids: 'profit' }],
    ['남는 화면이 없으면', { rows: 1, ids: ['drop-history'] }],
    ['객체가 아니면', '{깨진'],
  ])('%s null 이다. 스토어가 기본 구성으로 바꾼다', (_, raw) => {
    expect(parseQuickLinks(raw)).toBeNull()
  })
})

describe('withRows: 줄 수를 바꾼다', () => {
  it('두 줄에서 한 줄로 바꾸면 여섯 번째부터 뺀다', () => {
    expect(withRows(열개, 1)).toEqual({ rows: 1, ids: 열개.ids.slice(0, 5) })
  })

  it('한 줄에서 두 줄로 바꾸면 고른 것을 그대로 두고 칸만 늘린다', () => {
    const 한줄 = withRows(열개, 1)
    expect(withRows(한줄, 2)).toEqual({ rows: 2, ids: 한줄.ids })
    expect(capacityOf(2)).toBe(10)
  })
})

describe('toggleQuickLink: 본문 타일을 누른다', () => {
  it('고른 것을 누르면 빼고 나머지 차례는 그대로다', () => {
    expect(toggleQuickLink(DEFAULT_QUICK_LINKS, 'boss-manage').ids).toEqual(['profit', 'stats', 'item-split', 'app-settings'])
  })

  it('칸이 다 찼으면 새 화면을 누르게 둬도 구성이 바뀌지 않는다', () => {
    expect(toggleQuickLink(DEFAULT_QUICK_LINKS, 'boss')).toBe(DEFAULT_QUICK_LINKS)
  })

  it('남는 칸이 있으면 맨 끝에 붙인다', () => {
    const 넷 = toggleQuickLink(DEFAULT_QUICK_LINKS, 'stats')
    expect(toggleQuickLink(넷, 'boss').ids).toEqual(['profit', 'boss-manage', 'item-split', 'app-settings', 'boss'])
  })
})

describe('목록', () => {
  // 묶음 표에서 빠진 화면은 편집 시트에 타일이 없어 다시 고를 길이 없다.
  it('기본 구성의 화면이 모두 묶음 표에 있고, 묶음 표에 같은 화면이 두 번 나오지 않는다', () => {
    const 표 = QUICK_LINK_GROUPS.flatMap((group) => group.ids)
    expect(new Set(표).size).toBe(표.length)
    expect(DEFAULT_QUICK_LINKS.ids.every((id) => 표.includes(id))).toBe(true)
    expect(DEFAULT_QUICK_LINKS.ids).toHaveLength(capacityOf(DEFAULT_QUICK_LINKS.rows))
  })
})
