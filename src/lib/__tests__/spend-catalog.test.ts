// 지출 참조표를 **읽는 쪽**([[ADR-166]] · [[ADR-170]]).
//
// 파일의 **형태**는 `data/__tests__/spend-catalog.spec.ts` 가 붙든다(사용자가 준 값 그대로인가).
// 여기서 보는 것은 «화면이 그 값을 어떻게 집어 오는가» 다 — 갈래별 묶음과 환산 둘.
import {
  SPEND_TARIFF_PERCENT,
  findSpendChoice,
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

  // **단계가 여럿인 항목은 대표 하나로 접힌다**(사용자 지정 2026-08-25) — 목록에 여섯이 서면
  // 그 여섯이 실은 셋 × 두 단계라는 사실이 화면에서 사라진다.
  it('같은 대표는 한 칸으로 접힌다 — 여섯이 셋이 된다', () => {
    const [first] = spendGroupsOf('컨텐츠')

    expect(first.choices.map((choice) => choice.label)).toEqual([
      '하이마운틴',
      '앵글러 컴퍼니',
      '악몽선경',
    ])
  })

  it('접힌 칸이 자기 단계들을 그대로 든다', () => {
    const [first] = spendGroupsOf('컨텐츠')

    expect(first.choices[0].items.map((item) => item.tier)).toEqual(['1단계', '2단계'])
    expect(first.choices[0].items.map((item) => item.unitPrice)).toEqual([7_500, 30_000])
  })

  it('단계가 없는 항목은 자기 이름이 곧 칸 이름이다', () => {
    const [, monsterPark] = spendGroupsOf('컨텐츠')

    expect(monsterPark.choices.map((choice) => choice.label)).toEqual(['몬스터 파크'])
    expect(monsterPark.choices[0].items).toHaveLength(1)
  })

  it('갈래 셋이 스물넷을 나눠 갖는다 — 접혀도 항목 수는 그대로다', () => {
    const counted = ['컨텐츠', '이벤트·BM', '버프'].map((category) =>
      spendGroupsOf(category as '컨텐츠').reduce(
        (sum, group) => sum + group.choices.reduce((n, choice) => n + choice.items.length, 0),
        0,
      ),
    )

    // 보약 버프 둘이 「버프」 에서 「이벤트·BM」 으로 옮겨갔다([[ADR-166]] 정정 4).
    expect(counted).toEqual([10, 10, 4])
    expect(counted.reduce((sum, count) => sum + count, 0)).toBe(24)
  })

  // 직접 입력 둘은 목록이 없다([[ADR-166]] 정정 1 ②) — 빈 배열이지 예외가 아니다.
  it('직접 입력 갈래는 묶음이 없다', () => {
    expect(spendGroupsOf('아이템 구매')).toEqual([])
    expect(spendGroupsOf('기타')).toEqual([])
  })

  /**
   * **「버프」 는 이제 메소뿐**이다([[ADR-166]] 정정 4, 사용자 지정 2026-08-27) — 메포짜리 보약 둘이
   * 「이벤트·BM」 으로 옮겨가고 영약 넷만 남았다.
   *
   * 통화가 둘인 목록 갈래는 이제 「이벤트·BM」 이다 — 그 갈래 안에서도 항목이 통화를 안다는
   * 계약([[ADR-166]] 결정 1)이 그대로 서 있는지를 여기서 본다.
   */
  it('갈래 안에서 통화가 갈리는 자리가 있다 — 항목이 안다', () => {
    const 버프 = new Set(
      spendGroupsOf('버프').flatMap((group) =>
        group.choices.flatMap((choice) => choice.items.map((item) => item.currency)),
      ),
    )
    expect(버프).toEqual(new Set(['meso']))

    const 이벤트 = new Set(
      spendGroupsOf('이벤트·BM').flatMap((group) =>
        group.choices.flatMap((choice) => choice.items.map((item) => item.currency)),
      ),
    )
    expect(이벤트).toEqual(new Set(['point']))
  })

  // 사용자가 적어 준 묶음 차례 그대로다 — 앱이 다시 묶지도, 정렬하지도 않는다([[ADR-166]] 정정 1 ②).
  it('이벤트·BM 의 묶음 넷이 지정한 차례로 선다', () => {
    expect(spendGroupsOf('이벤트·BM').map((group) => group.group)).toEqual([
      '메이플 포인트 샵',
      '이벤트',
      'VIP 사우나',
      '기타',
    ])
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


// [[ADR-171]] 결정 2 — 적어 둔 기록으로 시트를 되채우려면 **이름에서 자리를 되짚어야** 한다.
describe('findSpendChoice — 이름으로 대표와 단계를 되짚는다', () => {
  it('단계가 있는 항목은 대표와 그 단계를 함께 준다', () => {
    const found = findSpendChoice('컨텐츠', '하이마운틴 2단계')

    expect(found?.choice.label).toBe('하이마운틴')
    expect(found?.item.tier).toBe('2단계')
  })

  it('단계가 없는 항목은 대표 안에 하나뿐이다', () => {
    const found = findSpendChoice('컨텐츠', '몬스터 파크')

    expect(found?.choice.items).toHaveLength(1)
    expect(found?.item.name).toBe('몬스터 파크')
  })

  // 카탈로그가 바뀌어 못 찾는 이름이 생길 수 있다 — 그때 시트가 안 열리면 안 된다
  // ([[ADR-171]] 대가). 못 찾음을 **값으로** 돌려주고 화면이 정한다.
  it('없는 이름은 null 이다', () => {
    expect(findSpendChoice('컨텐츠', '없어진 항목')).toBeNull()
    expect(findSpendChoice('컨텐츠', null)).toBeNull()
  })

  // 갈래를 잘못 대면 못 찾는다 — 이름만으로 찾으면 «버프의 영약» 이 «컨텐츠» 로 되살아난다.
  it('갈래가 다르면 못 찾는다', () => {
    expect(findSpendChoice('버프', '몬스터 파크')).toBeNull()
  })
})
