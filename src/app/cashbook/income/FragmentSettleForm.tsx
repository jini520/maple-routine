/**
 * 솔 에르다 조각 정산 칸. 사냥 전리품 판매의 `조각` 칸이고, 사냥에서 가격을 나중에 입력으로 보관한 조각을 판 날에 적는다.
 *
 * 보관은 캐릭터별이고 시트 머리에서 고른 날까지 쌓인 것만 센다. 그래서 캐릭터가 필수이고, 날짜나
 * 캐릭터를 바꾸면 다시 센다. 보관 개수는 저장하지 않고 기록에서 세며 그 조회는 화면이 넘긴다.
 *
 * 캐릭터에 `모든 캐릭터` 를 고르면 개수를 못 치고, 보관이 있는 캐릭터마다 그 보관을 한 줄씩 저장한다.
 * 한 줄로 묶으면 캐릭터별로 세는 보관이 어느 캐릭터에서도 줄지 않는다.
 *
 * 금액은 `개수 × 개당 가격` 에서 판매 수수료를 뗀 값이다. 개수는 `quantity` 칸에 담아 수정으로 열 때
 * 단가를 `(받은 돈 + 뗀 몫) ÷ 개수` 로 되짚는다. 기록의 갈래는 `sol_erda_fragment` 그대로라 이미 적힌 정산 기록과 같다.
 */
import { useEffect, useMemo, useState } from 'react'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { FeeRow } from '../../../components/organisms/FeeRow/FeeRow'
import { netProceedsMeso, type FeePercent } from '../../../lib/cashbook/item-split'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { AmountInput, FieldCard } from '../sheet-fields'
import { COUNT_QUICK_ADDS } from '../../../constants/domain/quick-adds'
import { FRAGMENT_PRICE_QUICK_ADDS } from '../../../constants/domain/meso-quick-adds'
import { useSaveSlot, type IncomeDraft, type IncomeFormProps } from './form-shared'
import { useSaleFeeChoice } from './sale-fee'
import { LootBlock, LootLine } from './loot-block'
import { useSheetSubmit } from '../../../hooks/useSheetSubmit'

/** 보관 개수를 읽는 함수. 못 읽으면 `null` 이다. 뺄 기록 id 는 수정 중인 정산 기록이다. */
export type LoadFragmentStorage = (
  ocid: string,
  onOrBeforeDateKey: string,
  excludeRecordId: string | undefined,
) => Promise<number | null>

/** 캐릭터 고르개의 `모든 캐릭터` 값. ocid 와 겹치지 않는다. */
export const ALL_CHARACTERS = 'all'

