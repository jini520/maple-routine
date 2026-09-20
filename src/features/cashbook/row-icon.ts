/**
 * 하루 상세 목록에서 줄 표식을 고르는 열쇠.
 *
 * **화면에 적히는 글자가 아니다.** 손입력 줄의 글자는 `item ?? category` 라 사용자가 항목
 * 이름을 적으면 그것이 뜨는데, 그 글자로 그림을 찾으면 이름을 적은 줄에서만 그림이 사라진다.
 *
 * 그림이 없는 갈래도 열쇠는 낸다. 무엇을 그릴지는 조회표(`cashbookRowIconOf`)가 정하므로
 * 나중에 그림을 붙일 때 고치는 것이 표 한 줄이다.
 */
import { cashbookRowIconOf, spendIconOf } from '../../lib/assets/asset-lookup'
import { findSpendChoice, findSpendRewardChoice } from '../../lib/cashbook/spend-catalog'
import { findSymbol } from '../../lib/cashbook/symbol-costs'
import type { ImageAssetRef } from '../../types/image-asset'
import { isManualRecord, type DayRecord } from './records'

export function recordIconKeyOf(entry: DayRecord): string {
  // 수익과 지출의 갈래 key 가 겹칠 수 있어(`etc`) 기록 종류를 앞에 붙인다. 강화 줄도 같은 모양이다.
  if (isManualRecord(entry)) return `${entry.kind}:${entry.record.category}`
  if (entry.kind === 'enhancement') return `${entry.kind}:${entry.category}`
  // 결정석 · 판매 줄은 기록 종류 하나가 곧 열쇠다.
  return entry.kind
}

/**
 * 줄 표식 그림. 없으면 `null` 이고 화면이 아이콘을 그린다.
 *
 * 지출 목록에서 고른 기록은 **시트에서 고른 타일의 그림**이다. 항목 key(에픽던전 추가 리워드는 형태별 항목 key)로
 * 타일을 되짚고 시트 타일과 같은 `spendIconOf` 로 찾는다. 시트와 줄이 한 조회를 써야 시트에서 본 그림과 목록의 그림이
 * 갈리지 않는다. 그림 없는 타일이면 `null` 이다. 비슷한 그림을 붙이면 틀린 것을 그린다.
 *
 * 나머지 줄은 `recordIconKeyOf` 의 열쇠로 찾는다. 목록 갈래의 열쇠(`spend:buff` 등)는 조회표에 없어, 타일을 되짚지
 * 못한 옛 기록도 `null` 이다.
 */
export function recordIconOf(entry: DayRecord): ImageAssetRef | null {
  if (entry.kind === 'spend') {
    const { category, itemKey, formItemKeys } = entry.record
    // 심볼 강화는 선택 목록이 아니라 비용 표에서 심볼을 되짚는다.
    if (category === 'symbol') {
      const symbol = findSymbol(itemKey)?.symbol
      return symbol === undefined ? null : (spendIconOf({ file: symbol.icon })?.ref ?? null)
    }
    const choice = findSpendChoice(category, itemKey)?.choice ?? findSpendRewardChoice(category, formItemKeys)?.choice
    if (choice !== undefined) return spendIconOf(choice.icon)?.ref ?? null
  }
  return cashbookRowIconOf(recordIconKeyOf(entry))
}
