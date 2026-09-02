// 화면이 **저 탭으로 가고 싶다** 고 말하는 자리 —.
//
// 층이 스택이 되면서 탭으로 가는 이동이 **두 단 중첩**이 됐다(`Main` → 층 화면 → 페이지).
// 그 모양을 화면마다 손으로 적으면 층 표가 화면 수만큼 복제되고, 구조를 바꿀 때 전부 함께
// 움직여야 한다. 이 함수 하나가 그 번역을 든다.

import { tabNavigateArgs } from '../tab-navigate'

describe('tabNavigateArgs — 탭 이름을 중첩 이동으로 옮긴다', () => {
  it('하위 페이지는 그 그룹의 층 화면을 거친다', () => {
    expect(tabNavigateArgs('Profit')).toEqual([
      'Main',
      { screen: 'LedgerSubs', params: { screen: 'Profit' } },
    ])
    expect(tabNavigateArgs('BossManage')).toEqual([
      'Main',
      { screen: 'ScheduleSubs', params: { screen: 'BossManage' } },
    ])
  })

  it('그룹 층 페이지는 그룹 층을 거친다', () => {
    expect(tabNavigateArgs('Settings')).toEqual([
      'Main',
      { screen: 'Groups', params: { screen: 'Settings' } },
    ])
  })

  // 웹의 `?openPicker=1` 자리 — 파라미터는 **가장 안쪽 화면**에 붙어야 한다.
  // 한 단 위에 붙이면 층 화면이 그것을 받고 정작 설정 화면은 못 본다.
  it('파라미터는 가장 안쪽 화면에 붙는다', () => {
    expect(tabNavigateArgs('Settings', { openPicker: true })).toEqual([
      'Main',
      { screen: 'Groups', params: { screen: 'Settings', params: { openPicker: true } } },
    ])
  })

  it('파라미터가 없으면 그 자리를 만들지 않는다', () => {
    const [, params] = tabNavigateArgs('Content')

    expect(params.params).toEqual({ screen: 'Content' })
    expect('params' in params.params).toBe(false)
  })
})
