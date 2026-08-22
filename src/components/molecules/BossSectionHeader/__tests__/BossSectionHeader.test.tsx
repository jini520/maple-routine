// 탭이 걷히면서 «이건 월간» 을 말하는 자리가 목록 안으로 들어왔다([[ADR-164]] 결정 3). 그리고
// 그 헤더는 이름만 말하지 않는다 — 탭 조건에만 매달려 있던 `n/12`·`season` 배지가 여기로 왔다.

import { within } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { BossSectionHeader } from '../BossSectionHeader'

describe('BossSectionHeader ([[ADR-164]] 결정 3)', () => {
  it('주기를 이름으로 말한다', async () => {
    const screen = await renderAtom(<BossSectionHeader cycle="monthly" seasonState={null} clearCount={null} clearLimit={null} />)

    expect(screen.getByText('월간')).toBeTruthy()
    expect(screen.getByTestId('boss-section-header-monthly')).toBeTruthy()
  })

  // 12 는 게임이 주 단위로 강제하는 한도다([[ADR-055]] 결정 8) — 탭이 없어져도 그 수치는 «주간
  // 것» 으로 읽혀야 하고, 이 헤더가 그 소속을 말한다.
  it('주간 헤더는 n/12 와 season 배지를 함께 싣는다', async () => {
    const screen = await renderAtom(<BossSectionHeader cycle="weekly" seasonState="complete" clearCount={3} clearLimit={12} />)

    const header = screen.getByTestId('boss-section-header-weekly')
    expect(within(header).getByText('주간')).toBeTruthy()
    expect(within(header).getByText('3/12')).toBeTruthy()
    expect(within(header).getByText('season 완료')).toBeTruthy()
  })

  it('season 미완료는 그렇게 말한다', async () => {
    const screen = await renderAtom(<BossSectionHeader cycle="weekly" seasonState="incomplete" clearCount={null} clearLimit={null} />)

    expect(screen.getByText('season 미완료')).toBeTruthy()
  })

  // 한도를 아직 모르는 캐릭터(캐시 없음)는 `null` 이다 — 0/0 으로 단정하지 않는다.
  it('한도를 모르면 배지를 안 그린다', async () => {
    const screen = await renderAtom(<BossSectionHeader cycle="weekly" seasonState={null} clearCount={null} clearLimit={null} />)

    expect(screen.queryByText('/12')).toBeNull()
    expect(screen.queryByText(/season/)).toBeNull()
  })
})
