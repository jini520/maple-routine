/**
 * 월간 탭의 월간 보스 **열람 행**. 잡았나 · 언제 · 몇 인 · 얼마만 말한다.
 *
 * 기록하는 자리는 주간 목록의 그 줄 하나다. 그래서 여기에는 드롭 추가 · 파티 인원 · 직접 완료 ·
 * 수정 · 완료 취소가 **하나도 없다**(사용자 지정). 서버가 그 보스의 직접 완료를 열어 둔 상태여도
 * 단추가 안 선다.
 *
 * `BossProfitBossRow` 를 안 쓰는 것은 둘째 줄이 다르기 때문이다. 그쪽은 파티 스테퍼이고 이쪽은
 * `n인 · n월 n일 완료` 다. 같은 컴포넌트에 깃발을 달면 못 하는 일이 프롭으로 흩어진다.
 */
import { View } from 'react-native'

import type { BossProfitRow } from '../../features/boss-profit/store'
import { sumDropPayout } from '../../lib/drop/drop-price'
import { sortDropsForDisplay } from '../../lib/drop/drop-order'
import type { RecordedDrop } from '../../types/drops'

import { AnimatedNumber, Badge, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { bossPortraitSlugOf } from '../../lib/boss/bosses'
import { BOSS_PORTRAIT_SIZE, DropIndicator } from './BossProfitBossRow'
import { ItemRevenueTrigger } from './ItemRevenueTrigger'
import { ItemRevenuePopover } from './ItemRevenuePopover'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'

export function MonthlyBossViewRow(props: {
  row: BossProfitRow
  drops: RecordedDrop[]
}): React.JSX.Element {
  const { row } = props
  // 구조 분해가 필수다. 프로퍼티로 읽으면 `react-hooks/refs` 가 렌더 중 ref 접근으로 본다.
  const { ref: itemChipRef, isOpen: isItemPopoverOpen, anchor: itemAnchor, toggle: toggleItemPopover, close: closeItemPopover } =
    useAnchoredPopover()
  const dropTotal = sumDropPayout(props.drops)
  const drops = sortDropsForDisplay(props.drops)
  const isPriceUnknown = row.priceMeso === null

  const amount = (
    <Text
      className={
        dropTotal > 0
          ? // 아이템이 섞이면 금액 색이 달라진다. 캐릭터 합계·주간 행과 같은 규칙이다.
            'text-sm font-semibold text-primary-ink'
          : 'text-sm font-semibold text-text'
      }
      style={TABULAR_NUMS}
    >
      <AnimatedNumber
        identity={`monthly-view|${row.ocid}|${row.bossKey}|${row.difficulty}|${row.periodKey}`}
        value={(row.payoutMeso ?? 0) + dropTotal}
      />
      {' 메소'}
    </Text>
  )

  return (
    <>
      <View
        testID="monthly-boss-view-row"
        className="flex-row items-center gap-3 border-b border-border p-4"
      >
        <BossPortrait portraitSlug={bossPortraitSlugOf(row.bossKey)} label={row.bossName} size={BOSS_PORTRAIT_SIZE} />

        <View className="min-w-0 flex-1">
          <View className="h-6 w-full flex-row items-center gap-1.5">
            <Badge variant={row.difficulty}>{DIFFICULTY_NAME[row.difficulty]}</Badge>
            <Text numberOfLines={1} className="shrink text-sm font-semibold text-text">
              {row.bossName}
            </Text>
            {/* 눌리지 않는다. 뭐가 떴는지만 말하고, `＋ 드롭 추가` 자리는 아예 안 그린다 -
                이 행에서 할 수 없는 일이다. */}
            {drops.length > 0 && <DropIndicator drops={drops} />}
          </View>

          <View className="mt-2 flex-row items-center justify-between gap-2">
            {row.isComplete ? (
              <Text className="shrink-0 text-xs text-text-muted" style={TABULAR_NUMS}>
                {completionLabel(row)}
              </Text>
            ) : (
              <View />
            )}

            {/* 금액을 모르는 자리에 0 을 쓰지 않는다. 0 은 0메소 벌었다 로 읽힌다. */}
            {!row.isComplete ? (
              <Badge variant="muted" className="shrink-0">
                미완료
              </Badge>
            ) : isPriceUnknown ? (
              <Badge variant="primary" className="shrink-0">
                가격 미확정
              </Badge>
            ) : dropTotal === 0 ? (
              amount
            ) : (
              <ItemRevenueTrigger
                ref={itemChipRef}
                label={`${row.bossName} 아이템 수익 확인`}
                isOpen={isItemPopoverOpen}
                onPress={toggleItemPopover}
              >
                {amount}
              </ItemRevenueTrigger>
            )}
          </View>
        </View>
      </View>

      {isItemPopoverOpen && (
        <ItemRevenuePopover
          drops={drops}
          crystalMeso={row.payoutMeso ?? 0}
          itemMeso={dropTotal}
          anchor={itemAnchor}
          onClose={closeItemPopover}
        />
      )}
    </>
  )
}

/**
 * `2인 · 9월 2일 완료`. 처치일을 모르면 날짜를 뺀다.
 *
 * 그 값은 그 달 앞 2주 안에 앱을 열었을 때만 채워진다. 없는 값을 지어내지 않는다.
 */
function completionLabel(row: BossProfitRow): string {
  const party = `${row.partySize ?? 1}인`
  if (row.defeatedOn === null) {
    return `${party} · 완료`
  }
  const [, month, day] = row.defeatedOn.split('-')
  return `${party} · ${Number(month)}월 ${Number(day)}일 완료`
}
