/**
 * 계산기의 보스 선택 시트. 파티 스케줄과 같은 보스 선택 화면을 계산기용으로 연다.
 *
 * 시트 안에서 캐릭터를 바꾸지 못한다. 레일에서 이미 골랐기 때문이다. 지금 고른 보스를 선택 줄에 담고 열고, `적용` 을
 * 눌러야 계산기에 들어간다. 닫으면 버린다.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { CharacterAvatar } from '../../../components/molecules/CharacterAvatar/CharacterAvatar'
import { BottomSheet } from '../../../components/organisms/BottomSheet/BottomSheet'
import { BossDifficultyPopover } from '../../../components/organisms/BossPicker/BossDifficultyPopover'
import { BossPickerBody } from '../../../components/organisms/BossPicker/BossPickerBody'
import { BossPickerTray, type Flight } from '../../../components/organisms/BossPicker/BossPickerTray'
import { calculatorPickerSections, isPickLocked, toggleCalculatorPick } from '../../../features/boss-profit-calculator/picker'
import { bossWithPartySetting } from '../../../features/boss-profit-calculator/store'
import type { PickerTile } from '../../../features/party-appointments/boss-picker'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'
import type { CalculatorBoss } from '../../../lib/boss/boss-profit-calculator'
import { getMaxPartySize, isSeasonBoss, WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss/bosses'
import type { BossDifficulty } from '../../../types'
import type { PartyAppointmentBoss } from '../../../types/party-appointment'

/** 시트 높이 하한. 파티 스케줄의 보스 추가 단계와 같다 */
const MIN_HEIGHT_RATIO = 0.65

export interface PickerCharacterInfo {
  ocid: string
  name: string
  imageUrl: string | null
  worldKey: string | null | undefined
}

export function CalculatorBossPickerSheet(props: {
  character: PickerCharacterInfo
  /** 보스 관리에 등록한 주간 보스 */
  registered: readonly PickerTile[]
  initial: readonly CalculatorBoss[]
  onApply: (bosses: CalculatorBoss[]) => void
  onClose: () => void
}): React.JSX.Element {
  const { ocid } = props.character
  const [picked, setPicked] = useState<CalculatorBoss[]>(() => [...props.initial])
  const [flight, setFlight] = useState<Flight | null>(null)
  const [flightSeq, setFlightSeq] = useState(0)
  const [editing, setEditing] = useState<{ index: number; anchor: PopoverAnchorRect } | null>(null)
  const [sections] = useState(() =>
    calculatorPickerSections({ worldKey: props.character.worldKey, registered: props.registered, now: new Date() }),
  )

  // 선택 줄은 캐릭터 하나의 보스만 든다. 줄 부품이 캐릭터를 함께 받는 모양이라 여기서 붙인다.
  const trayPicked: PartyAppointmentBoss[] = picked.map((boss) => ({ bossKey: boss.bossKey, difficulty: boss.difficulty, ocid }))
  const counted = picked.filter((boss) => !isSeasonBoss(boss.bossKey)).length
  const editingBoss = editing === null ? null : picked[editing.index] ?? null

  function pressTile(tile: PickerTile, from: PopoverAnchorRect, measureFrom: Flight['measureFrom']): void {
    const next = toggleCalculatorPick(picked, tile, (one) => bossWithPartySetting(ocid, one.bossKey, one.difficulty as BossDifficulty))
    setPicked(next)
    // 넣을 때만 난다. 뺄 때는 선택 줄에서 사라지기만 한다.
    if (next.length > picked.length) {
      const id = flightSeq + 1
      setFlightSeq(id)
      setFlight({ id, boss: { bossKey: tile.bossKey, difficulty: tile.difficulty, ocid }, from, measureFrom })
    }
  }

  return (
    <>
      <BottomSheet
        testId="calculator-boss-picker"
        label="보스 선택"
        minHeightRatio={MIN_HEIGHT_RATIO}
        onClose={props.onClose}
        header={<Text className="text-base font-bold text-text">보스 선택</Text>}
        footer={
          <BossPickerTray
            picked={trayPicked}
            grouped={false}
            countLabel={`${counted} / ${WEEKLY_BOSS_CLEAR_LIMIT}`}
            confirmLabel="적용"
            emptyLabel="보스를 선택해주세요"
            flight={flight}
            onFlightDone={() => setFlight(null)}
            onPressItem={(index, anchor) => setEditing({ index, anchor })}
            onConfirm={() => props.onApply(picked)}
          />
        }
      >
        <BossPickerBody
          character={
            <View className="h-10 flex-row items-center gap-2 self-start rounded-full bg-surface pl-1.5 pr-4">
              <CharacterAvatar imageUrl={props.character.imageUrl} name={props.character.name} size={28} className="bg-surface-2" />
              <Text className="text-sm font-semibold text-text">{props.character.name}</Text>
            </View>
          }
          groups={[
            { key: 'season', label: '시즌 보스', tiles: sections.season },
            { key: 'scheduler', label: '스케줄러', tiles: sections.scheduler },
            { key: 'all', label: '모든 보스', tiles: sections.all, onlyWithAll: true },
          ]}
          isSelected={(tile) => picked.some((boss) => boss.bossKey === tile.bossKey)}
          isLocked={(tile) => isPickLocked(picked, tile)}
          onPressTile={pressTile}
        />
      </BottomSheet>
      {editing !== null && editingBoss !== null && (
        <BossDifficultyPopover
          bossKey={editingBoss.bossKey}
          difficulty={editingBoss.difficulty}
          anchor={editing.anchor}
          onSelect={(value) => {
            const difficulty = value as BossDifficulty
            // 난이도마다 최대 인원이 다르다. 넘는 인원은 그 난이도의 최대로 내린다.
            setPicked(
              picked.map((boss, at) =>
                at === editing.index
                  ? { ...boss, difficulty, partySize: Math.min(boss.partySize, getMaxPartySize(boss.bossKey, difficulty)) }
                  : boss,
              ),
            )
            setEditing(null)
          }}
          onRemove={() => {
            setPicked(picked.filter((_, at) => at !== editing.index))
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
