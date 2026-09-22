import type { IncomeCategoryKey } from './categories'
import { type FeePercent, netProceedsMeso } from './item-split'

/** 판매 수수료를 다시 셀 때 보는 수입 기록의 칸. */
export interface SaleFeeSource {
  category: IncomeCategoryKey
  mesoAmount: number | null
  saleFeeMeso: number | null
  hunt: { fragments: number; fragmentPrice: number | null } | null
}

export interface SaleFeeFields {
  mesoAmount: number
  saleFeePercent: FeePercent
  saleFeeMeso: number
}

/**
 * 새 요율로 뗀 수입 기록의 세 칸. 판매가 아닌 기록은 `null`.
 * 판매 대금은 `받은 돈 + 뗀 몫` 으로 되짚는다. 요율만으로는 내림 때문에 역산이 안 된다.
 * 사냥은 조각 몫에만 붙어, 받은 돈에서 옛 몫을 돌려놓고 새 몫을 뗀다.
 */
export function withSaleFee(record: SaleFeeSource, percent: FeePercent): SaleFeeFields | null {
  const oldFee = record.saleFeeMeso ?? 0
  const received = record.mesoAmount ?? 0
  if (record.category === 'item_sale' || record.category === 'sol_erda_fragment') {
    const gross = received + oldFee
    const net = netProceedsMeso(gross, percent)
    return { mesoAmount: net, saleFeePercent: percent, saleFeeMeso: gross - net }
  }
  if (record.category === 'hunting' && record.hunt !== null && record.hunt.fragmentPrice !== null) {
    const fragmentGross = record.hunt.fragments * record.hunt.fragmentPrice
    const fee = fragmentGross - netProceedsMeso(fragmentGross, percent)
    return { mesoAmount: received + oldFee - fee, saleFeePercent: percent, saleFeeMeso: fee }
  }
  return null
}
