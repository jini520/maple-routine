// 큰 숫자의 이름표는 **되풀이되면 안 된다**([[ADR-173]] 결정 12) — 되풀이되면 카운트업의 모듈
// 수준 기억에 걸려 지난번 값에서 굴러 내려온다.
import { nextAmountIdentity } from '../amount-identity'

describe('nextAmountIdentity', () => {
  it('부를 때마다 다른 문자열이다', () => {
    const 스물 = Array.from({ length: 20 }, nextAmountIdentity)

    expect(new Set(스물).size).toBe(20)
  })

  // 시트를 닫았다 여는 것도 «다시 부르는 것» 이다 — 마운트마다 0 으로 돌아가면 안 된다.
  it('한 방향으로만 간다 — 되돌아가지 않는다', () => {
    const 먼저 = nextAmountIdentity()
    const 나중 = nextAmountIdentity()

    expect(먼저).not.toBe(나중)
    expect(Number(나중.split('-')[2])).toBeGreaterThan(Number(먼저.split('-')[2]))
  })
})
