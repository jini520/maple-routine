import { MAX_SHARES_TOTAL, isEvenShares, shareAt, withSharesTotal } from '../share-geometry'

describe('shareAt: 가로 위치가 가리키는 비율', () => {
  it('가장 가까운 눈금으로 붙는다', () => {
    expect(shareAt(100, 300, 3)).toBe(1)
    expect(shareAt(200, 300, 3)).toBe(2)
    expect(shareAt(300, 300, 3)).toBe(3)
  })

  // 0 은 이 몫을 하나도 안 갖는 약속이다. 결정석을 다 넘기고 아이템만 갖는 파티가 있다.
  it('왼쪽 끝은 0 이다', () => {
    expect(shareAt(0, 300, 3)).toBe(0)
    expect(shareAt(40, 300, 3)).toBe(0)
  })

  // 눈금이 칸 경계에 서므로 끝 눈금의 자리는 반 칸이다.
  it('눈금 사이의 반을 넘으면 다음 눈금이다', () => {
    expect(shareAt(49, 300, 3)).toBe(0)
    expect(shareAt(51, 300, 3)).toBe(1)
  })

  it('트랙 밖은 끝 눈금이다. 손가락이 넘어가도 값이 튀지 않는다', () => {
    expect(shareAt(-50, 300, 3)).toBe(0)
    expect(shareAt(999, 300, 3)).toBe(3)
  })

  // 첫 렌더는 폭을 모른다. 0 으로 나누면 NaN 이 값으로 들어간다.
  it('폭을 아직 모르면 0 이다', () => {
    expect(shareAt(100, 0, 3)).toBe(0)
  })
})

describe('withSharesTotal: 합을 바꾼 뒤', () => {
  // 안 맞추면 내 비율이 합보다 커져 내 몫이 100%를 넘는다.
  it('내 비율이 합을 넘으면 합까지 내린다', () => {
    expect(withSharesTotal({ myShare: 5, sharesTotal: 6 }, 3)).toEqual({ myShare: 3, sharesTotal: 3 })
  })

  it('넘지 않으면 내 비율은 그대로다', () => {
    expect(withSharesTotal({ myShare: 2, sharesTotal: 6 }, 3)).toEqual({ myShare: 2, sharesTotal: 3 })
  })

  it('0 은 합을 바꿔도 0 이다', () => {
    expect(withSharesTotal({ myShare: 0, sharesTotal: 6 }, 3)).toEqual({ myShare: 0, sharesTotal: 3 })
  })

  it('합은 2 아래로 안 내려간다. 혼자면 나눌 것이 없다', () => {
    expect(withSharesTotal({ myShare: 1, sharesTotal: 3 }, 1).sharesTotal).toBe(2)
  })

  it('합은 상한을 안 넘는다', () => {
    expect(withSharesTotal({ myShare: 1, sharesTotal: 9 }, 99).sharesTotal).toBe(MAX_SHARES_TOTAL)
  })

  // 입력 편의에서 온 값이라 게임 규칙이 아니다. 9 에서 올렸다(사용자 지정 2026-09-23).
  it('상한은 10 이다', () => {
    expect(MAX_SHARES_TOTAL).toBe(10)
    expect(withSharesTotal({ myShare: 1, sharesTotal: 9 }, 10).sharesTotal).toBe(10)
  })
})

describe('isEvenShares: 균등인가', () => {
  it('2인 1:1 은 균등이다', () => {
    expect(isEvenShares({ myShare: 1, sharesTotal: 2 }, 2)).toBe(true)
  })

  it('2인 2:1 은 균등이 아니다', () => {
    expect(isEvenShares({ myShare: 2, sharesTotal: 3 }, 2)).toBe(false)
  })

  it('3인 2:2:2 처럼 배수로 적어도 균등이다', () => {
    expect(isEvenShares({ myShare: 2, sharesTotal: 6 }, 3)).toBe(true)
  })
})
