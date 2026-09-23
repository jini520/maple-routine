/**
 * 직접 완료를 적는 시트. 넥슨이 완료를 안 주는 보스를 사용자가 완료로 남기는 자리다.
 *
 * 가계부 수입·지출 시트와 **같은 문법**이다. 머리는 제목과 날짜 고르개 한 줄, 본문은 라벨-값 줄
 * 목록, 바닥은 저장 줄이다. 새 모양을 만들지 않는다.
 *
 * 고칠 때는 같은 시트가 값을 물고 열리고 바닥에 `완료 취소` 가 한 줄 더 선다. 취소는 확인 창을
 * 거치는데, 그 기록의 드롭도 함께 지워지기 때문이다.
 */
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Badge, Text, MinusIcon, PlusIcon } from '../../components/atoms'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { DifficultySegment } from '../../components/molecules/DifficultySegment/DifficultySegment'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { findPriceEntry, getMaxPartySize } from '../../lib/boss/boss-crystal-prices'
import { getPeriodDateKeys } from '../../lib/boss/boss-profit-period'
import { supportedDifficultiesOf } from '../../lib/boss/bosses'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { monthKeyOf } from '../../lib/calendar'
import type { BossProfitRow } from '../../features/boss-profit/rows'
import { loadConfiguredPartySize } from '../../features/manual-completion/record'
import type { BossDifficulty } from '../../types'

export interface ManualCompletionSheetProps {
  row: BossProfitRow
  /** 이 시트가 새로 적는 자리인가, 이미 적은 것을 고치는 자리인가. */
  mode: 'create' | 'edit'
  /** 화면이 한 번만 만든 지금. 기간 판정과 라벨이 같은 시각을 봐야 한다. */
  now: Date
  onSave: (input: { difficulty: BossDifficulty; dateKey: string; partySize: number }) => Promise<void>
  onCancelCompletion?: () => void
  onClose: () => void
}

