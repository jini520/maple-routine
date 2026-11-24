/**
 * 드롭 한 건의 가격 입력 카드. 거래 내역의 `거래로 이동` 이 가계부에서 연다. 가계부는 드롭 줄을 고치지 않고, 드롭 가격은
 * 아이템 가격 입력 화면 · 인벤토리가 여는 같은 카드에서 고치기 때문이다.
 */
import { mesoValueOf } from '../../lib/meso-input/meso-pad'
import { excludeDropPriceOf, loadDropPriceEntry, saveDropPriceOf } from '../../features/boss-profit/drop-price-store'
import { closeInputCard, openInputCard } from '../../features/input-card/store'
import type { LoadedFeeContext } from '../../features/mvp-grade/fee-context'
import { confirmLabels } from '../../lib/drop/price-card-labels'
import type { BossDropRecord } from '../../storage/boss-drops'
import { dropPriceCardRequest } from '../boss-profit/drop-price-card'

const SINGLE_CARD = confirmLabels({ 하나: true, 마지막: true, 자리: 0, 전체: 1, 매긴것: 0, 지금매김: false })

export async function openDropPriceCardOf(input: {
  drop: BossDropRecord
  characterName: string
  gradeContext: LoadedFeeContext | null
  onError: (message: string) => void
}): Promise<void> {
  const { drop, onError } = input
  const target = await loadDropPriceEntry(drop).catch(() => null)
  if (target === null) {
    onError('드롭 기록을 불러오지 못했습니다')
    return
  }
  openInputCard(
    dropPriceCardRequest({
      target,
      characterName: input.characterName,
      edit: undefined,
      gradeContext: input.gradeContext,
      labels: SINGLE_CARD,
      onExclude: () => {
        closeInputCard()
        void excludeDropPriceOf(drop).catch(() => onError('가격을 저장하지 못했습니다'))
      },
      onConfirm: (next, share, fees) => {
        // 빈 칸이나 0 이면 쓰지 않는다. 0메소는 매긴 것이 아니다.
        if (next === '' || mesoValueOf(next) === 0) return
        void saveDropPriceOf(drop, mesoValueOf(next), share ?? target.defaultShare, fees).catch(() =>
          onError('가격을 저장하지 못했습니다'),
        )
      },
    }),
  )
}
