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
 *
 * ## 아이템 판매만 **수수료를 뗀다** ([[ADR-170]] 정정 9)
 *
 * 경매장이 3% 또는 5% 를 떼므로 «판 값» 과 «번 돈» 이 다르다. 그래서 이 갈래에서만 줄이 둘 더
 * 서고(**판매 대금** · **수수료**) 큰 숫자가 **합계**가 된다 — 지출 시트의 「기타」와 같은 모양이라
 * 못 친다([[ADR-173]] 결정 17). 요율은 [[ADR-168]] 의 것을 **그대로 부른다**(`netProceedsMeso`):
 * 여기서 다시 짜면 분배 계산기와 1 메소가 어긋난다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

// `TextInput` 도 atom 에서 온다 — 시스템 글자 크기 클램프가 거기 있다([[ADR-152]] 결정 4).
import { Text, TextInput } from '../../components/atoms/Text/Text'
import { parseMesoText } from '../../components/molecules/MesoPad/meso-pad'
import { AmountFigure } from '../../components/molecules/AmountFigure/AmountFigure'
import { Segment } from '../../components/molecules/Segment/Segment'
import { SelectField } from '../../components/organisms/SelectField/SelectField'
import { characterOptions } from './character-options'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { formatMesoUnits } from '../../lib/drop-price'
import {
  FREE_CURRENCY_LABELS,
  currencyOfLabel,
  labelOfCurrency,
  unitOfCurrency,
  type FreeCurrency,
} from '../../lib/free-currency'
import { pointToMeso } from '../../lib/spend-catalog'
import { netProceedsMeso, type FeePercent } from '../../lib/item-split'
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
  '아이템 판매': '판매 아이템',
  사냥: '사냥터',
  기타: '내용',
}

/**
 * 수수료 조각 셋 — **「없음」 이 첫 조각이고 기본값**이다([[ADR-170]] 정정 9 ②).
 *
 * 3%·5% 만 두면 직거래를 못 적고, 무엇보다 **정정 9 이전에 적힌 행**이 거짓이 된다: 수정 시트가
 * 그 행을 열 때 요율 하나를 억지로 세우면 열기만 해도 금액이 달라진다.
 */
const FEE_OPTIONS = ['없음', '3%', '5%'] as const

type FeeOption = (typeof FEE_OPTIONS)[number]

function feeOptionOf(percent: FeePercent | null): FeeOption {
  return percent === null ? '없음' : (`${percent}%` as FeeOption)
}

