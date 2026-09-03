/**
 * 지출 참조표를 읽는 자리. 화면이 JSON 을 직접 안 뒤지게 하는 조회 함수들.
 *
 * 파일 자체는 게임 레퍼런스라 **사용자가 준 값 그대로**이고 형태는 테스트가 붙든다. 이 모듈은
 * 그것을 갈래 → 묶음 → 항목으로 집어 주고 환산 둘(메포→메소 · 관세)을 든다.
 *
 * **묶음을 앱이 다시 묶지 않는다.** `category` 는 앱이 정한 축이고 `group` 은 사용자가 적어 준 이름
 * 그대로다. 차례도 파일 순서를 지킨다. 이름순으로 정렬하면 `에픽던전 1단계 · 2단계` 처럼 의도한
 * 순서가 깨진다.
 *
 * 나눗셈은 둘 다 버린다. 이 저장소의 돈 계산이 그렇다.
 */
import spendCatalog from '../../data/spend-catalog.json'
import type { SpendCategory } from '../../storage/spend'

export interface SpendCatalogItem {
  readonly category: string
  readonly group: string
  readonly name: string
  readonly currency: 'meso' | 'point'
  readonly unitPrice: number
  /** 가격 하나가 무엇 하나의 값인가. 회 · 개 · 포인트 · 시간. 수량 칸의 라벨이 된다. */
  readonly unit: string
  /**
   * 이름 안에 글자로만 있던 축을 뺀 칸.
   *
   * `base` 는 대표 이름(하이마운틴), `tier` 는 그 안의 갈래(1단계)다. 둘이 있으면 입력이 두
   * 단계가 된다. 대표를 고르고 그 안에서 단계를 고른다. 없는 항목은 한 단계다.
   */
  readonly base?: string
  readonly tier?: string
  /** 같은 값을 받는 두 형태. 경험치·솔 에르다. **가격을 안 바꾼다.** */
  readonly forms?: readonly string[]
  readonly limit?: string
  /**
   * 기록 한 건의 수량 상한. `limit` 문장에서 사용자가 고른 숫자다.
   *
   * 문장을 파싱해 뽑지 않는다. 몬스터 파크의 문장은 축이 셋(월드당 14 · 캐릭터당 7 · 무료 2)이라
   * 어느 것이 한 건의 상한인지 **글에는 안 적혀 있다**. 앱이 고르면 그 고름이 추정이 된다
   * 사용자가 14 로 지정했다.
   *
   * 기간 누계가 아니다. 메이플 ID당 최대 2회 를 이틀에 걸쳐 한 번씩 적으면 기록이 둘이고 앱은
   * 그것을 합치지 않는다. 세는 것은 사람이 한다.
   */
  readonly maxQuantity?: number
  readonly note?: string
  /** 메이플 포인트 샵은 **기간 운영**이라 시즌마다 상품이 갈린다. */
  readonly seasonal?: boolean
}

/**
 * 목록의 **한 칸**. 사용자가 1단계에서 고르는 단위다.
 *
 * `tier` 가 있는 항목들은 대표 하나로 접힌다(하이마운틴 1·2단계 → 하이마운틴). 그래서
 * `items` 가 둘 이상이면 **고른 뒤 한 번 더 골라야 한다**.
 */
export interface SpendCatalogChoice {
  /** 칸에 적히는 이름. `base` 가 있으면 그것, 없으면 항목 이름 그대로다. */
  readonly label: string
  readonly items: readonly SpendCatalogItem[]
}

export interface SpendCatalogGroup {
  readonly group: string
  readonly choices: readonly SpendCatalogChoice[]
  /**
   * 지금 고를 수 있는 묶음인가.
   *
   * 기간제 이벤트(메이플 포인트 샵)는 열려 있을 때만 있는 것이고 그 사실을 카탈로그의 `groups`
   * 가 든다. 날짜로 판정하지 않는다. 이벤트가 미뤄지는 날 앱이 거짓말을 한다. 표에 없는 묶음은
   * 언제나 열린 것이다.
   *
   * 화면은 닫힌 묶음을 지우지 않고 흐리게 둔다. 자리는 남고 못 고른다. 과거 기록에는 영향이
   * 없다. 이 값은 지금 새로 고를 수 있나 일 뿐이다.
   */
  readonly active: boolean
}

const ITEMS = spendCatalog.items as readonly SpendCatalogItem[]

/** 묶음 표. 닫힌 것만 적혀 있다(없으면 열린 것이다). 사유는 `SpendCatalogGroup.active` 주석. */
const GROUPS = spendCatalog.groups as Readonly<Record<string, { readonly active: boolean }>>

