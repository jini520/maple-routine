/**
 * 메소마켓 환전 수수료의 금액. 판 메소와 산 메소를 같은 메소로 보고 빼고, 쓰고 남은 메포는 본 월드 시세로 메소로 되돌린다.
 *
 * @see docs/features/cashbook.md 의 `입력`
 */
import { receivedPointOf } from './spend-catalog'

const MESO_PER_HUNDRED_MILLION = 100_000_000

export interface MesoMarketExchangeInput {
  /** 판 메소. 1억 단위다 */
  soldMeso: number
  /** 판 월드의 1억 메소당 메포 */
  sellRate: number
  /** 산 메소. 아직 안 샀으면 `null` 이다 */
  boughtMeso: number | null
  /** 산 월드의 1억 메소당 메포. 안 샀으면 `null` 이다 */
  buyRate: number | null
  /** 판매 수수료율(%) */
  feePercent: number
}

/**
 * 환전에 든 메소를 부호와 함께 내는 함수. 판매만 적었으면 판매 수수료만큼이다.
 *
 * @returns 양수면 지출, 음수면 수입. 본 월드 시세가 0 이하면 0 이다
 */
export function mesoMarketExchangeMeso(input: MesoMarketExchangeInput): number {
  if (input.sellRate <= 0) return 0
  const received = receivedPointOf(Math.floor(input.soldMeso / MESO_PER_HUNDRED_MILLION), input.sellRate, input.feePercent)
  const bought = input.boughtMeso ?? 0
  const spent = input.buyRate === null ? 0 : Math.floor(bought / MESO_PER_HUNDRED_MILLION) * input.buyRate
  const left = received - spent
  // 남은 메포가 음수면 남아 있던 메포를 보탠 것이다. 내림이라 그만큼을 메소로 바꾼 값도 아래로 간다.
  const leftMeso = Math.floor((left * MESO_PER_HUNDRED_MILLION) / input.sellRate)
  return input.soldMeso - bought - leftMeso
}