export function FragmentSettleForm(
  props: IncomeFormProps & {
    /** 고른 캐릭터. 캐릭터 줄은 분류를 바꿔도 남게 사냥 전리품 판매 폼이 든다. */
    ocid: string | null
    /** 카드 맨 위에 서는 캐릭터 · 분류 줄. */
    head: React.ReactNode
    /** 블록 머리의 그림 · 이름. 사냥 전리품 표의 조각 줄이다. */
    iconAssetId: string
    name: string
    /** 보관 개수 조회. 폼은 `storage/` 를 모른다. */
    loadFragmentStorage: LoadFragmentStorage
    onSaveMany: (drafts: readonly IncomeDraft[]) => void | Promise<void>
  },
): React.JSX.Element {
  const editing = props.editing !== undefined
  const { ocid } = props
  const all = ocid === ALL_CHARACTERS
  const [countText, setCountText] = useState(mesoTextOf(props.editing?.quantity ?? 0))
  /** 친 단가를 되짚는다. 받은 돈은 수수료를 뗀 값이라 뗀 몫을 더해 나눈다. `quantity` 가 없으면 빈 칸이다. */
  const [priceText, setPriceText] = useState(() => {
    const quantity = props.editing?.quantity ?? null
    if (quantity === null || quantity <= 0) return ''
    return mesoTextOf(Math.round(((props.editing?.mesoAmount ?? 0) + (props.editing?.saleFeeMeso ?? 0)) / quantity))
  })
  /**
   * 읽어 온 보관. 어느 캐릭터들 · 날짜로 읽은 값인지 함께 든다.
   *
   * 캐릭터를 빠르게 바꾸면 먼저 부른 응답이 늦게 올 수 있다. 지금 고른 것과 열쇠가 다른 값은 안 쓴다.
   */
  const [loaded, setLoaded] = useState<{ key: string; counts: readonly (number | null)[] } | null>(null)
  const { saving, submit, submitMany, remove } = useSheetSubmit(props)

  const { loadFragmentStorage, dateKey, characters } = props
  const editingId = props.editing?.id
  /** 보관을 셀 캐릭터. 모든 캐릭터면 시트가 받은 캐릭터 전부다. */
  const targets = useMemo(
    () => (ocid === null ? [] : ocid === ALL_CHARACTERS ? characters.map((each) => each.ocid) : [ocid]),
    [ocid, characters],
  )
  const storageKey = `${targets.join(',')}:${dateKey}`

  useEffect(() => {
    if (targets.length === 0) return
    const key = `${targets.join(',')}:${dateKey}`
    let live = true
    void Promise.all(targets.map((each) => loadFragmentStorage(each, dateKey, editingId))).then((counts) => {
      if (live) setLoaded({ key, counts })
    })
    return () => {
      live = false
    }
  }, [targets, dateKey, editingId, loadFragmentStorage])

  /** 캐릭터마다 센 보관. 안 골랐거나 읽는 중이거나 한 캐릭터라도 못 읽었으면 `null` 이다. */
  const counts = loaded !== null && loaded.key === storageKey && !loaded.counts.includes(null) ? loaded.counts : null
  /** 모든 캐릭터에서 정산할 캐릭터와 개수. 보관이 0 이하인 캐릭터는 팔 것이 없다. */
  const sellers = all && counts !== null
    ? targets.map((each, index) => ({ ocid: each, count: counts[index] ?? 0 })).filter((each) => each.count > 0)
    : []
  /** 보유 줄의 수. 모든 캐릭터면 정산할 보관의 합이다. */
  const storage = counts === null ? null : all ? sellers.reduce((sum, each) => sum + each.count, 0) : (counts[0] ?? null)
  const fee = useSaleFeeChoice(props.editing, all ? null : ocid, dateKey, all ? sellers.map((each) => each.ocid) : undefined)
  const count = all ? (storage ?? 0) : mesoValueOf(countText)
  const price = mesoValueOf(priceText)
  /** 저장할 줄. 모든 캐릭터면 캐릭터마다 그 캐릭터의 요율로 뗀다. */
  const lineOf = (lineOcid: string | null, lineCount: number, percent: FeePercent | null) => {
    const gross = lineCount * price
    return { ocid: lineOcid, count: lineCount, percent, gross, amount: percent === null ? gross : netProceedsMeso(gross, percent) }
  }
  const lines = all
    ? sellers.map((each) => lineOf(each.ocid, each.count, fee.percentOf(each.ocid)))
    : [lineOf(ocid, count, fee.percent)]
  const amount = lines.reduce((sum, line) => sum + line.amount, 0)
  /** 개수 칩. `모두` 는 보관 개수로 바꾸고, 보관을 모르거나 0 이하면 넣을 값이 없어 안 선다. */
  const countChips =
    storage !== null && storage > 0 ? [{ label: '모두', value: storage, set: true }, ...COUNT_QUICK_ADDS] : COUNT_QUICK_ADDS
  /** 보관이 있어야 하고 개수는 1 부터 보관까지다. 개당 가격은 0 이어도 된다. 직접 쓴 조각을 보관에서 덜어 낸다. */
  const canSave = storage !== null && count >= 1 && count <= storage && fee.ready

  const draftOf = (line: (typeof lines)[number]): IncomeDraft => ({
    ocid: line.ocid,
    earnedOn: dateKey,
    category: 'sol_erda_fragment',
    item: null,
    itemKey: null,
    mesoAmount: line.amount,
    saleFeePercent: line.percent,
    saleFeeMeso: line.percent === null ? null : line.gross - line.amount,
    saleFeeAuto: fee.auto,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    // 판 개수. 보관 조회가 이 칸을 빼고, 수정으로 열 때 단가를 되짚는다.
    quantity: line.count,
    hunt: null,
    itemKind: null,
  })

  useSaveSlot(props.setSave, {
    editing,
    canSave,
    saving,
    onSave: () => {
      if (all) {
        void submitMany(lines.map(draftOf))
        return
      }
      if (lines[0] !== undefined) void submit(draftOf(lines[0]))
    },
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  return (
    <>
      <FieldCard>
        {props.head}

        {/* 개수를 치면서 상한인 보유 개수를 같은 블록 머리에서 본다(사용자 지정 2026-10-29). */}
        <LootBlock
          iconAssetId={props.iconAssetId}
          name={props.name}
          right={
            <>
              <Text className="text-11 text-text-muted">보유</Text>
              <Text
                testID="income-sheet-fragment-storage"
                className="text-xs font-bold text-text"
                style={TABULAR_NUMS}
              >
                {storage === null ? '-' : `${storage}개`}
              </Text>
            </>
          }
        >
          <LootLine label="개당 가격" unit="메소">
            <AmountInput
              testID="income-sheet-settle-price"
              label="개당 가격"
              context={props.name}
              icon="meso"
              unit="메소"
              reading
              chips={FRAGMENT_PRICE_QUICK_ADDS}
              value={priceText}
              onChange={setPriceText}
            />
          </LootLine>
          <LootLine label="개수" unit="개">
            {all ? (
              // 모든 캐릭터는 보관을 전부 판다. 칠 값이 없어 누르개가 아니다.
              <Text
                testID="income-sheet-settle-count"
                className="h-5 flex-1 text-right text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              >
                {count.toLocaleString()}
              </Text>
            ) : (
              <AmountInput
                testID="income-sheet-settle-count"
                label="개수"
                context={props.name}
                icon="fragment"
                unit="개"
                chips={countChips}
                value={countText}
                onChange={setCountText}
              />
            )}
          </LootLine>
        </LootBlock>

        <FeeRow testID="income-sheet-fee" label="수수료" {...fee.row} />
      </FieldCard>

      <AmountFigure value={amount} unit="메소" testID="income-sheet-amount" />
    </>
  )
}