function feePercentOf(option: FeeOption): FeePercent | null {
  return option === '없음' ? null : (Number(option.replace('%', '')) as FeePercent)
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
   * 마지막으로 쓴 메소마켓 시세 — 「기타」를 메포로 적을 때의 기본값이다([[ADR-170]] 정정 15).
   * 지출 시트와 **같은 계약**이라 화면이 한 값을 두 시트에 그대로 넘긴다.
   */
  lastPointRate: number | null

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
  /**
   * 치는 값은 **판매 대금**이다 — 행에 남는 것은 수수료를 뗀 값이라, 되짚을 때 뗀 몫을 되돌린다
   * ([[ADR-170]] 정정 9 ⑤). 요율만 들고 역산하면 내림 때문에 1 메소가 어긋난다.
   */
  const [gross, setGross] = useState(
    (props.editing?.mesoAmount ?? 0) + (props.editing?.saleFeeMeso ?? 0),
  )
  const [feePercent, setFeePercent] = useState<FeePercent | null>(
    props.editing?.saleFeePercent ?? null,
  )
  /**
   * 「기타」가 고르는 통화([[ADR-170]] 정정 15 결정 2) — 이벤트 보상이 메포·캐시로도 들어온다.
   *
   * 수정으로 열 때는 **찬 칸이 통화를 되짚는다**(지출 시트와 같은 방식) — 캐시 칸이 차 있으면
   * 캐시로 열려야 그 값이 안 사라진다.
   */
  const [freeCurrency, setFreeCurrency] = useState<FreeCurrency>(
    props.editing?.cashAmount !== undefined && props.editing.cashAmount !== null
      ? 'cash'
      : props.editing?.pointAmount !== undefined && props.editing.pointAmount !== null
        ? 'point'
        : 'meso',
  )
  /** 메포로 적을 때만 쓰는 시세 — 글자로 든다(지출 시트와 같다: 지우는 중간 상태가 있다). */
  const [rateText, setRateText] = useState(
    (props.editing?.pointPer100mMeso ?? props.lastPointRate)?.toString() ?? '',
  )

  /** 저장이 도는 동안 다시 못 누르게 막는다 — 손입력은 두 번 눌리면 행이 둘이 된다. */
  const [saving, setSaving] = useState(false)

  // 판매 대금·수수료 줄은 **아이템 판매에만** 선다(정정 9 ②) — 사냥 메소에는 경매장이 없다.
  const isSale = category === '아이템 판매'
  /**
   * **통화가 서는 자리는 「기타」 하나**다([[ADR-170]] 정정 15 결정 2) — 아이템 판매는 경매장이라
   * 메소이고 사냥도 메소다. 갈래가 이미 아는 것을 다시 묻지 않는다.
   */
  const isFree = category === '기타'
  const currency: FreeCurrency = isFree ? freeCurrency : 'meso'
  const usesPoint = currency === 'point'
  const rate = /^\d+$/.test(rateText) && Number(rateText) > 0 ? Number(rateText) : null
  /** [[ADR-168]] 의 계산을 **그대로 부른다** — 수수료 쪽을 내림한다(= 손에 남는 쪽이 커진다). */
  const net = feePercent === null ? gross : netProceedsMeso(gross, feePercent)

  /** 메포로 적으면 **시세가 있어야** 잰다 — 지출 시트와 같은 계약이다([[ADR-166]] 정정 2 ④). */
  const canSave = gross > 0 && (!usesPoint || rate !== null)
  /** 메포를 메소 축으로 옮긴 값 — 큰 숫자 밑 힌트가 이것을 말한다. */
  const pointMeso = usesPoint && rate !== null ? pointToMeso(gross, rate) : 0
  /**
   * 큰 숫자 밑 한 줄 — **0 일 때도 빈 줄로 자리를 지킨다**(사라지면 첫 타건에 아래가 밀린다).
   */
  const incomeHint =
    currency === 'cash'
      ? '캐시는 메소로 환산하지 않아요'
      : usesPoint
        ? rate === null
          ? '시세를 넣어야 메소로 셀 수 있어요'
          : gross > 0
            ? `${pointMeso.toLocaleString()} 메소`
            : ' '
        : net > 0
          ? formatMesoUnits(net)
          : ' '

  /** 갈래를 옮기면 **골라 둔 요율이 풀린다**(정정 9 ②) — 관세가 갈래를 옮길 때 꺼지는 것과 같다. */
  function selectCategory(next: IncomeCategory): void {
    setCategory(next)
    setFeePercent(null)
  }

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
        // **수수료를 뗀 값**이다(정정 9 ⑤) — 집계가 보는 칸이 이것 하나다.
        // 통화가 갈리는 갈래에서는 **고른 통화의 칸에만** 담는다([[ADR-170]] 정정 15).
        mesoAmount: currency === 'meso' ? net : null,
        saleFeePercent: feePercent,
        saleFeeMeso: feePercent === null ? null : gross - net,
        pointAmount: currency === 'point' ? gross : null,
        pointPer100mMeso: currency === 'point' ? rate : null,
        cashAmount: currency === 'cash' ? gross : null,
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
                onPress={() => selectCategory(each)}
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

        <View className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2">
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

        {isFree && (
          // 통화는 **갈래가 아니라 금액의 축**이라 세그먼트다([[ADR-173]] 결정 3) — 지출 시트의
          // 그 줄과 같은 모양·같은 자리다([[ADR-170]] 정정 15 결정 2).
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <View
            testID="income-sheet-currency"
            className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2"
          >
            <Text className="shrink-0 text-xs text-text-muted">통화</Text>
            <View className="flex-1 flex-row items-center justify-end">
              <Segment
                options={FREE_CURRENCY_LABELS}
                selected={labelOfCurrency(freeCurrency)}
                onSelect={(label) => setFreeCurrency(currencyOfLabel(label))}
              />
            </View>
          </View>
        )}

        {usesPoint && (
          // 메포를 메소 축으로 옮기는 값 — **1억 메소당 메포**다([[ADR-166]] 정정 2 ④).
          <View className="min-h-7 flex-row items-center gap-2 border-b border-border pb-2">
            <Text className="shrink-0 text-xs text-text-muted">
              시세 · 1억당
              <Text testID="income-sheet-required" className="text-error-ink">
                {' *'}
              </Text>
            </Text>
            <View className="flex-1 flex-row items-center justify-end">
              <TextInput
                testID="income-sheet-rate"
                value={rateText}
                onChangeText={setRateText}
                keyboardType="number-pad"
                placeholder="메소마켓 시세"
                className={`flex-1 text-right text-sm font-semibold ${
                  rate !== null ? 'text-text' : 'text-error-ink'
                }`}
                style={TABULAR_NUMS}
              />
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메포</Text>
            </View>
          </View>
        )}

        {/* 큰 숫자는 **저장 바로 위**이고 자기 윗선을 안 긋는다 — 위 줄의 밑줄이 경계를 겸한다
            ([[ADR-173]] 결정 1·9). 힌트는 억/만이고, 0 일 때는 빈 줄로 자리만 지킨다: 사라지면
            첫 타건에 아래가 통째로 밀린다. */}
        {isSale && (
          // **치는 자리는 여기**다([[ADR-170]] 정정 9 ④) — 큰 숫자는 합계라 못 친다. 이름 아래에
          // 서는 이유는 계산 차례 그대로이기 때문이다: 무엇을 · 얼마에 · 몇 % 떼고 → 합계.
          <View className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2">
            <Text className="shrink-0 text-xs text-text-muted">판매 대금</Text>
            <View className="flex-1 flex-row items-center justify-end">
              <TextInput
                testID="income-sheet-gross"
                value={gross === 0 ? '' : gross.toLocaleString()}
                onChangeText={(text) => setGross(parseMesoText(gross, text))}
                keyboardType="number-pad"
                placeholder="0"
                className="flex-1 text-right text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              />
              {/* 큰 숫자는 **수수료를 뗀 합계**라(정정 9 ④) 이 줄과 축이 같은지 헷갈린다 —
                  둘 다 메소라는 것을 여기서 말한다([[ADR-170]] 정정 14 ④). */}
              <Text
                testID="income-sheet-gross-unit"
                className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
              >
                메소
              </Text>
            </View>
          </View>
        )}

        {isSale && (
          <View
            testID="income-sheet-fee"
            className="flex-row items-center gap-3 border-b border-border pb-2"
          >
            <Text className="text-xs text-text-muted">수수료</Text>
            <View className="ml-auto">
              <Segment
                options={FEE_OPTIONS}
                selected={feeOptionOf(feePercent)}
                onSelect={(option) => setFeePercent(feePercentOf(option))}
              />
            </View>
          </View>
        )}

        <AmountFigure
          // **아이템 판매의 큰 숫자는 합계**다([[ADR-170]] 정정 9 ④) — 수수료를 뗀 값이고, 앱이
          // 세므로 못 친다. 다른 갈래는 이 자리가 곧 치는 칸이다(정정 9 이전과 같다).
          value={isSale ? net : gross}
          /*
           * **단위는 고른 통화**다([[ADR-170]] 정정 15) — 캐시는 「원」이다(실제로 내는 돈이 원이라
           * 지출 시트가 그렇게 적고, 같은 값을 두 시트가 다르게 적을 이유가 없다).
           */
          unit={isSale ? '메소' : unitOfCurrency(currency)}
          testID="income-sheet-amount"
          /*
           * 힌트가 말하는 것도 통화를 따른다: 메소는 억/만, 메포는 **메소로 얼마인가**(그 값이
           * 합계에 드는 값이다), 캐시는 **안 든다**는 사실 자체다([[ADR-166]] 정정 2 ①).
           */
          hint={incomeHint}
          hintBlocked={usesPoint && rate === null}
          readOnly={isSale}
          onChangeValue={setGross}
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
