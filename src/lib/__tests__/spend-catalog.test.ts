// 지출 참조표를 **읽는 쪽**([[ADR-166]] · [[ADR-170]]).
//
// 파일의 **형태**는 `data/__tests__/spend-catalog.spec.ts` 가 붙든다(사용자가 준 값 그대로인가).
// 여기서 보는 것은 «화면이 그 값을 어떻게 집어 오는가» 다 — 갈래별 묶음과 환산 둘.
import {
  SPEND_TARIFF_PERCENT,
  pointToMeso,
  spendGroupsOf,
  tariffMesoOf,
  withTariffMeso,
} from '../spend-catalog'

describe('spendGroupsOf — 갈래 → 묶음들', () => {
  it('사용자가 적어 준 묶음 이름 그대로 묶는다 — 앱이 다시 묶지 않는다', () => {
    const groups = spendGroupsOf('컨텐츠')

    expect(groups.map((group) => group.group)).toEqual([
      '에픽던전 추가 리워드',
      '몬스터 파크',
      '퀵 패스',
    ])
  })

  it('묶음 안의 차례도 파일에 적힌 그대로다', () => {
    const [first] = spendGroupsOf('컨텐츠')

    expect(first.items.map((item) => item.name)).toEqual([
      '하이마운틴 1단계',
      '하이마운틴 2단계',
      '앵글러 컴퍼니 1단계',
      '앵글러 컴퍼니 2단계',
      '악몽선경 1단계',
      '악몽선경 2단계',
    ])
  })

  it('갈래 셋이 스물넷을 나눠 갖는다', () => {
    const counted = ['컨텐츠', '상점·편의', '버프'].map(
      (category) =>
        spendGroupsOf(category as '컨텐츠').reduce((sum, group) => sum + group.items.length, 0),
    )

    expect(counted).toEqual([10, 8, 6])
    expect(counted.reduce((sum, count) => sum + count, 0)).toBe(24)
  })

  // 직접 입력 둘은 목록이 없다([[ADR-166]] 정정 1 ②) — 빈 배열이지 예외가 아니다.
  it('직접 입력 갈래는 묶음이 없다', () => {
    expect(spendGroupsOf('아이템 구매')).toEqual([])
    expect(spendGroupsOf('기타')).toEqual([])
  })

  // 「버프」가 통화 둘을 갖는 유일한 목록 갈래다(영약은 메소, 보약은 메포).
  it('버프는 통화가 둘이다', () => {
    const currencies = new Set(
      spendGroupsOf('버프').flatMap((group) => group.items.map((item) => item.currency)),
    )

    expect(currencies).toEqual(new Set(['meso', 'point']))
  })
})

describe('pointToMeso — 나눗셈이다', () => {
  // 시세의 단위가 **1억 메소당 메포**라 환산은 곱셈이 아니다([[ADR-166]] 정정 2 ④).
  // 곱셈으로 짜면 결과가 **1억 배** 어긋난다.
  it('메포 × 1억 ÷ 시세', () => {
    expect(pointToMeso(30_000, 1_180)).toBe(2_542_372_881)
  })

  it('시세가 오르면 같은 메포가 더 적은 메소다', () => {
    expect(pointToMeso(1_000, 2_000)).toBeLessThan(pointToMeso(1_000, 1_000))
  })

  it('시세와 메포가 같은 배로 늘면 값이 그대로다', () => {
    expect(pointToMeso(600, 1_180)).toBe(pointToMeso(1_200, 2_360))
  })

  // 이 저장소의 돈 계산은 버림이 기본이다(`netProceedsMeso` · `perPersonMeso`).
  it('버린다 — 올리지 않는다', () => {
    expect(pointToMeso(1, 3)).toBe(33_333_333)
  })

  it('메포가 0 이면 0 이다', () => {
    expect(pointToMeso(0, 1_180)).toBe(0)
  })

  // 어댑터가 이미 막지만(`storage/spend.ts`) 여기서도 0 을 안 나눈다 — 화면이 입력 중간 상태로
  // 0 을 들고 있을 수 있고, 그때 `Infinity` 가 뜨면 금액 칸이 깨진다.
  it('시세가 0 이하면 0 이다 — Infinity 를 만들지 않는다', () => {
    expect(pointToMeso(30_000, 0)).toBe(0)
    expect(pointToMeso(30_000, -1)).toBe(0)
  })
})

describe('관세 — 구입가의 10% 고정', () => {
  it('요율은 카탈로그가 든다 — 화면이 하드코딩하지 않는다', () => {
    expect(SPEND_TARIFF_PERCENT).toBe(10)
  })

  it('구입가의 10% 다', () => {
    expect(tariffMesoOf(850_000_000)).toBe(85_000_000)
  })

  it('버린다 — `netProceedsMeso` 와 같은 방향이다', () => {
    expect(tariffMesoOf(999)).toBe(99)
  })

  // 저장은 **총액과 그 몫을 둘 다** 박는다([[ADR-166]] 정정 2 ②) — 집계가 한 칸만 보면 되도록.
  it('총액과 관세분을 함께 낸다', () => {
    expect(withTariffMeso(850_000_000)).toEqual({
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })
  })

  it('총액에서 관세분을 빼면 구입가다 — 반올림으로 어긋나지 않는다', () => {
    for (const price of [1, 999, 1_234_567, 850_000_000]) {
      const { mesoAmount, tariffMeso } = withTariffMeso(price)
      expect(mesoAmount - tariffMeso).toBe(price)
    }
  })
})
