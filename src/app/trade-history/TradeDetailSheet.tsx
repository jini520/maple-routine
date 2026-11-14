/**
 * 거래 내역 상세 시트. 읽기 전용이라 고치기 · 지우기가 없고, 바닥의 `거래로 이동` 이 그 기록을 적을 때 쓴 시트로 보낸다.
 * 날짜는 바꿀 수 없어 화살표 없는 알약이다.
 */
import { View } from 'react-native'

import { Text } from '../../components/atoms'
import { AmountFigure } from '../../components/molecules/AmountFigure/AmountFigure'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { MemoField } from '../../components/molecules/MemoField/MemoField'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { SheetActionButton } from '../../components/organisms/BottomSheet/SheetActionButton'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { tradeDetailOf } from '../../features/trade-history/detail'
import { tradeDateLabel, type TradeRow } from '../../features/trade-history/rows'
import { FieldCard, FieldRow } from '../cashbook/sheet-fields'
import { ItemBlock } from '../inventory/InventorySaleSheet'

export function TradeDetailSheet(props: {
  row: TradeRow
  todayDateKey: string
  onGoToTrade: () => void
  onClose: () => void
}): React.JSX.Element {
  const { row } = props
  const detail = tradeDetailOf(row)
  return (
    <BottomSheet
      testId="trade-detail-sheet"
      label={detail.title}
      onClose={props.onClose}
      header={
        <View className="flex-row items-center justify-between gap-2">
          <Text testID="trade-detail-title" className="shrink text-base font-bold text-text">
            {detail.title}
          </Text>
          <DateSelect
            readOnly
            dateKey={row.dateKey}
            label="거래한 날"
            text={tradeDateLabel(row.dateKey, props.todayDateKey, true)}
            testID="trade-detail-date"
          />
        </View>
      }
      footer={<SheetActionButton testID="trade-detail-go" label="거래로 이동" onPress={props.onGoToTrade} />}
    >
      <View className="gap-3 px-4">
        <FieldCard>
          <ItemBlock
            icon={row.icon}
            name={row.name}
            ownerLabel="캐릭터"
            owner={row.ownerName}
            right={
              row.quantity === null ? undefined : (
                <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
                  {row.quantity}
                </Text>
              )
            }
          />
          {detail.cells.map((cell) => (
            <FieldRow key={cell.label} label={cell.label} testID={`trade-detail-cell-${cell.label}`}>
              <Text className="text-right text-sm font-semibold text-text" style={TABULAR_NUMS}>
                {cell.value}
              </Text>
              {cell.unit !== null && <Text className="ml-1.5 shrink-0 text-xs text-text-muted">{cell.unit}</Text>}
            </FieldRow>
          ))}
        </FieldCard>
        <AmountFigure value={detail.amount.value} unit={detail.amount.unit} testID="trade-detail-amount" />
        {/* 메모가 없으면 칸을 두지 않는다. `메모 추가` 는 적는 동작이라 읽기 전용 시트에 맞지 않는다. */}
        {row.memo !== null && <MemoField testID="trade-detail-memo" memo={row.memo} />}
      </View>
    </BottomSheet>
  )
}