/** 관세율. **화면이 `* 1.1` 을 들면 게임 수치가 코드에 박히는 자리**가 된다. */
export const SPEND_TARIFF_PERCENT = spendCatalog.tariffPercent

/** 시세의 단위. `'pointPer100mMeso'`(1억 메소당 메포). 이름이 방향을 든다. */
export const SPEND_MARKET_RATE_UNIT = spendCatalog.marketRateUnit

const MESO_PER_RATE_UNIT = 100_000_000

/**
 * 갈래 하나의 묶음들. **파일에 적힌 차례 그대로**다.
 *
 * 직접 입력 갈래(아이템 구매 · 기타)는 목록이 없으므로 **빈 배열**이다. 예외가 아니라
 * 고를 것이 없다 는 사실이고, 화면은 그 갈래에서 입력 칸을 그린다.
 */
export function spendGroupsOf(category: SpendCategory): SpendCatalogGroup[] {
  const groups: {
    group: string
    active: boolean
    choices: { label: string; items: SpendCatalogItem[] }[]
  }[] = []
  for (const item of ITEMS) {
    if (item.category !== category) continue
    const label = item.base ?? item.name

    let group = groups[groups.length - 1]
    if (group === undefined || group.group !== item.group) {
      // 표에 없는 묶음은 **열린 것**이다. 닫힘만 적는다.
      group = { group: item.group, active: GROUPS[item.group]?.active ?? true, choices: [] }
      groups.push(group)
    }

    // **같은 `base` 는 한 칸으로 접힌다**. 1단계·2단계가 목록에 둘로 서면 사용자가 고를 것이
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
 * 적어 둔 이름에서 **고르던 자리를 되짚는다**.
 *
 * 기록에는 항목 이름만 있고(하이마운틴 2단계) 시트는 **대표와 단계 둘**을 든다. 수정으로
 * 시트를 열려면 그 둘을 이름에서 되찾아야 한다.
 *
 * **갈래를 함께 받는다.** 이름만으로 찾으면 갈래가 다른 동명 항목이 걸려, 버프에서 적은 것이
 * 컨텐츠로 되살아날 수 있다.
 *
 * 못 찾으면 `null` 이다. 예외가 아니다. 카탈로그가 바뀌어 사라진 항목이 기록에는 남아 있을 수
 * 있고, 그때 **시트가 안 열리는 것보다 값만 채워 여는 편이 낫다**(대가).
 */
export function findSpendChoice(
  category: SpendCategory,
  itemName: string | null,
): { choice: SpendCatalogChoice; item: SpendCatalogItem } | null {
  if (itemName === null) return null
  for (const group of spendGroupsOf(category)) {
    for (const choice of group.choices) {
      const item = choice.items.find((each) => each.name === itemName)
      if (item !== undefined) return { choice, item }
    }
  }
  return null
}

/**
 * 메포 → 메소. 시세의 단위가 **1억 메소당 메포**라 이것은 **나눗셈**이다.
 *
 * ```
 * 메소 = 메포 × 100,000,000 ÷ 시세
 * ```
 *
 * 곱셈으로 짜면 결과가 **1억 배** 어긋난다. 컬럼 이름을 `meso_per_point` 에서
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
 * 구입가에 붙는 관세(메소). **시세를 안 물어도 된다**. 관세가 메소 가치 기준 10% 라
 * 메소마켓 시세가 양변에서 상쇄된다.
 */
export function tariffMesoOf(priceMeso: number): number {
  return Math.floor((priceMeso * SPEND_TARIFF_PERCENT) / 100)
}

/**
 * 저장에 들어갈 **두 값**. 총액과 그중 관세분.
 *
 * 총액을 함께 내는 이유는 집계가 `meso_amount` 한 칸만 보면 되게 하기 위해서다(관세를 빠뜨려
 * 덜 세는 사고가 구조적으로 없어진다). 관세분을 따로 박는 이유는 요율이 바뀌는 날 **지난달
 * 관세가 소급해 달라지지 않게** 하기 위해서다.
 *
 * 더해서 만들고 빼서 되돌릴 수 있다. `mesoAmount - tariffMeso === priceMeso` 가 언제나 참이다.
 */
export function withTariffMeso(priceMeso: number): { mesoAmount: number; tariffMeso: number } {
  const tariffMeso = tariffMesoOf(priceMeso)
  return { mesoAmount: priceMeso + tariffMeso, tariffMeso }
}
