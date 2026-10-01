/**
 * 보스 추가 단계가 들고 있는 것. 고른 목록 · 보고 있는 캐릭터 · 날아오는 초상 · 열린 난이도 팝오버.
 *
 * 단계에 들어올 때(`begin`) 시트의 보스 목록을 그대로 받아 와 선택 줄에 둔다. `n개 추가` 를 눌러야 시트로
 * 돌아가고, 뒤로 가면 버린다.
 */
import { useMemo, useState } from 'react'

import { displayedBosses } from '../../features/boss-scheduler/displayed-bosses'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import {
  bossPickerSections,
  togglePick,
  type BossPickerSections,
  type PickerTile,
} from '../../features/party-appointments/boss-picker'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import type { PickerCharacter } from './BossPickerBody'
import type { Flight } from './BossPickerTray'

export interface BossPicker {
  begin: (current: readonly PartyAppointmentBoss[]) => void
  characters: PickerCharacter[]
  ocid: string
  setOcid: (ocid: string) => void
  sections: BossPickerSections
  picked: PartyAppointmentBoss[]
  setPicked: (next: PartyAppointmentBoss[]) => void
  flight: Flight | null
  endFlight: () => void
  pressTile: (tile: PickerTile, from: PopoverAnchorRect, measureFrom: Flight['measureFrom']) => void
  editing: { index: number; anchor: PopoverAnchorRect } | null
  openEditing: (index: number, anchor: PopoverAnchorRect) => void
  closeEditing: () => void
}

export function useBossPicker(): BossPicker {
  const characters = useBossSchedulerStore((state) => state.characters)
  const trackedOcids = useBossSchedulerStore((state) => state.trackedOcids)
  const partySizes = useBossSchedulerStore((state) => state.partySizes)
  const partyShares = useBossSchedulerStore((state) => state.partyShares)
  const manualTrackedByOcid = useBossSchedulerStore((state) => state.manualTrackedByOcid)
  const manualCompletedByOcid = useBossSchedulerStore((state) => state.manualCompletedByOcid)
  const { mode } = useTrackingModeStore()
  const selectedOcid = useCharacterSelectionStore((state) => state.selectedOcid)

  // 추적 차례대로. 추적 목록을 아직 못 읽었으면 동기화된 차례를 쓴다.
  const ordered = useMemo(() => {
    const byOcid = new Map(characters.map((character) => [character.ocid, character]))
    const order = trackedOcids ?? characters.map((character) => character.ocid)
    return order.flatMap((ocid) => {
      const character = byOcid.get(ocid)
      return character === undefined ? [] : [character]
    })
  }, [characters, trackedOcids])

  const registeredByOcid = useMemo(
    () =>
      new Map(
        ordered.map((character) => {
          const seen = new Set<string>()
          const tiles = [
            ...displayedBosses(character, 'monthly', mode, manualTrackedByOcid, manualCompletedByOcid),
            ...displayedBosses(character, 'weekly', mode, manualTrackedByOcid, manualCompletedByOcid),
          ].flatMap((boss): PickerTile[] => {
            if (boss.bossKey === null || seen.has(boss.bossKey)) return []
            seen.add(boss.bossKey)
            return [{ bossKey: boss.bossKey, difficulty: boss.difficulty }]
          })
          return [character.ocid, tiles]
        }),
      ),
    [ordered, mode, manualTrackedByOcid, manualCompletedByOcid],
  )

  const [ocid, setOcid] = useState(() =>
    ordered.some((character) => character.ocid === selectedOcid) ? (selectedOcid ?? '') : (ordered[0]?.ocid ?? ''),
  )
  const [picked, setPicked] = useState<PartyAppointmentBoss[]>([])
  const [flight, setFlight] = useState<Flight | null>(null)
  const [flightSeq, setFlightSeq] = useState(0)
  const [editing, setEditing] = useState<BossPicker['editing']>(null)

  const sections = useMemo(
    () =>
      bossPickerSections({ ocid, registered: registeredByOcid.get(ocid) ?? [], partySizes, partyShares }),
    [ocid, registeredByOcid, partySizes, partyShares],
  )

  function pressTile(tile: PickerTile, from: PopoverAnchorRect, measureFrom: Flight['measureFrom']): void {
    const next = togglePick(picked, ocid, tile)
    setPicked(next)
    // 넣을 때만 난다. 뺄 때는 선택 줄에서 사라지기만 한다.
    if (next.length > picked.length) {
      const id = flightSeq + 1
      setFlightSeq(id)
      setFlight({ id, boss: next[next.length - 1]!, from, measureFrom })
    }
  }

  return {
    begin: (current) => {
      setPicked([...current])
      setFlight(null)
      setEditing(null)
    },
    characters: ordered.map((character) => ({
      ocid: character.ocid,
      name: character.characterName,
      level: character.level ?? null,
      registeredCount: registeredByOcid.get(character.ocid)?.length ?? 0,
    })),
    ocid,
    setOcid,
    sections,
    picked,
    setPicked,
    flight,
    endFlight: () => setFlight(null),
    pressTile,
    editing,
    openEditing: (index, anchor) => setEditing({ index, anchor }),
    closeEditing: () => setEditing(null),
  }
}
