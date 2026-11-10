// 핫픽스는 main 에서 따므로 develop 에서 쓴 번호가 그 브랜치에 보이지 않는다. 여러 출처를 함께 보는 판정이 틀리면
// 겹친 번호가 main 에 들어가고, 그때는 이미 출시한 ADR 파일의 이름을 바꿔야 한다.
import { planAdrNumber } from '../adr-number.mjs'

describe('planAdrNumber', () => {
  it('+ 로 이은 번호 목록의 뒤쪽 번호까지 세어 다음 번호를 낸다', () => {
    const plan = planAdrNumber([
      { name: 'origin/main', files: ['ADR-011+190_live-update_protocol.md', 'ADR-187_game-data_item-catalog.md'] },
    ])

    expect(plan.next).toBe(191)
  })

  it('모든 출처 중 가장 큰 번호의 다음을 내고, 그 번호가 어느 출처에 있는지 알려 준다', () => {
    const worktree = '/repo/.claude/worktrees/branch-strategy'
    const plan = planAdrNumber([
      { name: 'origin/main', files: ['ADR-187_game-data_item-catalog.md'] },
      { name: 'origin/docs/multi-account', files: ['ADR-101+186_character_multi-account.md'] },
      { name: worktree, files: ['.DS_Store', 'ADR-187_game-data_item-catalog.md', 'ADR-188_release_branches.md'] },
    ])

    expect(plan.next).toBe(189)
    expect(plan.max).toEqual({ number: 188, source: worktree })
  })

  it('카테고리_기능 이 다른 두 파일이 같은 번호를 쓰면 충돌로 낸다', () => {
    const plan = planAdrNumber([
      { name: 'origin/develop', files: ['ADR-160+189_cashbook_exclusions.md'] },
      { name: 'origin/hotfix/ota-fix', files: ['ADR-011+138+189_live-update_protocol.md'] },
    ])

    expect(plan.collisions).toEqual([
      {
        number: 189,
        files: [
          { key: 'cashbook_exclusions', sources: ['origin/develop'] },
          { key: 'live-update_protocol', sources: ['origin/hotfix/ota-fix'] },
        ],
      },
    ])
  })

  it('같은 파일의 번호 목록이 출처마다 달라도 충돌이 아니다', () => {
    const plan = planAdrNumber([
      { name: 'origin/main', files: ['ADR-011+138_live-update_protocol.md'] },
      { name: 'origin/develop', files: ['ADR-011+138+189_live-update_protocol.md'] },
    ])

    expect(plan.collisions).toEqual([])
  })
})
