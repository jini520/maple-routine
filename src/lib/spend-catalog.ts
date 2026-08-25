/**
 * 지출 참조표를 **읽는 자리**([[ADR-166]] · [[ADR-170]]) — 화면이 JSON 을 직접 뒤지지 않게 한다.
 *
 * 파일 자체는 [[ADR-006]] 대상이라 **사용자가 준 값 그대로**이고, 그 형태는
 * `data/__tests__/spend-catalog.spec.ts` 가 붙든다. 이 모듈은 그것을 **갈래 → 묶음 → 항목**으로
 * 집어 주고, 그 파일이 정의한 **환산 둘**(메포→메소 · 관세)을 든다.
 *
 * ## 묶음은 앱이 다시 묶지 않는다
 *
 * `category` 는 앱이 정한 축이고 `group` 은 **사용자가 적어 준 이름 그대로**다([[ADR-166]] 정정
 * 1 ②). 차례도 파일에 적힌 순서를 지킨다 — 이름순으로 정렬하면 «에픽던전 1단계 · 2단계» 처럼
 * 사용자가 의도한 순서가 깨진다.
 *
 * ## 버리는 방향
 *
 * 나눗셈 둘 다 **버린다**. 이 저장소의 돈 계산이 그렇고(`netProceedsMeso` ·
 * `boss-crystal-prices` 의 파티 분배), 게임이 어느 쪽으로 자르는지는 아직 확인 안 됐다
 * ([[ADR-166]] 열린 질문 — 1~수 메소 차이라 급하지 않다).
 */
import spendCatalog from '../data/spend-catalog.json'
import type { SpendCategory } from '../storage/spend'

export interface SpendCatalogItem {
  readonly category: string
  readonly group: string
  readonly name: string
  readonly currency: 'meso' | 'point'
  readonly unitPrice: number
  /** «가격 하나가 무엇 하나의 값인가» — 회 · 개 · 포인트 · 시간. 수량 칸의 라벨이 된다. */
  readonly unit: string
  /**
   * 이름 안에 글자로만 있던 축을 뺀 칸(사용자 지정 2026-08-25).
   *
   * `base` 는 대표 이름(「하이마운틴」), `tier` 는 그 안의 갈래(「1단계」)다. **둘이 있으면 입력이
   * 두 단계**가 된다 — 대표를 고르고 그 안에서 단계를 고른다. 없는 항목은 한 단계다.
   */
  readonly base?: string
  readonly tier?: string
  /** 같은 값을 받는 두 형태 — 「경험치」·「솔 에르다」. **가격을 안 바꾼다.** */
  readonly forms?: readonly string[]
  readonly limit?: string
  readonly note?: string
  /** 메이플 포인트 샵은 **기간 운영**이라 시즌마다 상품이 갈린다([[ADR-166]] 정정 1 ①). */
  readonly seasonal?: boolean
}

/**
 * 목록의 **한 칸** — 사용자가 1단계에서 고르는 단위다.
 *
 * `tier` 가 있는 항목들은 대표 하나로 접힌다(하이마운틴 1·2단계 → 「하이마운틴」). 그래서
 * `items` 가 둘 이상이면 **고른 뒤 한 번 더 골라야 한다**.
 */
export interface SpendCatalogChoice {
  /** 칸에 적히는 이름 — `base` 가 있으면 그것, 없으면 항목 이름 그대로다. */
  readonly label: string
  readonly items: readonly SpendCatalogItem[]
}

export interface SpendCatalogGroup {
  readonly group: string
  readonly choices: readonly SpendCatalogChoice[]
}

const ITEMS = spendCatalog.items as readonly SpendCatalogItem[]

/** 관세율 — **화면이 `* 1.1` 을 들면 게임 수치가 코드에 박히는 자리**가 된다([[ADR-006]]). */
export const SPEND_TARIFF_PERCENT = spendCatalog.tariffPercent

