/**
 * 약속을 적고 보고 고치는 시트. FAB 를 누르면 추가로, 보드 블록을 누르면 상세로 열린다.
 *
 * 상세는 추가 시트의 읽기 모드다(고르개 · 손잡이 · `✕` · 보스 추가 칸 없음, 알림 · 반복은 타일). 바닥의 `수정` 을
 * 누르면 같은 시트가 수정 모드가 되고, 반복 약속이면 저장 위에 `이 주만 적용하기` 가 선다. 지난 주 약속은 읽기만 한다.
 *
 * 위에서부터 시작 · 종료 띠, 보스 목록, 알림, 매주 반복이고 바닥에 저장이 고정된다. 저장은 보스가
 * 하나 이상이고 종료가 시작보다 늦을 때만 켜진다. 같은 캐릭터 · 같은 보스의 약속이 있어도 묻지 않는다.
 *
 * `+ 보스 추가` 는 같은 시트 안에서 단계를 바꾼다(`stepKey`). 보스 추가 단계는 머리 · 본문 · 바닥을 통째로
 * 갈아 끼우고, `n개 추가` 로 돌아오면 고른 목록이 시트의 보스 목록이 된다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { AlertTriangleIcon, CheckBox, ChevronLeftIcon, Text } from '../../components/atoms'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import {
  canSave,
  durationOf,
  initialDraft,
  newAppointmentId,
  toAppointment,
  type AppointmentDraft,
} from '../../features/party-appointments/draft'
import { applyDelete, applyEdit, draftFromOccurrence, isPastWeek } from '../../features/party-appointments/edit'
import { alarmsOnDate } from '../../features/party-appointments/guards'
import { usePartyAppointmentsStore } from '../../features/party-appointments/store'
import { WEEKDAY_LABELS } from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'
import { AppointmentAlarmField } from './AppointmentAlarmField'
import { AppointmentBossList } from './AppointmentBossList'
import { AppointmentSummaryTiles } from './AppointmentSummaryTiles'
import { AppointmentTimeBand } from './AppointmentTimeBand'
import { BossDifficultyPopover } from './BossDifficultyPopover'
import { BossPickerBody } from './BossPickerBody'
import { BossPickerTray } from './BossPickerTray'
import { useBossPicker } from './useBossPicker'

/** 보스 추가 단계의 시트 높이 하한(화면의 65%, 사용자 지정) */
const BOSS_STEP_MIN_HEIGHT_RATIO = 0.65

/** 상세로 열 때 누른 회차와 그 회차가 든 리셋 주 */
export interface AppointmentSheetTarget {
  occurrence: PartyAppointmentOccurrence
  weekStart: string
}

type Step = 'view' | 'form' | 'bosses'

export interface AppointmentSheetProps {
  /** 없으면 추가, 있으면 그 회차의 상세로 연다 */
  target?: AppointmentSheetTarget
  names: ReadonlyMap<string, string>
  colorOf: (ocid: string) => string
  onClose: () => void
}

