/**
 * 보스 한 줄과 그 줄의 **드롭 표시**(화면에서 분리).
 *
 * 파티원 수 조절, 드롭 기록 시트 열기, 획득 아이템 아이콘 스택이 여기 산다. 아코디언을 펼쳤을 때
 * 카드 안에 나열되는 단위이고, 자기 행 안에서 끝나 카드의 고정 헤더와는 무관하다.
 */
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import type { BossProfitRow } from '../../features/boss-profit/store'
import { useToastStore } from '../../features/toast/store'
import { formatMesoShort } from '../../lib/boss/boss-profit-delta'
import { sumDropPayout } from '../../lib/drop/drop-price'
import { getItemIconUrl } from '../../lib/assets/asset-lookup'
import { isValuableDrop } from '../../lib/drop/valuable-drops'
import type { RecordedDrop } from '../../types/drops'

import { AnimatedNumber, Badge, MinusIcon, PlusIcon, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { BossDropSheet } from './BossDropSheet'
import { useBossProfitContext } from './boss-profit-context'
import { clamp, findPortraitSlug } from './character-groups'
import { ItemRevenuePopover, useAnchoredPopover } from './ItemRevenuePopover'
import { ValuableRowBackground } from './ValuableRowBackground'

// BossPortrait의 size prop 기본값(40px, 기존 h-10 관례)과 동일하게 시작값을 맞춘다.
export const BOSS_PORTRAIT_SIZE = 40

export interface BossProfitBossRowProps {
  row: BossProfitRow
  drops: RecordedDrop[]
  /**
   * RN 에 `:last-child` 가 없어 목록을 아는 부모가 알려 준다.
   *
   * 테두리를 아예 빼지 않고 색만 지우는 것이 요점이다. 빼면 그 행만 1px 짧아진다.
   */
  isLast?: boolean
}

// 접힌 보스 행의 이름 라인 오른쪽에 붙는 드롭 지시자. 있으면 아이콘 스택+개수, 없으면
// "＋ 드롭 추가" 칩. 상자 결과는 실제 나온 아이템(반지 등) 아이콘으로 뜬다.
export function DropIndicator(props: { drops: RecordedDrop[] }): React.JSX.Element {
  if (props.drops.length === 0) {
    // 아이콘 스택(h-6)과 같은 슬롯이라 높이도 h-6으로 맞춘다. 패딩으로 높이를 만들면
    // 글꼴 line-height가 그대로 행 높이에 실려 드롭 유무로 행이 튄다.
    return (
      <View className="ml-auto h-6 shrink-0 flex-row items-center rounded-full border border-dashed border-primary bg-primary-tint px-2.5">
        <Text className="text-11 font-bold text-primary-ink">＋ 드롭 추가</Text>
      </View>
    )
  }

  const shown = props.drops.slice(0, 3)
  const extra = props.drops.length - shown.length

  return (
    <View className="ml-auto shrink-0 flex-row items-center">
      {shown.map((drop, index) => {
        const url = getItemIconUrl(drop.itemName, drop.slot)
        return (
          <View
            key={`${drop.itemName}-${index}`}
            className="h-6 w-6 shrink-0"
            style={{ marginLeft: index === 0 ? 0 : -2, zIndex: shown.length - index }}
          >
            {url !== null ? (
              <Image source={url} resizeMode="contain" className="h-6 w-6" />
            ) : (
              <View className="h-6 w-6 rounded-md border-[1.5px] border-surface bg-surface-2" />
            )}
            {/* 특수 스킬 반지(반지 상자 드릴다운 결과)만 등급이 기록된다. 드롭 시트
                ItemThumb의 lv 뱃지와 같은 규칙. 절대배치라 이름 줄의 h-6 고정에는
                영향을 주지 않는다. */}
            {drop.ringLevel !== undefined && (
              <View className="absolute -bottom-1 -right-0.5 rounded-full bg-primary px-0.5 py-px">
                <Text className="text-8 font-bold leading-none text-on-primary">lv{drop.ringLevel}</Text>
              </View>
            )}
          </View>
        )
      })}
      {extra > 0 && (
        <View
          className="h-6 w-6 items-center justify-center rounded-md border-[1.5px] border-surface bg-surface-2"
          style={{ marginLeft: -2, zIndex: 0 }}
        >
          <Text className="text-10 font-bold text-text-muted">+{extra}</Text>
        </View>
      )}
    </View>
  )
}

export function BossProfitBossRow(props: BossProfitBossRowProps): React.JSX.Element {
  const { row } = props
  const { setPartySize, setBossDrops } = useBossProfitContext()
  const [isDropSheetOpen, setIsDropSheetOpen] = useState(false)
  // 구조 분해가 필수다. `popover.toggle` 처럼 프로퍼티로 읽으면 `react-hooks/refs` 가 그 접근을
  // 렌더 중 ref 접근으로 본다. 훅이 안에서 `useRef` 를 쓰기 때문이다.
  const { ref: itemChipRef, isOpen: isItemPopoverOpen, anchor: itemAnchor, toggle: toggleItemPopover, close: closeItemPopover } =
    useAnchoredPopover()
  const dropTotal = sumDropPayout(props.drops)

  // 이 보스에서 고가 아이템을 획득했으면 행 배경에 골드 강조를 준다. 캐릭터 카드를 펼쳤을 때
  // 카드 테두리 효과 대신 실제 획득한 보스 행으로 강조가 이동하는 지점이다.
  const hasValuableDrop = props.drops.some((drop) => isValuableDrop(drop.itemName))
  const isPriceUnknown = row.priceMeso === null
  // 미완료(보스 스케줄러에 등록만 되고 아직 처치 전) placeholder는 파티원 수를 조정해도 의미가
  // 없다. 계산은 항상 0메소로 고정된다. "가격 미확정"과 동일한 비활성 처리를 재사용한다.
  const isEditable = row.isComplete && !isPriceUnknown
  const partySize = row.partySize ?? 1
  const canDecrease = isEditable && partySize > 1
  const canIncrease = isEditable && partySize < row.maxPartySize

  // 금액 마크업은 한 벌이다. 칩이 붙든 안 붙든 같은 `Text` 라 두 갈래가 서로 어긋날 수 없다.
  //
  // 카운트업 identity 는 행 자신의 (ocid, 보스, 난이도, 기간)이다. 기간이 키에 들어 있으므로
  // 기간을 옮기면 값이 변한 것이 아니라 다른 값을 보게 된 것이라 굴러가지 않는다. 기간 이동에
  // 굴러가는 것은 총 수익 헤드라인 하나뿐이다.
  const amount = (
    <Text
      className={
        dropTotal > 0
          ? // 아이템이 섞이면 **금액 색이 달라진다**(2026-08-10 사용자 요청). 캐릭터 합계와 같은
            // 규칙·같은 잉크라, 카드를 펼치면 "어느 행이 그 색을 만들었는지"가 바로 이어진다.
            'text-sm font-semibold text-primary-ink'
          : 'text-sm font-semibold text-text'
      }
      style={TABULAR_NUMS}
    >
      <AnimatedNumber
        identity={`boss|${row.ocid}|${row.boss}|${row.difficulty}|${row.periodKey}`}
        value={(row.payoutMeso ?? 0) + dropTotal}
      />
      {' 메소'}
    </Text>
  )

  // 예외 메시지를 그대로 렌더하지 않고 토스트로 알린다. 개발자용 문구와 SQLite 네이티브 원문이
  // 사용자에게 새는 자리가 여기다. 문구는 보스 관리 화면과 같아 두 경로가 통일된다.
  async function handleChange(delta: number): Promise<void> {
    const next = clamp(partySize + delta, 1, row.maxPartySize)
    try {
      await setPartySize(row, next)
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했습니다')
    }
  }

  const stepperButtonClass = 'h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2'

  return (
    // 마지막 행도 테두리 "박스"는 남기고 색만 지운다.
    <View
      testID="boss-profit-boss-row"
      className={`flex-row items-start gap-3 border-b p-4 ${
        props.isLast === true ? 'border-b-transparent' : 'border-border'
      }`}
    >
      {hasValuableDrop && <ValuableRowBackground />}

      <BossPortrait portraitSlug={findPortraitSlug(row.boss)} label={row.boss} size={BOSS_PORTRAIT_SIZE} />

      <View className="min-w-0 flex-1">
        {/* 이름 라인 전체가 드롭 시트 열기 버튼. 파티 스테퍼는 아래 줄이라 탭 충돌 없음. */}
        <Pressable
          role="button"
          onPress={() => setIsDropSheetOpen(true)}
          aria-label={`${row.boss} ${row.difficulty} 드롭 아이템 관리`}
          // h-6 고정. 자식(난이도 배지 20px · 보스명 20px · 드롭 지시자 24px) 중 최대값에
          // 높이를 맡기면 지시자 종류가 바뀔 때마다 행 높이가 흔들린다.
          className="h-6 w-full flex-row items-center gap-1.5"
        >
          <Badge variant={row.difficulty}>
            {row.difficulty}
          </Badge>
          <Text numberOfLines={1} className="shrink text-sm font-semibold text-text">
            {row.boss}
          </Text>
          <DropIndicator drops={props.drops} />
        </Pressable>

        <View className="mt-2 flex-row items-center justify-between gap-2">
          <View
            className={
              isEditable
                ? 'shrink-0 flex-row items-center gap-2 rounded-full border border-border px-1 py-0.5'
                : 'shrink-0 flex-row items-center gap-2 rounded-full border border-border px-1 py-0.5 opacity-40'
            }
          >
            <Pressable
              role="button"
              onPress={() => void handleChange(-1)}
              disabled={!canDecrease}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 감소`}
              className={`${stepperButtonClass}${canDecrease ? '' : ' opacity-40'}`}
            >
              <MinusIcon className="h-3 w-3 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
            <Text className="text-xs text-text" style={TABULAR_NUMS}>
              {partySize}
            </Text>
            <Pressable
              role="button"
              onPress={() => void handleChange(1)}
              disabled={!canIncrease}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 증가`}
              className={`${stepperButtonClass}${canIncrease ? '' : ' opacity-40'}`}
            >
              <PlusIcon className="h-3 w-3 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
          </View>

          {/* 금액을 모르는 행에 0 을 쓰지 않는다. 미완료는 아직 안 잡은 것이고 가격 미확정은
              참조 데이터에 값이 없는 것이라 둘 다 0메소 벌었다 가 아니다. 그래서 그 자리는
              금액이 아니라 배지가 선다. */}
          {!row.isComplete ? (
            <Badge variant="muted" className="shrink-0">
              미완료
            </Badge>
          ) : isPriceUnknown ? (
            <Badge variant="primary" className="shrink-0">
              가격 미확정
            </Badge>
          ) : // 아이템이 섞이면 **금액 아래에 칩이 선다**. 그 존재가 곧 "이 숫자는 결정석만이
          // 값을 매긴 아이템이 있다는 표시이고 동시에 내역을 여는 버튼이다. 값을 매긴 아이템이
          // 없으면 래퍼조차 만들지 않는다. 그 행의 트리가 종전과 달라지지 않아야 한다.
          dropTotal === 0 ? (
            amount
          ) : (
            // 순서는 앱 관례대로 주값(금액)이 위, 부가값(칩)이 아래다.
            <View className="items-end gap-1">
              {amount}
              <Pressable
                ref={itemChipRef}
                role="button"
                onPress={toggleItemPopover}
                aria-label={`${row.boss} 아이템 수익 확인`}
                aria-expanded={isItemPopoverOpen}
                className="h-5 shrink-0 flex-row items-center rounded-full bg-primary-tint px-2"
              >
                <Text className="text-11 font-bold leading-none text-primary-ink" style={TABULAR_NUMS}>
                  아이템 +{formatMesoShort(dropTotal)}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {isItemPopoverOpen && (
        <ItemRevenuePopover
          drops={props.drops}
          crystalMeso={row.payoutMeso ?? 0}
          itemMeso={dropTotal}
          anchor={itemAnchor}
          onClose={closeItemPopover}
        />
      )}

      {isDropSheetOpen && (
        <BossDropSheet
          boss={row.boss}
          difficulty={row.difficulty}
          isComplete={row.isComplete}
          initialDrops={props.drops}
          onSave={(drops) => setBossDrops(row, drops)}
          onClose={() => setIsDropSheetOpen(false)}
          // 기록한 자리에서 바로 값을 매긴다. 분배 기본값은 이 행의 파티원 수이고, 저장하면 그
          // 값과 독립한다. 나중에 파티원 수를 고쳐도 이미 매긴 금액이 흔들리지 않는다.
          pricing={{
            defaultShare: partySize,
            maxShare: row.maxPartySize,
            characterName: row.characterName,
          }}
        />
      )}
    </View>
  )
}
