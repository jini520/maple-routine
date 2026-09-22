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
import { sumDropPayout } from '../../lib/drop/drop-price'
import { sortDropsForDisplay } from '../../lib/drop/drop-order'
import { dropItemIconOf } from '../../lib/assets/asset-lookup'
import type { RecordedDrop } from '../../types/drops'

import { AnimatedNumber, Badge, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { PartyShareSummary } from '../../components/molecules/PartyShareSummary/PartyShareSummary'
import { PartySizeModal, type PartyModalShares } from '../../components/organisms/PartySizeModal/PartySizeModal'
import { supportedDifficultiesOf } from '../../lib/boss/bosses'
import { partySizeForShares } from '../../lib/boss/party-shares'
import { partySizeKey } from '../../features/boss-scheduler/store'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { bossPortraitSlugOf } from '../../lib/boss/bosses'
import { BossDropSheet } from './BossDropSheet'
import { ManualCompletionButton } from './ManualCompletionButton'
import { ManualCompletionMark } from './ManualCompletionMark'
import { ManualCompletionSheet } from './ManualCompletionSheet'
import { ItemRevenueTrigger } from './ItemRevenueTrigger'
import { useBossProfitContext } from './boss-profit-context'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { useBossProfitStore } from '../../features/boss-profit/store'
import { useManualCompletionStore } from '../../features/manual-completion/store'
import { isManualCompletionOpen } from '../../lib/boss/manual-completion'
import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { AlertTriangleIcon } from '../../components/atoms'
import { ItemRevenuePopover } from './ItemRevenuePopover'

// BossPortrait의 size prop 기본값(40px, 기존 h-10 관례)과 동일하게 시작값을 맞춘다.
export const BOSS_PORTRAIT_SIZE = 40

export interface BossProfitBossRowProps {
  row: BossProfitRow
  drops: RecordedDrop[]
  /**
   * 목록의 마지막 행인지. RN 에 `:last-child` 가 없어 목록을 아는 부모가 알려 준다.
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
        const url = dropItemIconOf(drop.itemKey)
        return (
          <View
            key={`${drop.itemKey ?? drop.itemName}-${index}`}
            className="h-6 w-6 shrink-0"
            style={{ marginLeft: index === 0 ? 0 : -2, zIndex: shown.length - index }}
          >
            {url !== null ? (
              <Image source={url} resizeMode="contain" className="h-6 w-6" />
            ) : (
              <View className="h-6 w-6 rounded-md border-[1.5px] border-card-body bg-surface-2" />
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
          testID="drop-stack-more"
          className="h-6 w-6 items-center justify-center rounded-md border-[1.5px] border-card-body bg-surface-2"
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
  const { setRowParty, setBossDrops, now, partyShares } = useBossProfitContext()
  const [isDropSheetOpen, setIsDropSheetOpen] = useState(false)
  // 행의 `변경` 으로 여는 파티 모달. 인원과 비율을 함께 고친다.
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false)
  // 직접 완료 시트. `null` 이면 안 열려 있고, 그 밖의 값이 여는 까닭이다.
  const [manualSheet, setManualSheet] = useState<'create' | 'edit' | null>(null)
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)
  const openedBosses = useManualCompletionStore((state) => state.bosses)
  const saveManualCompletion = useBossProfitStore((state) => state.saveManualCompletion)
  const cancelManualCompletion = useBossProfitStore((state) => state.cancelManualCompletion)
  const characterIssue = useBossProfitStore((state) => state.characterIssues[row.ocid])
  // 구조 분해가 필수다. `popover.toggle` 처럼 프로퍼티로 읽으면 `react-hooks/refs` 가 그 접근을
  // 렌더 중 ref 접근으로 본다. 훅이 안에서 `useRef` 를 쓰기 때문이다.
  const { ref: itemChipRef, isOpen: isItemPopoverOpen, anchor: itemAnchor, toggle: toggleItemPopover, close: closeItemPopover } =
    useAnchoredPopover()
  const dropTotal = sumDropPayout(props.drops)
  // 아이콘 스택은 셋만 보여주므로 이 순서가 곧 무엇이 보이는가다. 팝오버도 같은 배열을 받아
  // 스택과 목록이 같은 차례로 선다.
  const drops = sortDropsForDisplay(props.drops)
  const isPriceUnknown = row.priceMeso === null
  /**
   * 이 행에서 직접 완료를 적을 수 있나. 넷이 모두 참이어야 한다.
   *
   * 서버가 그 보스를 열어 뒀고 · 아직 미완료이고 · 보고 있는 기간이 지금 기간이고 · 그 캐릭터를
   * 조회할 수 있어야 한다. 지난 기간은 지금 못 적는다 - 그 자리는 수익 수동 입력의 몫이다.
   */
  const canRecordManual =
    !row.isComplete &&
    characterIssue !== 'unavailable' &&
    row.periodKey === getCurrentBossProfitPeriod(row.cycle, now).periodKey &&
    isManualCompletionOpen(openedBosses, {
      bossKey: row.bossKey,
      cycle: row.cycle,
      periodKey: row.periodKey,
    })
  // 미완료(보스 스케줄러에 등록만 되고 아직 처치 전) placeholder는 파티원 수를 조정해도 의미가
  // 없다. 계산은 항상 0메소로 고정된다. "가격 미확정"과 동일한 비활성 처리를 재사용한다.
  const isEditable = row.isComplete && !isPriceUnknown
  const partySize = row.partySize ?? 1
  const settingShares = partyShares[partySizeKey(row.ocid, row.bossKey, row.difficulty)]
  /** 아이템 비율은 기록에 없다. 지금 설정된 값을 그린다. */
  const dropShares = {
    myShare: settingShares?.dropMyShare ?? null,
    sharesTotal: settingShares?.dropSharesTotal ?? null,
    splitFeePercent: settingShares?.splitFeePercent ?? null,
  }
  const recordShares = {
    myShare: row.crystalMyShare,
    sharesTotal: row.crystalSharesTotal,
    splitFeePercent: row.splitFeePercent,
  }

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
        identity={`boss|${row.ocid}|${row.bossKey}|${row.difficulty}|${row.periodKey}`}
        value={(row.payoutMeso ?? 0) + dropTotal}
      />
      {' 메소'}
    </Text>
  )

  // 예외 메시지를 그대로 렌더하지 않고 토스트로 알린다. 개발자용 문구와 SQLite 네이티브 원문이
  // 모달이 뜰 때의 값. 고치는 중인 값은 모달이 들고 있다가 적용할 때 한 번에 돌려준다.
  // 드롭 비율은 이 표에 없다.
  const modalShares: PartyModalShares = {
    crystalMyShare: row.crystalMyShare,
    crystalSharesTotal: row.crystalSharesTotal,
    dropMyShare: null,
    dropSharesTotal: null,
    splitFeePercent: row.splitFeePercent,
  }

  async function saveParty(input: { partySize: number; shares: PartyModalShares }): Promise<void> {
    try {
      // **이 자리는 설정이 아니라 그 행의 기록을 다시 센다.** 드롭 비율 칸은 이 표에 없어 버린다.
      await setRowParty(row, {
        partySize: input.partySize,
        shares: {
          myShare: input.shares.crystalMyShare,
          sharesTotal: input.shares.crystalSharesTotal,
          splitFeePercent: input.shares.splitFeePercent,
        },
      })
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했습니다')
    }
  }

  /** 적용을 누른 자리. 여기서 처음 쓴다. 끌기 한 번이 저장 아홉 번이 되지 않는 까닭이다. */
  async function applyParty(next: { partySize: number; shares: PartyModalShares }): Promise<void> {
    setIsPartyModalOpen(false)
    // 비율을 쓰면 두 쪽이라 2 다. 기록의 인원 칸도 화면과 같은 말을 해야 한다.
    await saveParty({
      partySize: partySizeForShares(
        {
          myShare: next.shares.crystalMyShare,
          sharesTotal: next.shares.crystalSharesTotal,
          splitFeePercent: null,
        },
        next.partySize,
      ),
      shares: next.shares,
    })
  }

  return (
    // 마지막 행도 테두리 "박스"는 남기고 색만 지운다.
    <View
      testID="boss-profit-boss-row"
      // 초상은 이름 줄이 아니라 **행 전체**의 세로 가운데다. `items-start` 면 오른쪽이 두 줄인
      // 행에서 초상만 위로 붙는다.
      className={`flex-row items-center gap-3 border-b p-4 ${
        props.isLast === true ? 'border-b-transparent' : 'border-border'
      }`}
    >
      <BossPortrait portraitSlug={bossPortraitSlugOf(row.bossKey)} label={row.bossName} size={BOSS_PORTRAIT_SIZE} />

      <View className="min-w-0 flex-1">
        {/* 이름 라인 전체가 드롭 시트 열기 버튼. 파티 스테퍼는 아래 줄이라 탭 충돌 없음. */}
        <Pressable
          role="button"
          onPress={() => setIsDropSheetOpen(true)}
          aria-label={`${row.bossName} ${DIFFICULTY_NAME[row.difficulty]} 드롭 아이템 관리`}
          // h-6 고정. 자식(난이도 배지 20px · 보스명 20px · 드롭 지시자 24px) 중 최대값에
          // 높이를 맡기면 지시자 종류가 바뀔 때마다 행 높이가 흔들린다.
          className="h-6 w-full flex-row items-center gap-1.5"
        >
          <Badge variant={row.difficulty}>
            {DIFFICULTY_NAME[row.difficulty]}
          </Badge>
          <Text numberOfLines={1} className="shrink text-sm font-semibold text-text">
            {row.bossName}
          </Text>
          {row.source === 'manual' && <ManualCompletionMark row={row} />}
          <DropIndicator drops={drops} />
        </Pressable>

        {canRecordManual ? (
          <ManualCompletionButton label={row.bossName} onPress={() => setManualSheet('create')} />
        ) : (
        <View className="mt-2 flex-row items-center justify-between gap-2">
          <PartyShareSummary
            label={`${row.characterName} ${row.bossName} ${DIFFICULTY_NAME[row.difficulty]}`}
            partySize={partySize}
            size="compact"
            // 결정석은 **이 기록이 굳힌 값**이다. 금액을 그 비율로 셌으므로 지금 설정을 그리면
            // 옆의 금액과 다른 말을 한다. 아이템은 기록에 없어 지금 설정을 그린다.
            crystal={recordShares}
            drop={dropShares}
            disabled={!isEditable}
            onPress={() => setIsPartyModalOpen(true)}
          />

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
          ) : // 아이템이 섞이면 **금액 자체가 내역을 여는 버튼**이 된다. 없으면 래퍼조차 만들지
          // 않는다. 그 행의 트리가 달라지지 않아야 한다.
          dropTotal === 0 ? (
            <View className="flex-row items-center gap-3.5">
              {row.source === 'manual' && (
                <Pressable
                  role="button"
                  aria-label={`${row.bossName} 기록 수정`}
                  onPress={() => setManualSheet('edit')}
                  hitSlop={8}
                  className="shrink-0 active:opacity-60"
                >
                  <Text className="text-11 font-bold text-primary-ink">수정</Text>
                </Pressable>
              )}
              {amount}
            </View>
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
        )}
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

      {isPartyModalOpen && (
        <PartySizeModal
          bossName={row.bossName}
          cycleLabel={row.cycle === 'monthly' ? '월간 보스' : '주간 보스'}
          portraitSlug={bossPortraitSlugOf(row.bossKey)}
          difficulties={supportedDifficultiesOf(row.bossKey)}
          difficulty={row.difficulty}
          partySize={partySize}
          maxPartySize={row.maxPartySize}
          shares={modalShares}
          // 이 기록의 난이도는 처치가 정한 사실이다. 여기서 못 바꾼다.
          onSelectDifficulty={() => {}}
          onApply={(next) => void applyParty(next)}
          // 적용을 안 눌렀으면 고친 값은 버린다.
          onClose={() => setIsPartyModalOpen(false)}
        />
      )}

      {manualSheet !== null && (
        <ManualCompletionSheet
          row={row}
          mode={manualSheet}
          now={now}
          onSave={async (input) => {
            try {
              // 직접 적는 완료는 그 기록의 비율을 설정값에서 이어받는다. 시트는 인원만 묻는다.
              await saveManualCompletion(row, { ...input, shares: recordShares })
            } catch {
              useToastStore.getState().showError('완료 기록을 저장하지 못했습니다')
            }
          }}
          onCancelCompletion={() => {
            // 시트를 먼저 닫는다. 확인 창이 시트 위에 서면 두 겹이 되고, 되돌릴 수 없는 일을
            // 묻는 자리가 다른 창에 가린다.
            setManualSheet(null)
            setIsCancelConfirmOpen(true)
          }}
          onClose={() => setManualSheet(null)}
        />
      )}

      {isCancelConfirmOpen && (
        <NoticeModal
          testId="manual-completion-cancel"
          icon={AlertTriangleIcon}
          tone="error"
          title="완료 기록을 취소할까요?"
          description={
            props.drops.length > 0
              ? `${row.bossName} 완료와 이 보스에 적은 드롭 ${props.drops.length}개가 함께 지워집니다. 되돌릴 수 없습니다.`
              : `${row.bossName} 완료 기록이 지워집니다. 되돌릴 수 없습니다.`
          }
          action={{ label: '그대로 두기', onPress: () => setIsCancelConfirmOpen(false) }}
          secondaryAction={{
            label: '완료 취소',
            danger: true,
            onPress: () => {
              setIsCancelConfirmOpen(false)
              void cancelManualCompletion(row).catch(() => {
                useToastStore.getState().showError('완료 기록을 취소하지 못했습니다')
              })
            },
          }}
          onClose={() => setIsCancelConfirmOpen(false)}
        />
      )}

      {isDropSheetOpen && (
        <BossDropSheet
          bossKey={row.bossKey}
          difficulty={row.difficulty}
          periodKey={row.periodKey}
          isComplete={row.isComplete}
          // 시트에는 **기록된 순서**를 넘긴다. 저장이 replace-all 이라 정렬한 배열을 넘기면
          // 그 순서가 `drop_index` 로 굳어, 보여 주려던 차례가 저장 계층까지 내려간다.
          initialDrops={props.drops}
          onSave={(drops) => setBossDrops(row, drops)}
          onClose={() => setIsDropSheetOpen(false)}
          // 기록한 자리에서 바로 값을 매긴다. 분배 기본값은 이 행의 파티원 수이고, 저장하면 그
          // 값과 독립한다. 나중에 파티원 수를 고쳐도 이미 매긴 금액이 흔들리지 않는다.
          pricing={{
            // 드롭 비율 칸은 이 표에 없다. 기록의 결정석 비율이 아니라 파티 인원으로 씨를
            // 뿌린다. 균등이면 합이 곧 인원 수라 지금 값과 같다.
            defaultShare: { myShare: 1, sharesTotal: partySize },
            characterName: row.characterName,
          }}
        />
      )}
    </View>
  )
}
