/**
 * 주간 보스 수익 계산기. 캐릭터마다 주간 보스를 골라 한 주에 얼마를 버는지 따져 본다.
 *
 * 보스 수익 화면은 실제로 잡은 보스만 세서 아직 안 잡은 주에는 0 이다. 그래서 유틸리티에 따로 둔 도구다.
 * 상태와 기록은 `features/boss-profit-calculator` 가 들고, 여기서 고친 값은 보스 관리에 쓰지 않는다.
 * 금액은 값을 고칠 때마다 바로 다시 세므로 계산 버튼이 없다.
 */
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Badge, EllipsisIcon, FileTextIcon, HistoryIcon, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { AnchoredPopover } from '../../components/molecules/Popover/Popover'
import { CharacterRail, type CharacterRailEntry } from '../../components/organisms/CharacterRail/CharacterRail'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { PartySizeModal } from '../../components/organisms/PartySizeModal/PartySizeModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useBossProfitCalculatorStore, type CalculatorSaveMode } from '../../features/boss-profit-calculator/store'
import { displayedBosses } from '../../features/boss-scheduler/displayed-bosses'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { resolveSelectedCharacter } from '../../features/character-selection/selected-character'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import type { PickerTile } from '../../features/party-appointments/boss-picker'
import { useToastStore } from '../../features/toast/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { bossPayoutMeso, totalPayoutMeso, type CalculatorBoss } from '../../lib/boss/boss-profit-calculator'
import {
  activeDifficultiesNow,
  bossAliasOf,
  bossNameOf,
  bossPortraitSlugOf,
  getMaxPartySize,
  isSeasonBoss,
  WEEKLY_BOSS_CLEAR_LIMIT,
} from '../../lib/boss/bosses'
import { formatMesoUnits } from '../../lib/drop/drop-price'
import { useBottomSafeAreaPx } from '../../lib/safe-area'
import { boxShadowOf, type ShadowLayer } from '../../lib/shadow'
import { orderByTracked } from '../../lib/scheduler/tracked-order'
import { useThemeAppearance } from '../../theme/context'
import { BossRow } from './boss-profit-calculator/BossRow'
import { CalculatorBossPickerSheet } from './boss-profit-calculator/CalculatorBossPickerSheet'
import { TotalCard } from './boss-profit-calculator/TotalCard'
import { BOSS_PROFIT_CALCULATOR_TOOL_NAME } from './tool-names'

/** 바닥 고정 영역이 내용 위로 드리우는 그림자. 구분선 대신 이것이 둘을 가른다 */
const BAR_SHADOW: ShadowLayer = { opacity: 0.23, radius: 12, y: -10 }

/** 면 카드의 그림자 두 겹. 테두리가 없어 이것이 카드를 바탕에서 띄운다 */
const CARD_LIFT: readonly ShadowLayer[] = [
  { opacity: 0.14, radius: 1, y: 1 },
  { opacity: 0.17, radius: 12, y: 8 },
]

