/**
 * 메소마켓 환전 수수료 폼. 메소를 다른 월드로 옮길 때 든 메소를 메이플 ID 에 적는다.
 *
 * 판매만 적고 구매는 나중에 수정 시트에서 더할 수 있다. 금액이 0 보다 작으면 수익이라 저장하는 쪽이 `기타` 수입으로 적는다.
 * 판매와 구매가 따로 적히는 일이라 칸 카드도 둘로 나눈다.
 */
import { useState } from 'react'
import { Pressable } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { HUNDRED_MILLION_QUICK_ADDS } from '../../../constants/domain/quick-adds'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { openInputCard } from '../../../features/input-card/store'
import { spendCategoryNameOf } from '../../../lib/cashbook/categories'
import { mesoMarketExchangeMeso } from '../../../lib/cashbook/meso-market-exchange'
import { mesoMarketFeeOf } from '../../../lib/cashbook/spend-catalog'
import { useSpendSubmit } from '../../../hooks/useSpendSubmit'
import { FieldCard, FieldRow, SelectRow } from '../sheet-fields'
import { RateRow, useHeaderSlot, useSaveSlot, type SpendFormProps } from './form-shared'

const MESO_PER_HUNDRED_MILLION = 100_000_000

/** 메소를 억 수 글자로. 비었거나 1억이 안 되면 빈 칸이다 */
function hundredMillionTextOf(meso: number | null | undefined): string {
  return meso == null || meso < MESO_PER_HUNDRED_MILLION ? '' : String(Math.floor(meso / MESO_PER_HUNDRED_MILLION))
}

/** 메소마켓은 1억 단위로만 거래해서 입력 카드는 억 수만 받는다. 줄에는 다른 메소 칸처럼 메소로 적는다 */
function HundredMillionField(props: { testID: string; label: string; value: string; onChange: (next: string) => void }): React.JSX.Element {
  const count = mesoValueOf(props.value)
  return (
    <FieldRow label={props.label}>
      <Pressable
        testID={props.testID}
        role="button"
        aria-label={props.label}
        onPress={() =>
          openInputCard({
            label: props.label,
            context: '메소마켓은 1억 단위로 거래합니다',
            unit: '억',
            chips: HUNDRED_MILLION_QUICK_ADDS,
            value: props.value,
            onConfirm: (next) => props.onChange(String(Math.floor(mesoValueOf(next))).replace(/^0$/, '')),
          })
        }
        className="h-5 flex-1"
      >
        <Text className={`text-right text-sm ${count === 0 ? 'text-text-disabled' : 'font-semibold text-text'}`} style={TABULAR_NUMS}>
          {(count * MESO_PER_HUNDRED_MILLION).toLocaleString()}
        </Text>
      </Pressable>
      <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
    </FieldRow>
  )
}

export function MesoMarketExchangeForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const exchange = props.editing?.exchange
  const [accountId, setAccountId] = useState<string | null>(props.editing?.accountId ?? null)
  const [soldText, setSoldText] = useState(hundredMillionTextOf(exchange?.soldMeso))
  const [sellRateText, setSellRateText] = useState(() => {
    const rate = exchange?.sellPointPer100mMeso ?? props.lastPointRate
    return rate == null ? '' : String(rate)
  })
  const [boughtText, setBoughtText] = useState(hundredMillionTextOf(exchange?.boughtMeso))
  const [buyRateText, setBuyRateText] = useState(exchange?.buyPointPer100mMeso == null ? '' : String(exchange.buyPointPer100mMeso))
  const { saving, submit, remove } = useSpendSubmit(props)

  const sold = mesoValueOf(soldText)
  const bought = mesoValueOf(boughtText)
  const sellRate = mesoValueOf(sellRateText)
  const buyRate = mesoValueOf(buyRateText)
  // 적힌 요율을 지킨다. 새 기록은 지금 규칙의 요율이다.
  const feePercent = mesoMarketFeeOf(exchange?.mesoMarketFeePercent) ?? 0
  const buying = bought > 0
  const meso = mesoMarketExchangeMeso({
    soldMeso: sold * MESO_PER_HUNDRED_MILLION,
    sellRate,
    boughtMeso: buying ? bought * MESO_PER_HUNDRED_MILLION : null,
    buyRate: buying ? buyRate : null,
    feePercent,
  })
  const canSave = accountId !== null && sold > 0 && sellRate > 0 && (!buying || buyRate > 0)

  useSaveSlot(props.setSave, {
    showSave: true,
    editing,
    canSave,
    saving,
    onSave: () =>
      void submit({
        ocid: null,
        accountId: accountId!,
        spentOn: props.dateKey,
        category: 'etc',
        item: spendCategoryNameOf('meso_market_exchange'),
        itemKey: null,
        formItemKeys: null,
        itemKind: null,
        levelFrom: null,
        levelTo: null,
        quantity: 1,
        mesoAmount: Math.abs(meso),
        tariffMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        hexa: null,
        exchange: {
          soldMeso: sold * MESO_PER_HUNDRED_MILLION,
          sellPointPer100mMeso: sellRate,
          boughtMeso: buying ? bought * MESO_PER_HUNDRED_MILLION : null,
          buyPointPer100mMeso: buying ? buyRate : null,
          mesoMarketFeePercent: feePercent,
        },
      }),
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  useHeaderSlot(props.setHeader, {
    title: spendCategoryNameOf(props.category),
    dateKey: props.dateKey,
    todayDateKey: props.todayDateKey,
    earliestDateKey: props.earliestDateKey,
    onDateChange: props.onDateChange,
    onBack: editing ? undefined : props.onBack,
  })

  return (
    <>
      <FieldCard>
        <SelectRow
          testID="spend-sheet-exchange-account"
          label="메이플 ID"
          placeholder="메이플 ID 선택"
          options={props.accounts.map((account) => ({ value: account.accountId, label: account.label }))}
          selected={accountId}
          onSelect={setAccountId}
        />
        <HundredMillionField testID="spend-sheet-exchange-sold" label="판매 메소" value={soldText} onChange={setSoldText} />
        <RateRow
          testID="spend-sheet-exchange-sell-rate"
          label="본 월드 시세 · 1억당"
          value={sellRateText}
          onChange={setSellRateText}
          valid={sellRate > 0}
        />
      </FieldCard>

      <FieldCard>
        <HundredMillionField testID="spend-sheet-exchange-bought" label="구매 메소" value={boughtText} onChange={setBoughtText} />
        <RateRow
          testID="spend-sheet-exchange-buy-rate"
          label="구매 월드 시세 · 1억당"
          required={buying}
          value={buyRateText}
          onChange={setBuyRateText}
          valid={!buying || buyRate > 0}
        />
      </FieldCard>

      {/* 지출인지 수입인지. 칸이 아니라 큰 숫자 바로 위의 작은 글자다. 큰 숫자는 금액의 크기라 늘 양수다. */}
      <Text testID="spend-sheet-exchange-record" className="-mb-2.5 text-right text-11 text-text-muted">
        {meso < 0 ? '수입' : '지출'}
      </Text>
      <AmountFigure value={Math.abs(meso)} unit="메소" testID="spend-sheet-amount" />
    </>
  )
}