export function AppointmentSheet(props: AppointmentSheetProps): React.JSX.Element {
  const appointments = usePartyAppointmentsStore((state) => state.appointments)
  const save = usePartyAppointmentsStore((state) => state.save)
  const { target } = props
  const [now] = useState(() => new Date())
  const [draft, setDraft] = useState<AppointmentDraft>(() =>
    target === undefined ? initialDraft(now) : draftFromOccurrence(target.occurrence),
  )
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<Step>(target === undefined ? 'form' : 'view')
  const [thisWeekOnly, setThisWeekOnly] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const picker = useBossPicker()
  const todayKey = getCurrentKstDateKey(now)
  const editing = target !== undefined
  const repeating = target?.occurrence.appointment.schedule.type === 'weekly'
  const past = target !== undefined && isPastWeek(target.weekStart, todayKey)

  function update(patch: Partial<AppointmentDraft>): void {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const endInvalid = durationOf(draft) <= 0
  const savable = canSave(draft) && !saving
  const weekday = WEEKDAY_LABELS[new Date(`${draft.startDateKey}T00:00:00Z`).getUTCDay()]

  async function submit(): Promise<void> {
    if (!savable) return
    setSaving(true)
    try {
      const id = newAppointmentId(new Date())
      await save(
        target === undefined
          ? [...appointments, toAppointment(draft, id)]
          : applyEdit(appointments, target.occurrence.appointment, target.weekStart, draft, {
              thisWeekOnly: repeating && thisWeekOnly,
              newId: id,
            }),
      )
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  async function remove(): Promise<void> {
    if (target === undefined) return
    setConfirmingDelete(false)
    await save(applyDelete(appointments, target.occurrence.appointment, target.weekStart))
    props.onClose()
  }

  const inBosses = step === 'bosses'
  const inView = step === 'view'
  const startDate = new Date(`${draft.startDateKey}T00:00:00Z`)
  const editingIndex = picker.editing?.index ?? null
  const editingBoss = editingIndex === null ? undefined : picker.picked[editingIndex]

  const viewHeader = <Text className="text-base font-bold text-text">약속</Text>
  const formHeader = editing ? (
    <Pressable
      role="button"
      aria-label="상세로 돌아가기"
      onPress={() => {
        // 고치던 값은 버린다. 상세는 저장된 회차를 보여 준다.
        if (target !== undefined) setDraft(draftFromOccurrence(target.occurrence))
        setThisWeekOnly(false)
        setStep('view')
      }}
      className="flex-row items-center gap-1 self-start active:opacity-60"
    >
      <ChevronLeftIcon className="h-5 w-5 text-text" strokeWidth={2} aria-hidden />
      <Text className="text-base font-bold text-text">약속 수정</Text>
    </Pressable>
  ) : (
    <Text className="text-base font-bold text-text">약속 추가</Text>
  )
  const bossesHeader = (
    <Pressable
      role="button"
      aria-label="뒤로"
      onPress={() => setStep('form')}
      className="flex-row items-center gap-1 self-start active:opacity-60"
    >
      <ChevronLeftIcon className="h-5 w-5 text-text" strokeWidth={2} aria-hidden />
      <Text className="text-base font-bold text-text">보스 추가</Text>
    </Pressable>
  )

  const viewFooter = past ? (
    <Text className="py-2 text-center text-13 text-text-muted">지난 주 약속은 볼 수만 있어요</Text>
  ) : (
    // 다른 시트와 같은 바닥. 전폭 주 버튼 아래에 되돌릴 수 없는 동작을 작은 빨간 글자로 둔다.
    <View className="gap-1">
      <Pressable
        role="button"
        aria-label="수정"
        onPress={() => setStep('form')}
        className="items-center rounded-xl bg-primary py-3 active:opacity-80"
      >
        <Text className="text-sm font-bold text-on-primary">수정</Text>
      </Pressable>
      <Pressable role="button" aria-label="삭제" onPress={() => setConfirmingDelete(true)} className="items-center py-2">
        <Text className="text-xs font-semibold text-error-ink">삭제</Text>
      </Pressable>
    </View>
  )

  const formFooter = (
    <View className="gap-3">
      {editing && repeating && (
        // 추가 시트에서 반복 체크가 있던 자리. 끄면 이 주부터 앞으로 모두, 켜면 이 주 회차만 바뀐다.
        <Pressable
          role="checkbox"
          aria-label="이 주만 적용하기"
          aria-checked={thisWeekOnly}
          onPress={() => setThisWeekOnly(!thisWeekOnly)}
          className="flex-row items-center gap-2 self-start"
        >
          <CheckBox checked={thisWeekOnly} />
          <Text className="text-sm font-medium text-text">이 주만 적용하기</Text>
          <Text className="text-xs text-text-muted">
            {startDate.getUTCMonth() + 1}/{startDate.getUTCDate()} ({weekday})
          </Text>
        </Pressable>
      )}
      <Pressable
        role="button"
        aria-label="저장"
        disabled={!savable}
        onPress={() => void submit()}
        className={`items-center rounded-xl py-3 ${savable ? 'bg-primary' : 'bg-surface-2'}`}
      >
        <Text className={`text-sm font-bold ${savable ? 'text-on-primary' : 'text-text-disabled'}`}>저장</Text>
      </Pressable>
    </View>
  )
  const bossesFooter = (
    <BossPickerTray
      picked={picker.picked}
      colorOf={props.colorOf}
      flight={picker.flight}
      onFlightDone={picker.endFlight}
      onReorder={picker.setPicked}
      onPressItem={picker.openEditing}
      onConfirm={() => {
        update({ bosses: picker.picked })
        setStep('form')
      }}
    />
  )

  const formBody = (
    // 띠 · 보스 · 알림 사이 20, 알림과 바닥 줄 사이에 8 을 더 둔다.
    <View className="gap-5 pb-2">
      <AppointmentTimeBand
        todayKey={todayKey}
        startDateKey={draft.startDateKey}
        startMinutes={draft.startMinutes}
        endDateKey={draft.endDateKey}
        endMinutes={draft.endMinutes}
        endInvalid={endInvalid}
        onChangeStart={(dateKey, minutes) => update({ startDateKey: dateKey, startMinutes: minutes })}
        onChangeEnd={(dateKey, minutes) => update({ endDateKey: dateKey, endMinutes: minutes })}
      />
      <AppointmentBossList
        bosses={draft.bosses}
        names={props.names}
        colorOf={props.colorOf}
        onChange={(bosses) => update({ bosses })}
        onAdd={() => {
          picker.begin(draft.bosses)
          setStep('bosses')
        }}
      />
      <AppointmentAlarmField
        alarmOn={draft.alarmOn}
        leadMinutes={draft.leadMinutes}
        startDateKey={draft.startDateKey}
        usedOnDate={alarmsOnDate(appointments, draft.startDateKey, target?.occurrence.appointment.id)}
        onToggle={(alarmOn) => update({ alarmOn })}
        onChangeLead={(leadMinutes) => update({ leadMinutes })}
      />
      {/* 알림 아래. 바닥 줄 저장 바로 위 자리는 수정 시트가 `이 주만 적용하기` 로 쓴다. */}
      <Pressable
        role="checkbox"
        aria-label="매주 반복"
        aria-checked={draft.repeats}
        onPress={() => update({ repeats: !draft.repeats })}
        className="flex-row items-center gap-2 self-start px-4 py-1"
      >
        <CheckBox checked={draft.repeats} />
        <Text className="text-sm font-medium text-text">매주 반복</Text>
        {draft.repeats && <Text className="text-xs text-text-muted">{weekday}요일마다</Text>}
      </Pressable>
    </View>
  )
  const viewBody = (
    <View className="gap-5 pb-2">
      <AppointmentTimeBand
        todayKey={todayKey}
        startDateKey={draft.startDateKey}
        startMinutes={draft.startMinutes}
        endDateKey={draft.endDateKey}
        endMinutes={draft.endMinutes}
        endInvalid={false}
        readOnly
        muted={past}
        onChangeStart={() => undefined}
        onChangeEnd={() => undefined}
      />
      <AppointmentBossList
        readOnly
        bosses={draft.bosses}
        names={props.names}
        colorOf={props.colorOf}
        onChange={() => undefined}
        onAdd={() => undefined}
      />
      <AppointmentSummaryTiles
        leadMinutes={draft.alarmOn ? draft.leadMinutes : null}
        repeats={draft.repeats}
        weekday={weekday ?? ''}
      />
    </View>
  )
  const bossesBody = (
    <BossPickerBody
      characters={picker.characters}
      ocid={picker.ocid}
      onSelectCharacter={picker.setOcid}
      sections={picker.sections}
      picked={picker.picked}
      colorOf={props.colorOf}
      onPressTile={picker.pressTile}
    />
  )

  // 시트는 하나다. 단계마다 다른 시트를 그리면 단계를 바꿀 때 닫혔다 다시 열린다.
  return (
    <>
      <BottomSheet
        testId="appointment-sheet"
        label={inBosses ? '보스 추가' : inView ? '약속' : editing ? '약속 수정' : '약속 추가'}
        stepKey={step}
        resetScrollKey={step}
        // 보스 추가는 선택 줄이 펼쳐지며 바닥이 자란다. 처음부터 넉넉히 열어 시트가 덜 출렁이게 한다.
        minHeightRatio={inBosses ? BOSS_STEP_MIN_HEIGHT_RATIO : undefined}
        onClose={props.onClose}
        header={inBosses ? bossesHeader : inView ? viewHeader : formHeader}
        footer={inBosses ? bossesFooter : inView ? viewFooter : formFooter}
      >
        {inBosses ? bossesBody : inView ? viewBody : formBody}
      </BottomSheet>
      {confirmingDelete && (
        <NoticeModal
          icon={AlertTriangleIcon}
          tone="error"
          title={repeating ? '반복 약속을 삭제할까요?' : '약속을 삭제할까요?'}
          description={
            repeating
              ? `이번 주부터 매주 ${weekday}요일 약속이 사라져요. 지난 주 약속은 그대로 남아요.`
              : '삭제한 약속은 되돌릴 수 없어요.'
          }
          // 되돌릴 수 없는 동작이라 주 버튼이 취소다. 삭제는 아래 빨간 글자.
          action={{ label: '취소', onPress: () => setConfirmingDelete(false) }}
          secondaryAction={{
            label: repeating ? '이번 주부터 삭제' : '삭제',
            danger: true,
            onPress: () => void remove(),
          }}
          onClose={() => setConfirmingDelete(false)}
          testId="appointment-delete-modal"
        />
      )}
      {inBosses && picker.editing !== null && editingBoss !== undefined && (
        <BossDifficultyPopover
          bossKey={editingBoss.bossKey}
          difficulty={editingBoss.difficulty}
          anchor={picker.editing.anchor}
          onSelect={(difficulty) => {
            picker.setPicked(picker.picked.map((boss, at) => (at === editingIndex ? { ...boss, difficulty } : boss)))
            picker.closeEditing()
          }}
          onRemove={() => {
            picker.setPicked(picker.picked.filter((_, at) => at !== editingIndex))
            picker.closeEditing()
          }}
          onClose={picker.closeEditing}
        />
      )}
    </>
  )
}