export function BossProfitCalculatorScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const { definition } = useThemeAppearance()
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const scheduler = useBossSchedulerStore()
  const { mode } = useTrackingModeStore()
  const { selectedOcid, select } = useCharacterSelectionStore()
  const calculator = useBossProfitCalculatorStore()
  const [now] = useState(() => new Date())
  const [barHeight, setBarHeight] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [partyBossKey, setPartyBossKey] = useState<string | null>(null)
  const [askingSave, setAskingSave] = useState(false)
  const menuRef = useRef<View>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<PopoverAnchorRect | null>(null)

  // 보스 관리 값이 첫 값이 될 수 있어 스케줄러 스토어부터 채운다. 보스 관리 화면과 같다.
  useEffect(() => {
    scheduler.loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 화면에 들어올 때마다 모든 캐릭터가 빈 상태로 연다. 계산 기록 화면은 이 화면 위에 쌓여 다녀와도 다시 열리지 않는다.
  // 캐릭터를 읽은 뒤에 연다. 동기화가 실패해도(`error`) 스토어는 마지막으로 본 캐릭터를 들고 있다.
  const schedulerSettled =
    scheduler.status === 'loaded' || scheduler.status === 'error' || scheduler.characters.length > 0
  const openedHere = useRef(false)
  const { open } = calculator
  useEffect(() => {
    if (!schedulerSettled || openedHere.current) return
    openedHere.current = true
    void open()
  }, [schedulerSettled, open])

  const characters = orderByTracked(scheduler.characters, scheduler.trackedOcids ?? [])
  const selected = resolveSelectedCharacter(selectedOcid, characters)
  const cardShadow = { boxShadow: CARD_LIFT.map((layer) => boxShadowOf(definition.shadowColor, layer)).join(', ') }

  const bossesOf = (ocid: string): CalculatorBoss[] => calculator.bossesByOcid[ocid] ?? []
  const selectedBosses = selected === null ? [] : bossesOf(selected.ocid)
  const partyBoss = selectedBosses.find((boss) => boss.bossKey === partyBossKey) ?? null

  // 보스 관리에 등록한 주간 보스. 보스 선택 시트의 `스케줄러` 묶음이다.
  const seen = new Set<string>()
  const registered: PickerTile[] =
    selected === null
      ? []
      : displayedBosses(selected, 'weekly', mode, scheduler.manualTrackedByOcid, null, now).flatMap((boss) => {
          if (boss.bossKey === null || seen.has(boss.bossKey)) return []
          seen.add(boss.bossKey)
          return [{ bossKey: boss.bossKey, difficulty: boss.difficulty }]
        })

  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    rings: [],
  }))

  async function save(how: CalculatorSaveMode): Promise<void> {
    setAskingSave(false)
    try {
      await calculator.save(how, new Date())
      useToastStore.getState().showSuccess('결과를 저장했어요')
    } catch {
      useToastStore.getState().showError('결과를 저장하지 못했습니다')
    }
  }

  const selectedName = selected === null ? '' : selected.characterName
  const selectedTotal = totalPayoutMeso(selectedBosses, now)
  // 시즌 보스는 주간 12개 한도에 세지 않는다.
  const countedBosses = selectedBosses.filter((boss) => !isSeasonBoss(boss.bossKey)).length

  return (
    <View className="flex-1">
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow
              className="gap-2"
              trailing={
                <Pressable
                  role="button"
                  aria-label="계산 기록"
                  onPress={() => navigation.navigate('UtilityBossProfitCalculatorRecords')}
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface-2 active:opacity-60"
                >
                  <HistoryIcon className="h-[19px] w-[19px] text-text" strokeWidth={2} aria-hidden />
                </Pressable>
              }
            >
              <BackButton onPress={() => navigation.goBack()} />
              <Text className="text-lg font-semibold text-text">{BOSS_PROFIT_CALCULATOR_TOOL_NAME}</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View testID="screen-UtilityBossProfitCalculator" style={{ paddingBottom: barHeight }}>
          {!calculator.loaded ? (
            <View className="px-4 pb-4">
              <LoadingState size="page" message="불러오고 있어요" />
            </View>
          ) : selected === null ? (
            <View className="px-4 pb-4">
              <Text className="text-sm text-text-muted">
                캐릭터를 먼저 선택해주세요. 설정의 ‘캐릭터 관리’에서 추가할 수 있어요.
              </Text>
            </View>
          ) : (
            <>
              <TotalCard
                characters={characters.map((character) => ({
                  ocid: character.ocid,
                  name: character.characterName,
                  meso: totalPayoutMeso(bossesOf(character.ocid), now),
                }))}
                bossCount={characters.reduce((sum, character) => sum + bossesOf(character.ocid).length, 0)}
                selectedOcid={selected.ocid}
                style={cardShadow}
              />
              <View className="pb-4 pt-3.5">
                <CharacterRail
                  entries={railEntries}
                  selectedOcid={selected.ocid}
                  emptyRing="thick"
                  onSelect={(ocid) => void select(ocid)}
                />
              </View>

              <View className="mx-4 rounded-[22px] bg-surface pb-1.5" style={cardShadow}>
                {/* 보스가 있든 없든 같은 머리로 시작한다. 빈 상태와 보스가 있는 상태가 같은 카드라 화면이 덜 바뀐다. */}
                <View className="flex-row items-center gap-2 pb-2.5 pl-4 pr-3 pt-3.5">
                  <View className="flex-1 flex-row">
                    {selectedBosses.length === 0 ? (
                      <Text className="text-xs text-text-muted">이 캐릭터가 잡을 보스를 선택하세요</Text>
                    ) : (
                      <Badge testID="calculator-boss-count" variant="primary" style={TABULAR_NUMS}>
                        {`${countedBosses} / ${WEEKLY_BOSS_CLEAR_LIMIT}`}
                      </Badge>
                    )}
                  </View>
                  <Pressable
                    role="button"
                    aria-label="보스 선택"
                    onPress={() => setPickerOpen(true)}
                    className="h-7 justify-center rounded-full bg-primary-tint px-[11px] active:opacity-60"
                  >
                    <Text className="text-xs font-bold text-primary-ink">보스 선택</Text>
                  </Pressable>
                  <Pressable
                    ref={menuRef}
                    role="button"
                    aria-label="더 보기"
                    onPress={() => {
                      setMenuOpen(true)
                      menuRef.current?.measureInWindow((left, top, width, height) => setMenuAnchor({ left, top, width, height }))
                    }}
                    className="h-7 w-7 items-center justify-center rounded-full bg-bg active:opacity-60"
                  >
                    <EllipsisIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2.5} aria-hidden />
                  </Pressable>
                </View>
                {selectedBosses.map((boss) => (
                  <BossRow
                    key={boss.bossKey}
                    boss={boss}
                    payoutMeso={bossPayoutMeso(boss, now)}
                    onChangeDifficulty={(difficulty) =>
                      calculator.updateBoss(selected.ocid, boss.bossKey, {
                        difficulty,
                        // 난이도마다 최대 인원이 다르다. 넘는 인원은 그 난이도의 최대로 내린다.
                        partySize: Math.min(boss.partySize, getMaxPartySize(boss.bossKey, difficulty)),
                      })
                    }
                    onChangePartySize={(partySize) => calculator.updateBoss(selected.ocid, boss.bossKey, { partySize })}
                    onOpenParty={() => setPartyBossKey(boss.bossKey)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScreenScroll>

      {/* 스크롤 뷰의 형제이자 절대 배치라 굴러가지 않는다. 잰 높이만큼 내용 아래를 비운다. */}
      {calculator.loaded && selected !== null && (
        <View
          testID="calculator-save-bar"
          className="absolute inset-x-0 bottom-0 gap-2.5 bg-bg px-4 pt-3"
          style={{ paddingBottom: bottomSafeAreaPx + 12, boxShadow: boxShadowOf(definition.shadowColor, BAR_SHADOW) }}
          onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
        >
          {/* 어느 캐릭터의 카드를 보고 있든 그 캐릭터의 합이 늘 같은 자리에 보인다. */}
          <View className="flex-row items-center gap-2 px-1 py-2">
            <CharacterAvatar imageUrl={selected.imageUrl ?? null} name={selectedName} size={28} className="bg-surface-2" />
            <Text className="text-13 font-semibold text-text">{selectedName} 주간 수익</Text>
            <Text
              testID="calculator-character-total"
              className={`ml-auto text-lg font-bold ${selectedTotal === 0 ? 'text-text-disabled' : 'text-text'}`}
              style={TABULAR_NUMS}
            >
              {formatMesoUnits(selectedTotal)}
            </Text>
          </View>
          <Pressable
            role="button"
            aria-label="결과 저장"
            onPress={() => {
              // 연 기록이 없으면 묻지 않는다. 덮을 것이 없다.
              if (calculator.openedId === null) void save('new')
              else setAskingSave(true)
            }}
            className="h-[52px] items-center justify-center rounded-full bg-primary active:opacity-80"
          >
            <Text className="text-base font-bold text-on-primary">결과 저장</Text>
          </Pressable>
        </View>
      )}

      {pickerOpen && selected !== null && (
        <CalculatorBossPickerSheet
          character={{
            ocid: selected.ocid,
            name: selectedName,
            imageUrl: selected.imageUrl ?? null,
            worldKey: selected.worldKey,
          }}
          registered={registered}
          initial={selectedBosses}
          onApply={(bosses) => {
            calculator.setBosses(selected.ocid, bosses)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {partyBoss !== null && selected !== null && (
        <PartySizeModal
          bossName={bossAliasOf(partyBoss.bossKey, bossNameOf(partyBoss.bossKey, partyBoss.bossKey))}
          cycleLabel="주간 보스"
          portraitSlug={bossPortraitSlugOf(partyBoss.bossKey)}
          difficulties={activeDifficultiesNow(partyBoss.bossKey)}
          difficulty={partyBoss.difficulty}
          partySize={partyBoss.partySize}
          maxPartySize={getMaxPartySize(partyBoss.bossKey, partyBoss.difficulty)}
          shares={{
            crystalMyShare: partyBoss.shares.myShare,
            crystalSharesTotal: partyBoss.shares.sharesTotal,
            splitFeePercent: partyBoss.shares.splitFeePercent,
          }}
          // 난이도는 보스 줄의 고르개가 정한다. 모달에서 또 고치면 어느 쪽이 이기는지 흐려진다.
          onSelectDifficulty={() => {}}
          // 값만 받아 계산기에 넣는다. 보스 관리의 파티 설정에는 쓰지 않는다.
          onApply={(next) => {
            calculator.updateBoss(selected.ocid, partyBoss.bossKey, {
              partySize: next.partySize,
              shares: {
                myShare: next.shares.crystalMyShare,
                sharesTotal: next.shares.crystalSharesTotal,
                splitFeePercent: next.shares.splitFeePercent,
              },
            })
            setPartyBossKey(null)
          }}
          onClose={() => setPartyBossKey(null)}
        />
      )}

      {menuOpen && selected !== null && (
        <AnchoredPopover
          testID="calculator-boss-menu"
          ariaLabel="보스 카드 메뉴"
          closeLabel="메뉴 닫기"
          anchor={menuAnchor}
          onClose={() => {
            setMenuOpen(false)
            setMenuAnchor(null)
          }}
          width={184}
          className="p-1.5"
        >
          <Pressable
            role="menuitem"
            aria-label="보스 관리 값 가져오기"
            onPress={() => {
              calculator.importFromBossManage(selected.ocid, new Date())
              setMenuOpen(false)
              setMenuAnchor(null)
            }}
            className="h-10 justify-center rounded-[10px] px-3 active:bg-bg"
          >
            <Text className="text-13 font-semibold text-text">보스 관리 값 가져오기</Text>
          </Pressable>
          {/* 지울 보스가 없으면 초기화를 두지 않는다. */}
          {selectedBosses.length > 0 && (
            <Pressable
              role="menuitem"
              aria-label="초기화"
              onPress={() => {
                calculator.clearCharacter(selected.ocid)
                setMenuOpen(false)
                setMenuAnchor(null)
              }}
              className="h-10 justify-center rounded-[10px] px-3 active:bg-bg"
            >
              <Text className="text-13 font-semibold text-error-ink">초기화</Text>
            </Pressable>
          )}
        </AnchoredPopover>
      )}

      {askingSave && (
        <NoticeModal
          testId="calculator-save-choice"
          icon={FileTextIcon}
          tone="primary"
          title="기존 저장된 기록에 덮어쓸까요?"
          description="새 기록으로 따로 남길 수도 있어요."
          action={{ label: '덮기', onPress: () => void save('overwrite') }}
          secondaryAction={{ label: '새 기록으로', onPress: () => void save('new') }}
          onClose={() => setAskingSave(false)}
        />
      )}
    </View>
  )
}
