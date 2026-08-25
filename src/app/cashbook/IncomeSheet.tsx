/**
 * 수입 기록 시트 — **갈래 셋, 폼은 하나**([[ADR-170]] 결정 1·6).
 *
 * 지출 시트와 폼이 통째로 다르다. 수입은 **통화가 메소 하나뿐**이라(결정 1) 시세도 관세도 수량도
 * 없고, 갈래는 첫 칸의 **라벨만** 바꾼다 — 아이템 판매는 「판 것」, 사냥은 「사냥터」, 기타는 「내용」.
 * 그래서 갈래를 늘려도 폼이 갈라지지 않는다.
 *
 * ## 여기 서는 것은 **손입력 수익**뿐이다
 *
 * 보스 드롭은 이 시트로 안 들어온다([[ADR-170]] 결정 3) — 이미 보스 수익 탭이 기록하고, 두 곳에서
 * 적으면 같은 판매가 두 벌이 된다. 캘린더는 그것을 **읽어서** 같은 목록에 세우되 여기서 못 고친다.
 *
 * ## 금액은 앞 키패드다
 *
 * OS 키보드를 안 부른다([[ADR-124]] 결정 5) — 메소는 자릿수가 커서 시스템 숫자 키패드로는 0 을
 * 세게 된다. 칸과 그리드는 `molecules/MesoPad` 가 든다(드롭 판매가와 **같은 부품**이다).
 *
 * **다만 이름 칸은 OS 키보드를 부른다** — 글자를 받는 자리라 대안이 없다. 시트가 동적 높이라
 * 키보드가 뜨면 밀릴 수 있고, 그것은 실기기에서 볼 것이다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

// `TextInput` 도 atom 에서 온다 — 시스템 글자 크기 클램프가 거기 있다([[ADR-152]] 결정 4).
import { Text, TextInput } from '../../components/atoms/Text/Text'
import { MesoAmountField } from '../../components/molecules/MesoPad/MesoAmountField'
import { MesoKeypad } from '../../components/molecules/MesoPad/MesoKeypad'
import { applyMesoKey } from '../../components/molecules/MesoPad/meso-pad'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { INCOME_CATEGORIES, type IncomeCategory, type IncomeRecord } from '../../storage/income'

/** 저장할 값에서 **화면이 아니라 부르는 쪽이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type IncomeDraft = Omit<IncomeRecord, 'id' | 'recordedAt'>

/**
 * 첫 칸의 이름 — 갈래가 바꾸는 **유일한** 것이다.
 *
 * 라벨을 갈래별로 두는 이유는 «무엇을 적으라는 것인가» 가 갈래마다 다르기 때문이다. 하나로
 * («내용») 두면 사냥에서 맵 이름을 적어야 하는지 알 수 없다.
 */
const NAME_LABELS: Record<IncomeCategory, string> = {
  '아이템 판매': '판 것',
  사냥: '사냥터',
  기타: '내용',
}

function CategoryChip(props: {
  label: string
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      onPress={props.onPress}
      className={`rounded-full border px-3 py-1.5 ${
        props.selected ? 'border-transparent bg-rise-ink' : 'border-border'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${props.selected ? 'text-bg' : 'text-text-muted'}`}
      >
        {props.label}
      </Text>
    </Pressable>
  )
}

export interface IncomeSheetProps {
  dateKey: string
  /**
   * 고칠 기록. 있으면 **수정 모드**다([[ADR-171]] 결정 2) — 머리와 버튼 글자가 갈리고 삭제가 선다.
   */
  editing?: IncomeRecord
  onDelete?: () => void | Promise<void>
  /** 던지면 **안 닫는다** — 친 것을 잃지 않는다. 실패를 말하는 것은 화면 몫이다(토스트). */
  onSave: (draft: IncomeDraft) => void | Promise<void>
  onClose: () => void
}

export function IncomeSheet(props: IncomeSheetProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [category, setCategory] = useState<IncomeCategory>(
    props.editing?.category ?? INCOME_CATEGORIES[0],
  )
  const [name, setName] = useState(props.editing?.item ?? '')
  const [meso, setMeso] = useState(props.editing?.mesoAmount ?? 0)

  /** 저장이 도는 동안 다시 못 누르게 막는다 — 손입력은 두 번 눌리면 행이 둘이 된다. */
  const [saving, setSaving] = useState(false)

  const canSave = meso > 0

  /** 지우기 — 실패하면 시트를 지킨다(저장과 같은 계약). */
  async function remove(): Promise<void> {
    if (saving || props.onDelete === undefined) return
    setSaving(true)
    try {
      await props.onDelete()
    } catch {
      setSaving(false)
      return
    }
    props.onClose()
  }

  async function save(): Promise<void> {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await props.onSave({
        ocid: null,
        earnedOn: props.dateKey,
        category,
        // 빈 칸은 `null` 이다 — 빈 문자열을 넣으면 «적었는데 비어 있다» 와 «안 적었다» 가 같아진다.
        item: name.trim() === '' ? null : name.trim(),
        mesoAmount: meso,
        memo: null,
      })
    } catch {
      // 자리를 지킨다 — 무엇이 잘못됐는지는 화면이 띄운 토스트가 말한다.
      setSaving(false)
      return
    }
    props.onClose()
  }

  return (
    <BottomSheet testId="income-sheet" onClose={props.onClose}>
      <View className="gap-3 px-4 pb-2">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="text-base font-bold text-rise-ink">
            {editing ? '수입 수정' : '수입 추가'}
          </Text>
          <Text
            testID="income-sheet-date"
            className="text-xs text-text-muted"
            style={TABULAR_NUMS}
          >
            {formatDayLabel(props.dateKey)}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {INCOME_CATEGORIES.map((each) => (
            <CategoryChip
              key={each}
              label={each}
              selected={each === category}
              onPress={() => setCategory(each)}
            />
          ))}
        </View>

        <View className="flex-row items-center gap-3 border-b border-border pb-2">
          <Text testID="income-sheet-name-label" className="text-xs text-text-muted">
            {NAME_LABELS[category]}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="비워 둬도 됩니다"
            className="flex-1 text-right text-sm text-text"
          />
        </View>

        <MesoAmountField
          meso={meso}
          onChange={setMeso}
          resetLabel="금액 초기화"
          amountTestID="income-sheet-amount"
        />

        {/* 시트 껍데기가 좌우 여백을 안 주므로 키패드는 자기 몫(`px-3`)을 들고 온다 — 위 칸들과
            정렬을 맞추려고 그만큼 되돌린다. */}
        <View className="-mx-1">
          <MesoKeypad onKey={(key) => setMeso((prev) => applyMesoKey(prev, key))} />
        </View>

        <Pressable
          role="button"
          aria-label={editing ? '수정' : '저장'}
          disabled={!canSave || saving}
          onPress={() => void save()}
          className={`items-center rounded-xl py-3 ${canSave ? 'bg-rise-ink' : 'bg-surface-2'}`}
        >
          <Text className={`text-sm font-bold ${canSave ? 'text-bg' : 'text-text-disabled'}`}>
            {editing ? '수정' : '저장'}
          </Text>
        </Pressable>

        {editing && props.onDelete !== undefined && (
          // **버튼처럼 안 생겼다**([[ADR-171]] 결정 3) — `SpendSheet` 와 같은 자리·같은 무게다.
          <Pressable
            role="button"
            aria-label="삭제"
            testID="income-sheet-delete"
            disabled={saving}
            onPress={() => void remove()}
            className="items-center py-2"
          >
            <Text className="text-xs font-semibold text-error-ink">삭제</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  )
}
