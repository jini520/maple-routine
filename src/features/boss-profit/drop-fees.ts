import type { FeeSeed, FeesValue } from '../../components/organisms/InputCard/InputCard'
import type { RecordedDrop } from '../../types/drops'

/**
 * 가격 카드의 판매 · 분배 수수료 씨앗. 새로 매기면 자동이고, 매긴 기록은 적힌 대로 연다.
 * 수수료 칸이 없던 옛 기록은 없음으로 열어, 열기만 해서는 금액이 안 움직인다.
 *
 * @param edit 이 연쇄 안에서 방금 매긴 값. 이전으로 돌아왔을 때 보인다
 */
export function dropFeeSeeds(drop: RecordedDrop, edit: FeesValue | undefined): [FeeSeed, FeeSeed] {
  if (edit !== undefined) {
    return [
      { auto: edit.saleFeeAuto, percent: edit.saleFeePercent },
      { auto: edit.splitFeeAuto, percent: edit.splitFeePercent },
    ]
  }
  if (drop.priceState !== 'entered') return [{ auto: true, percent: null }, { auto: true, percent: null }]
  return [
    { auto: drop.saleFeeAuto === true, percent: drop.saleFeePercent ?? null },
    { auto: drop.splitFeeAuto === true, percent: drop.splitFeePercent ?? null },
  ]
}

/**
 * 카드가 준 수수료를 드롭 기록 칸으로. 도메인 타입은 빈 칸을 `undefined` 로 든다.
 *
 * 가격을 고치는 패치는 모두 이것을 펼치므로 저장된 받는 메소도 여기서 비운다. 남기면 고친 가격 대신 옛 금액이 보이고,
 * 저장할 때 다시 센다.
 */
export function dropFeeFields(
  fees: FeesValue | undefined,
): Pick<RecordedDrop, 'saleFeePercent' | 'splitFeePercent' | 'saleFeeAuto' | 'splitFeeAuto' | 'saleReceivedMeso'> {
  return {
    saleFeePercent: fees?.saleFeePercent ?? undefined,
    saleFeeAuto: fees?.saleFeeAuto === true ? true : undefined,
    splitFeePercent: fees?.splitFeePercent ?? undefined,
    splitFeeAuto: fees?.splitFeeAuto === true ? true : undefined,
    saleReceivedMeso: undefined,
  }
}
