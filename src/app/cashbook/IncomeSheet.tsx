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
 * ## 뼈대는 **지출 시트와 같다** ([[ADR-173]] 결정 10)
 *
 * 제목 · 갈래 칩 · 라벨–값 줄 · **큰 숫자 + 힌트** · 저장. 통화 줄이 없고(메소 하나뿐) 갈래가
 * 셋일 뿐이다 — 한 곳을 고치면 두 시트가 같이 고쳐진다.
 *
 * **큰 숫자는 화면에 하나**이고 저장 바로 위에 선다(결정 1). 합계 카드가 없으므로 같은 값이 두 번
 * 적히지 않는다. 억/만은 그 밑 **힌트 한 줄**이다(결정 2).
 *
 * 금액은 **OS 키보드**로 친다([[ADR-170]] 정정 4) — 이 시트는 이름 칸 때문에 어차피 키보드를
 * 부르므로 앱 키패드를 안 부르는 이득이 없다. 빠른 칩은 폼이 아니라 **키보드 위**에 있다(결정 4).
 *
 * 제목은 **안 바뀐다**(결정 7) — 「수입 추가」·「수입 수정」 둘뿐이고, 갈래를 골라도 그대로다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

// `TextInput` 도 atom 에서 온다 — 시스템 글자 크기 클램프가 거기 있다([[ADR-152]] 결정 4).
import { Text, TextInput } from '../../components/atoms/Text/Text'
import { AmountFigure } from '../../components/molecules/AmountFigure/AmountFigure'
import { SelectField } from '../../components/organisms/SelectField/SelectField'
import { characterOptions } from './character-options'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { formatMesoUnits } from '../../lib/drop-price'
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
   * 고를 수 있는 캐릭터([[ADR-166]] 결정 3) — 화면이 읽어서 넘긴다(시트는 `storage/` 를 모른다).
   * 비어 있으면 고르개에 「선택 안함」 하나만 선다.
   */
  characters: ReadonlyArray<{ ocid: string; name: string }>

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
  /** **기본은 「선택 안함」**(사용자 지정 2026-08-26) — 수익은 «내가 번 돈» 이 기본이다. */
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
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
        ocid,
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
    <BottomSheet
      testId="income-sheet"
      onClose={props.onClose}
    >
      <View className="gap-3 px-4 pb-2">
        <View className="flex-row items-baseline justify-between gap-2">
          {/* **수정 모드의 머리는 «고른 것»** 이다([[ADR-173]] 결정 15, 사용자 지정) — 수입은
              고를 것이 갈래뿐이라 그것이 곧 제목이다. 제목이 말하므로 아래 칩은 안 선다. */}
          <Text
            testID="income-sheet-title"
            numberOfLines={1}
            className="shrink text-base font-bold text-rise-ink"
          >
            {editing ? category : '수입 추가'}
          </Text>
          <Text
            testID="income-sheet-date"
            className="text-xs text-text-muted"
            style={TABULAR_NUMS}
          >
            {formatDayLabel(props.dateKey)}
          </Text>
        </View>

        {/* **수정 모드에는 칩이 없다**(결정 15) — 갈래를 바꾸면 그 기록은 «다른 것» 이 되고,
            무엇이었는지는 **제목**이 이미 말한다. */}
        {!editing && (
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
        )}

        <SelectField
          label="캐릭터"
          options={characterOptions(props.characters)}
          selected={ocid}
          onSelect={setOcid}
          testID="income-sheet-character"
        />

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

        {/* 큰 숫자는 **저장 바로 위**이고 자기 윗선을 안 긋는다 — 위 줄의 밑줄이 경계를 겸한다
            ([[ADR-173]] 결정 1·9). 힌트는 억/만이고, 0 일 때는 빈 줄로 자리만 지킨다: 사라지면
            첫 타건에 아래가 통째로 밀린다. */}
        <AmountFigure
          value={meso}
          unit="메소"
          testID="income-sheet-amount"
          hint={meso > 0 ? formatMesoUnits(meso) : ' '}
          onChangeValue={setMeso}
        />

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
