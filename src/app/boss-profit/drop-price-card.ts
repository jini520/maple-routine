/**
 * 드롭 하나의 가격 카드. 보스 수익의 `아이템 가격 입력` 화면과 인벤토리가 같은 카드를 연다. 입구에 따라 같은 드롭의 카드가
 * 갈리면 안 된다.
 */
import type { FeesValue, ShareValue } from '../../components/organisms/InputCard/InputCard'
import { MESO_QUICK_ADDS } from '../../constants/domain/meso-quick-adds'
import { mesoTextOf } from '../../components/organisms/MesoPad/meso-pad'
import type { DropPriceEntry } from '../../features/boss-profit/drop-price-store'
import { dropFeeSeeds } from '../../features/boss-profit/drop-fees'
import type { InputCardRequest } from '../../features/input-card/store'
import type { LoadedFeeContext } from '../../features/mvp-grade/fee-context'
import { autoFeeFrom } from '../../features/mvp-grade/store'
import { dropItemIconOf } from '../../lib/assets/asset-lookup'
import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import { getMaxPartySize } from '../../lib/boss/bosses'
import { dropItemNameOf } from '../../lib/drop/drop-items'
import type { confirmLabels } from '../../lib/drop/price-card-labels'

/** 한 연쇄 안에서 매긴 값. 스토어를 다시 읽어도 이전으로 돌아가면 이 값이 보인다. */
export interface PriceEdit {
  meso: number
  share: ShareValue
  fees?: FeesValue
}

/**
 * @param input.labels 확인 버튼 글자. 연쇄의 자리에 따라 `다음` · `완료` 로 갈린다
 * @param input.onExclude `기록 안함` 을 눌렀을 때
 */
export function dropPriceCardRequest(input: {
  target: DropPriceEntry
  characterName: string
  edit: PriceEdit | undefined
  gradeContext: LoadedFeeContext | null
  labels: ReturnType<typeof confirmLabels>
  onExclude: () => void
  prev?: InputCardRequest['prev']
  onConfirm: InputCardRequest['onConfirm']
}): InputCardRequest {
  const { target, edit, gradeContext } = input
  const [saleSeed, splitSeed] = dropFeeSeeds(target.drop, edit?.fees)
  return {
    // 머리가 그 아이템을 말한다. `판매 가격` 이라는 말은 이미 누른 행이 했다.
    label: dropItemNameOf(target.drop.itemKey, target.drop.itemName),
    context: `${input.characterName} · ${target.bossName}`,
    icon: dropItemIconOf(target.drop.itemKey) ?? 'meso',
    unit: '메소',
    reading: true,
    unitKey: 'dropPrice',
    chips: MESO_QUICK_ADDS,
    value: mesoTextOf(edit?.meso ?? target.drop.priceMeso ?? 0),
    share: {
      label: '분배 비율',
      // 열 때의 자리는 **적힌 방식**이 정한다. 숫자로 되짚으면 비율 33.3% 가 기본 3인으로 열린다.
      mode: edit?.share.mode ?? target.drop.priceSplitMode ?? target.defaultShare.mode,
      // 인원과 비율은 **칸이 다르다**. 한 칸에서 둘을 뿌리면 비율에서 고친 합이 인원을 덮는다.
      partySize: edit?.share.partySize ?? target.drop.pricePartySize ?? target.defaultShare.partySize,
      myShare: edit?.share.myShare ?? target.drop.priceMyShare ?? target.defaultShare.myShare,
      sharesTotal: edit?.share.sharesTotal ?? target.drop.priceShare ?? target.defaultShare.sharesTotal,
      maxPartySize: getMaxPartySize(target.bossKey, target.difficulty),
    },
    fees: {
      // 드롭에는 날짜 칸이 없어 기간 첫날의 등급으로 센다(다시 계산도 같은 날을 본다).
      autoFee: gradeContext === null ? null : autoFeeFrom(gradeContext, target.ocid, periodStartDateKey(target.periodKey)),
      sale: saleSeed,
      split: splitSeed,
    },
    ...input.labels,
    exclude: { label: '기록 안함', onPress: input.onExclude },
    prev: input.prev,
    onConfirm: input.onConfirm,
  }
}