export function ManualCompletionSheet(props: ManualCompletionSheetProps): React.JSX.Element {
  const { row } = props
  const todayDateKey = getCurrentKstDateKey(props.now)
  // 그 기간의 첫날부터 오늘까지. 아직 오지 않은 날에 잡을 수는 없다.
  const periodDays = getPeriodDateKeys(row.cycle, row.periodKey)
  const minDateKey = periodDays[0] ?? todayDateKey
  const lastDay = periodDays[periodDays.length - 1] ?? todayDateKey
  const maxDateKey = lastDay < todayDateKey ? lastDay : todayDateKey

  const [difficulty, setDifficulty] = useState<BossDifficulty>(row.difficulty)
  const [dateKey, setDateKey] = useState(row.defeatedOn ?? maxDateKey)
  const [partySize, setPartySize] = useState(row.partySize ?? 1)
  // 사용자가 스테퍼를 만졌나. 파티 관리 값은 비동기로 오므로, 그 사이 손댄 값을 덮으면 안 된다.
  const partyTouched = useRef(false)
  const [monthKey, setMonthKey] = useState(monthKeyOf(row.defeatedOn ?? maxDateKey))
  const [saving, setSaving] = useState(false)

  const {
    ref: dateRef,
    isOpen: isCalendarOpen,
    anchor,
    toggle: toggleCalendar,
    close: closeCalendar,
  } = useAnchoredPopover()

  const difficulties = supportedDifficultiesOf(row.bossKey)
  const maxPartySize = getMaxPartySize(row.bossKey, difficulty)
  const priceMeso = findPriceEntry(row.bossKey, difficulty, row.periodKey, props.now)?.priceMeso ?? null
  const payoutMeso = priceMeso === null ? null : Math.floor(priceMeso / partySize)

  // **파티 관리에 설정된 그 보스 · 그 난이도의 인원으로 시작한다.** 파티 설정은 난이도마다 따로라
  // 난이도를 바꾸면 다시 찾는다. 고칠 때 처음 연 순간만은 적어 둔 값이 시작이다 - 그 기록에 사용자가
  // 이미 인원을 정했다.
  useEffect(() => {
    if (props.mode === 'edit' && difficulty === row.difficulty) return
    let alive = true
    partyTouched.current = false
    void loadConfiguredPartySize(row.ocid, row.bossKey, difficulty, row.periodKey).then((configured) => {
      if (!alive || configured === null || partyTouched.current) return
      setPartySize(Math.min(Math.max(configured, 1), getMaxPartySize(row.bossKey, difficulty)))
    })
    return () => {
      alive = false
    }
  }, [props.mode, row.ocid, row.bossKey, row.difficulty, row.periodKey, difficulty])

  function changePartySize(next: number): void {
    partyTouched.current = true
    setPartySize(next)
  }

  function changeDifficulty(next: BossDifficulty): void {
    setDifficulty(next)
    // 난이도마다 상한이 다르다(스우는 하드 6인 · 익스트림 2인). 넘치면 상한으로 내린다.
    const nextMax = getMaxPartySize(row.bossKey, next)
    if (partySize > nextMax) setPartySize(nextMax)
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await props.onSave({ difficulty, dateKey, partySize })
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <BottomSheet
        testId="manual-completion-sheet"
        label={props.mode === 'edit' ? '완료 기록 수정' : '완료 기록'}
        onClose={props.onClose}
        header={
          <View className="flex-row items-center justify-between gap-2">
            <Text className="shrink text-base font-bold text-text">
              {props.mode === 'edit' ? '완료 기록 수정' : '완료 기록'}
            </Text>
            <DateSelect ref={dateRef} dateKey={dateKey} label="잡은 날" onPress={toggleCalendar} />
          </View>
        }
        footer={
          <>
            <Pressable
              role="button"
              aria-label={props.mode === 'edit' ? '수정' : '완료 상태로 변경'}
              disabled={priceMeso === null || saving}
              onPress={() => void save()}
              className={`items-center rounded-xl py-3 ${
                priceMeso === null ? 'bg-surface-2' : 'bg-primary'
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  priceMeso === null ? 'text-text-disabled' : 'text-on-primary'
                }`}
              >
                {props.mode === 'edit' ? '수정' : '완료 상태로 변경'}
              </Text>
            </Pressable>

            {/* 취소는 **버튼처럼 안 생겼다.** 되돌릴 수 없는 일이라 두 번 눌러야 닿는다(가계부
                삭제와 같은 규칙). */}
            {props.mode === 'edit' && props.onCancelCompletion !== undefined && (
              <Pressable
                role="button"
                aria-label="완료 취소"
                onPress={props.onCancelCompletion}
                className="items-center py-2"
              >
                <Text className="text-xs font-semibold text-error-ink">완료 취소</Text>
              </Pressable>
            )}
          </>
        }
      >
        <View className="gap-3 px-4">
          <Row label="보스">
            <Text className="text-sm font-semibold text-text">{row.bossName}</Text>
          </Row>

          <Row label="난이도">
            <DifficultySegment
              difficulties={difficulties}
              selected={difficulty}
              onSelect={changeDifficulty}
            />
          </Row>

          <Row label="파티 인원">
            <View className="h-9 flex-row items-center gap-3 rounded-full border border-border px-2">
              <Pressable
                role="button"
                aria-label="파티 인원 줄이기"
                disabled={partySize <= 1}
                onPress={() => changePartySize(partySize - 1)}
                hitSlop={8}
              >
                <MinusIcon
                  className={`h-4 w-4 ${partySize > 1 ? 'text-text' : 'text-text-disabled'}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </Pressable>
              <Text className="min-w-6 text-center text-sm font-bold text-text" style={TABULAR_NUMS}>
                {partySize}
              </Text>
              <Pressable
                role="button"
                aria-label="파티 인원 늘리기"
                disabled={partySize >= maxPartySize}
                onPress={() => changePartySize(partySize + 1)}
                hitSlop={8}
              >
                <PlusIcon
                  className={`h-4 w-4 ${partySize < maxPartySize ? 'text-text' : 'text-text-disabled'}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </Pressable>
            </View>
          </Row>

          <Row label="결정석">
            {payoutMeso === null ? (
              <Badge variant="primary">가격 미확정</Badge>
            ) : (
              <Text className="text-sm font-bold text-text" style={TABULAR_NUMS}>
                {payoutMeso.toLocaleString()} 메소
              </Text>
            )}
          </Row>
        </View>
      </BottomSheet>

      {isCalendarOpen && (
        <CalendarPopover
          selected={dateKey}
          min={minDateKey}
          max={maxDateKey}
          monthKey={monthKey}
          anchor={anchor}
          onChangeMonth={setMonthKey}
          onSelect={(next) => {
            setDateKey(next)
            closeCalendar()
          }}
          onClose={closeCalendar}
        />
      )}
    </>
  )
}

/**
 * 라벨-값 한 줄. 가계부 시트의 `FieldRow` 와 같은 치수다.
 *
 * 그쪽을 그대로 부르지 않는 것은 그 파일이 가계부 화면의 것이라서다. 같은 모양이 두 화면에 있는
 * 것이 아니라 **같은 규격을 두 화면이 지킨다**(값 하나: `min-h-7` · `gap-3` · 아래 밑줄).
 */
function Row(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2">
      <Text className="shrink-0 text-xs text-text-muted">{props.label}</Text>
      <View className="flex-1 flex-row items-center justify-end">{props.children}</View>
    </View>
  )
}