/** 시세의 단위 — `'pointPer100mMeso'`(1억 메소당 메포). 이름이 방향을 든다. */
export const SPEND_MARKET_RATE_UNIT = spendCatalog.marketRateUnit

const MESO_PER_RATE_UNIT = 100_000_000

/**
 * 갈래 하나의 묶음들 — **파일에 적힌 차례 그대로**다.
 *
 * 직접 입력 갈래(아이템 구매 · 기타)는 목록이 없으므로 **빈 배열**이다 — 예외가 아니라
 * «고를 것이 없다» 는 사실이고, 화면은 그 갈래에서 입력 칸을 그린다.
 */
export function spendGroupsOf(category: SpendCategory): SpendCatalogGroup[] {
  const groups: { group: string; choices: { label: string; items: SpendCatalogItem[] }[] }[] = []
  for (const item of ITEMS) {
    if (item.category !== category) continue
    const label = item.base ?? item.name

    let group = groups[groups.length - 1]
    if (group === undefined || group.group !== item.group) {
      group = { group: item.group, choices: [] }
      groups.push(group)
    }

    // **같은 `base` 는 한 칸으로 접힌다** — 1단계·2단계가 목록에 둘로 서면 사용자가 고를 것이
    // 여섯이 되고, 그 여섯이 실은 셋 × 두 단계라는 사실이 화면에서 사라진다.
    const last = group.choices[group.choices.length - 1]
    if (last !== undefined && last.label === label) {
      last.items.push(item)
      continue
    }
    group.choices.push({ label, items: [item] })
  }
  return groups
}

/**
 * 메포 → 메소. 시세의 단위가 **1억 메소당 메포**라 이것은 **나눗셈**이다([[ADR-166]] 정정 2 ④).
 *
 * ```
 * 메소 = 메포 × 100,000,000 ÷ 시세
 * ```
 *
 * 곱셈으로 짜면 결과가 **1억 배** 어긋난다 — 컬럼 이름을 `meso_per_point` 에서
 * `point_per_100m_meso` 로 고친 이유가 그것이다.
 *
 * 시세가 0 이하면 **0 을 돌려준다.** 어댑터가 저장을 막지만(`storage/spend.ts`) 화면은 입력
 * 중간에 0 을 들고 있을 수 있고, 그때 `Infinity` 가 금액 칸에 들어가면 화면이 깨진다.
 */
export function pointToMeso(pointAmount: number, pointPer100mMeso: number): number {
  if (pointPer100mMeso <= 0) return 0
  return Math.floor((pointAmount * MESO_PER_RATE_UNIT) / pointPer100mMeso)
}

/**
 * 구입가에 붙는 관세(메소). **시세를 안 물어도 된다** — 관세가 «메소 가치 기준 10%» 라
 * 메소마켓 시세가 양변에서 상쇄된다([[ADR-166]] 정정 2 ②).
 */
export function tariffMesoOf(priceMeso: number): number {
  return Math.floor((priceMeso * SPEND_TARIFF_PERCENT) / 100)
}

/**
 * 저장에 들어갈 **두 값** — 총액과 그중 관세분([[ADR-166]] 정정 2 ②).
 *
 * 총액을 함께 내는 이유는 집계가 `meso_amount` 한 칸만 보면 되게 하기 위해서다(«관세를 빠뜨려
 * 덜 세는» 사고가 구조적으로 없어진다). 관세분을 따로 박는 이유는 요율이 바뀌는 날 **지난달
 * 관세가 소급해 달라지지 않게** 하기 위해서다([[ADR-069]] 결정 1 과 같은 이유).
 *
 * 더해서 만들고 빼서 되돌릴 수 있다 — `mesoAmount - tariffMeso === priceMeso` 가 언제나 참이다.
 */
export function withTariffMeso(priceMeso: number): { mesoAmount: number; tariffMeso: number } {
  const tariffMeso = tariffMesoOf(priceMeso)
  return { mesoAmount: priceMeso + tariffMeso, tariffMeso }
}
