/**
 * 헥사 매트릭스의 폼. 맨 위 세그먼트로 헥사 스킬 · 헥사 스탯을 오간다.
 *
 * 헥사 강화는 메소 대신 솔 에르다 조각을 쓴다. 지출은 `(필요 조각 − 교환 불가) × 개당 가격` 이고 저장할 때 굳힌다.
 * 헥사 스킬은 그 캐릭터의 실제 코어를 고르고 필요 조각을 비용 표에서 더한다. 헥사 스탯은 활성화 조각을 체크로 더하고
 * 강화에 쓴 조각은 직접 친다. 강화마다 개수가 달라 미리 알 수 없기 때문이다.
 */
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { CheckBox, Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { Segment } from '../../../components/molecules/Segment/Segment'
import {
  mesoTextOf,
  mesoValueOf,
  optionalMesoTextOf,
  optionalMesoValueOf,
} from '../../../components/organisms/MesoPad/meso-pad'
import { SelectChevron, SelectField, type SelectOption } from '../../../components/organisms/SelectField/SelectField'
import { FRAGMENT_PRICE_QUICK_ADDS } from '../../../constants/domain/meso-quick-adds'
import { COUNT_QUICK_ADDS } from '../../../constants/domain/quick-adds'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { useSpendSubmit } from '../../../hooks/useSpendSubmit'
import { getItemIconUrlByFile, getSkillIconByFile } from '../../../lib/assets/asset-lookup'
import { spendCategoryNameOf } from '../../../lib/cashbook/categories'
import {
  findHexaCore,
  findHexaStat,
  hexaCoreLabel,
  hexaFragmentsBetween,
  hexaJobCores,
  hexaSkillRecordName,
  hexaSpendMeso,
  hexaStats,
  type HexaCore,
} from '../../../lib/cashbook/hexa-matrix'
import { AmountInput, CharacterField, FIELD_CELL_CLASS, FieldCard, FieldRow, SelectRow } from '../sheet-fields'
import { useHeaderSlot, useSaveSlot, type SpendFormProps } from './form-shared'
import { type LevelRange, type RangeEnd } from './level-range'
import { LevelRangeGrid } from './LevelRangeGrid'

type Mode = '헥사 스킬' | '헥사 스탯'
const MODES: readonly Mode[] = ['헥사 스킬', '헥사 스탯']

/** 코어 드롭다운의 최대 높이. 줄 40 과 묶음 머리를 합쳐 여섯 줄 반쯤이 보여 아래에 더 있다는 것이 잘린 줄로 드러난다. */
const CORE_LIST_MAX_HEIGHT = 296

/** 코어를 고르기 전의 자리. 격자만 흐리게 서므로 값은 뜻이 없다. */
const EMPTY: LevelRange = { from: 0, to: 1 }

/** 코어를 고른 순간의 범위. 기억한 레벨에서 한 칸 위까지다. 만렙을 기억한 코어는 마지막 한 단계로 연다. */
function rangeFor(core: HexaCore, remembered: number | undefined): LevelRange {
  const max = core.kind?.maxLevel ?? 30
  const from = Math.min(Math.max(remembered ?? 0, 0), max - 1)
  return { from, to: from + 1 }
}

export function HexaMatrixForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const editedHexa = props.editing?.hexa ?? null
  const [mode, setMode] = useState<Mode>(editedHexa?.activation != null ? '헥사 스탯' : '헥사 스킬')
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  /** 그 캐릭터의 기억한 코어 레벨. 다른 캐릭터의 것이 남지 않게 ocid 를 함께 든다. */
  const [hexaLevels, setHexaLevels] = useState<{ ocid: string; levels: Readonly<Record<string, number>> } | null>(null)
  const [coreName, setCoreName] = useState<string | null>(mode === '헥사 스킬' ? (props.editing?.itemKey ?? null) : null)
  const [range, setRange] = useState<LevelRange>(() => ({
    from: props.editing?.levelFrom ?? EMPTY.from,
    to: props.editing?.levelTo ?? EMPTY.to,
  }))
  const [editingEnd, setEditingEnd] = useState<RangeEnd>('to')
  const [statKey, setStatKey] = useState<string | null>(mode === '헥사 스탯' ? (props.editing?.itemKey ?? null) : null)
  const [activation, setActivation] = useState(editedHexa?.activation === true)
  /** 헥사 스탯의 강화에 쓴 조각. 수정으로 열면 필요 조각에서 활성화 몫을 뺀 값이다. */
  const [enhanceText, setEnhanceText] = useState(() => {
    if (editedHexa?.activation == null) return ''
    const stat = findHexaStat(props.editing?.itemKey ?? null)
    const activationPart = editedHexa.activation ? (stat?.activationFragments ?? 0) : 0
    return mesoTextOf(Math.max(0, editedHexa.fragmentCount - activationPart))
  })
  // 개당 가격은 빈 칸으로 연다. 마지막으로 친 값을 채우지 않는다(사용자 지정).
  const [priceText, setPriceText] = useState(optionalMesoTextOf(editedHexa?.fragmentPrice ?? null))
  const [untradableText, setUntradableText] = useState(optionalMesoTextOf(editedHexa?.untradableFragmentCount ?? null))
  const { saving, submit, remove } = useSpendSubmit(props)

  const character = ocid === null ? null : (props.characters.find((each) => each.ocid === ocid) ?? null)
  const remembered = hexaLevels !== null && hexaLevels.ocid === ocid ? hexaLevels.levels : null
  const cores = character?.jobClass == null ? [] : hexaJobCores(character.jobClass)
  // 수정은 기록의 코어를 지킨다. 직업 목록에서 못 찾아도 기록의 이름으로 되짚는다.
  const core = cores.find((each) => each.name === coreName) ?? findHexaCore(coreName)
  const stat = findHexaStat(statKey)

  const skillCost = core?.kind == null ? null : hexaFragmentsBetween(core.kind.key, range.from, range.to)
  const activationFragments = stat?.activationFragments
  const enhanceFragments = mesoValueOf(enhanceText === '' ? '0' : enhanceText)
  const fragments =
    mode === '헥사 스킬'
      ? (skillCost?.fragments ?? null)
      : stat === null
        ? null
        : enhanceFragments + (activation ? (activationFragments ?? 0) : 0)
  const price = optionalMesoValueOf(priceText)
  const untradable = optionalMesoValueOf(untradableText) ?? 0
  const amount = fragments === null || price === null ? 0 : hexaSpendMeso({ fragments, untradable, price })

  function selectCharacter(next: string | null): void {
    setOcid(next)
    // 다른 캐릭터의 코어를 고른 채 두면 기록과 캐릭터가 갈린다. 수정은 기록의 코어를 지킨다.
    if (!editing) setCoreName(null)
    if (next === null) return
    void props.loadRememberedLevels(next, 'hexa').then((levels) => setHexaLevels({ ocid: next, levels }))
  }

  function selectCore(name: string | null): void {
    setCoreName(name)
    const next = cores.find((each) => each.name === name)
    setRange(next === undefined ? EMPTY : rangeFor(next, remembered?.[next.name]))
    setEditingEnd('to')
  }

  const canSave =
    ocid !== null &&
    price !== null &&
    fragments !== null &&
    (mode === '헥사 스킬' ? core !== null && skillCost !== null : stat !== null && fragments > 0)

  useSaveSlot(props.setSave, {
    showSave: true,
    editing,
    canSave,
    saving,
    onSave: () => {
      if (!canSave || fragments === null || price === null) return
      const isSkill = mode === '헥사 스킬'
      void submit({
        ocid,
        spentOn: props.dateKey,
        category: props.category,
        item: isSkill ? hexaSkillRecordName(core!.name, range.from, range.to) : stat!.name,
        itemKey: isSkill ? core!.name : stat!.key,
        formItemKeys: null,
        itemKind: null,
        levelFrom: isSkill ? range.from : null,
        levelTo: isSkill ? range.to : null,
        quantity: null,
        mesoAmount: amount,
        tariffMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        hexa: { fragmentCount: fragments, untradableFragmentCount: untradable, fragmentPrice: price, activation: isSkill ? null : activation },
      })
    },
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  useHeaderSlot(props.setHeader, {
    title: spendCategoryNameOf(props.category),
    dateKey: props.dateKey,
    todayDateKey: props.todayDateKey,
    earliestDateKey: props.earliestDateKey,
    onDateChange: props.onDateChange,
    onBack: editing ? undefined : props.onBack,
  })

  const coreOptions: SelectOption[] = cores.map((each) => ({
    value: each.name,
    label: each.name,
    group: each.kind?.name ?? each.apiType,
  }))
  const fragmentIcon = getItemIconUrlByFile('sol_erda_fragment.webp')
  const detail =
    mode === '헥사 스킬'
      ? core?.kind == null
        ? null
        : `${core.kind.name} · Lv.${range.from} → ${range.to}`
      : stat === null
        ? null
        : activation && activationFragments !== undefined
          ? `활성화 ${activationFragments.toLocaleString()} + 강화 ${enhanceFragments.toLocaleString()}`
          : `강화 ${enhanceFragments.toLocaleString()}`

  return (
    <>
      {/* 수정으로 열면 기록이 무엇이었는지가 정해져 있어 오가지 못한다. */}
      <Segment options={MODES} selected={mode} onSelect={setMode} disabled={editing} size="md" />

      <FieldCard>
        <CharacterField characters={props.characters} selected={ocid} onSelect={selectCharacter} testID="spend-sheet-chain" />

        {mode === '헥사 스킬' ? (
          <>
            <SelectField
              label="코어"
              options={coreOptions}
              selected={coreName}
              onSelect={selectCore}
              testID="spend-sheet-hexa-core"
              boxClassName={FIELD_CELL_CLASS}
              listMaxHeight={CORE_LIST_MAX_HEIGHT}
              renderTrigger={(open, isOpen) => (
                <Pressable
                  role="button"
                  aria-label="코어"
                  testID="spend-sheet-hexa-core"
                  onPress={open}
                  disabled={cores.length === 0}
                  className="min-h-6 flex-1 flex-row items-center gap-3 active:opacity-60"
                >
                  <Text className="shrink-0 text-xs text-text-muted">코어</Text>
                  <View className="ml-auto shrink items-end gap-1">
                    {core === null ? (
                      <Text className="text-sm text-text-disabled">{ocid === null ? '캐릭터를 먼저 고르세요' : '코어 선택'}</Text>
                    ) : (
                      <>
                        {core.kind !== null && <KindChip icon={core.kind.icon} name={core.kind.name} />}
                        <CoreName core={core} iconSize={22} />
                      </>
                    )}
                  </View>
                  <SelectChevron open={isOpen} />
                </Pressable>
              )}
              renderOption={(option, isSelected) => {
                const each = cores.find((candidate) => candidate.name === option.value)
                return each === undefined ? null : <CoreName core={each} iconSize={26} selected={isSelected} />
              }}
            />
            <View className={`${FIELD_CELL_CLASS} flex-col items-stretch`}>
              <LevelRangeGrid
                min={0}
                max={core?.kind?.maxLevel ?? 30}
                range={range}
                editing={editingEnd}
                disabled={core === null}
                onChange={(next) => {
                  setRange(next.range)
                  setEditingEnd(next.editing)
                }}
                testID="spend-sheet-hexa-level"
              />
            </View>
          </>
        ) : (
          <>
            <SelectRow
              label="스탯"
              placeholder="스탯 선택"
              options={hexaStats().map((each) => ({ value: each.key, label: each.name }))}
              selected={statKey}
              onSelect={setStatKey}
              testID="spend-sheet-hexa-stat"
            />
            {/* 헥사 스탯은 초기화하고 다시 올릴 수 있어 이번 기록에 활성화가 드는지를 고른다. 비용을 모르는 스탯은 막는다. */}
            <Pressable
              role="checkbox"
              aria-checked={activation}
              aria-disabled={activationFragments === undefined}
              disabled={activationFragments === undefined}
              testID="spend-sheet-hexa-activation"
              onPress={() => setActivation((current) => !current)}
              className={`${FIELD_CELL_CLASS} ${activationFragments === undefined ? 'opacity-40' : ''}`}
            >
              <CheckBox checked={activation && activationFragments !== undefined} />
              <Text className="text-13 font-semibold text-text">이번 기록에 활성화 포함</Text>
              <Text
                className={`ml-auto text-13 font-semibold ${activation ? 'text-primary-ink' : 'text-text-disabled'}`}
                style={TABULAR_NUMS}
              >
                {activationFragments === undefined ? '' : `+${activationFragments.toLocaleString()}개`}
              </Text>
            </Pressable>
            <FieldRow label="강화에 쓴 조각">
              <AmountInput
                testID="spend-sheet-hexa-enhance"
                label="강화에 쓴 조각"
                context="솔 에르다 조각"
                icon="fragment"
                unit="개"
                chips={COUNT_QUICK_ADDS}
                value={enhanceText}
                onChange={setEnhanceText}
              />
              <Text className="ml-1 text-xs text-text-muted">개</Text>
            </FieldRow>
          </>
        )}
      </FieldCard>

      <FieldCard>
        <View className={FIELD_CELL_CLASS} testID="spend-sheet-hexa-fragments">
          {fragmentIcon !== null && <Image source={fragmentIcon} resizeMode="contain" style={{ width: 24, height: 24 }} />}
          <View className="min-w-0 shrink gap-0.5">
            <Text className="text-xs text-text-muted">필요 조각</Text>
            {detail !== null && <Text className="text-11 text-text-muted">{detail}</Text>}
          </View>
          <Text testID="spend-sheet-hexa-fragment-count" className="ml-auto text-base font-bold text-text" style={TABULAR_NUMS}>
            {fragments === null ? '-' : fragments.toLocaleString()}
          </Text>
          <Text className="text-xs text-text-muted">개</Text>
        </View>
        <FieldRow label="개당 가격">
          <AmountInput
            testID="spend-sheet-hexa-price"
            label="개당 가격"
            context="솔 에르다 조각 · 개당"
            icon="meso"
            unit="메소"
            reading
            chips={FRAGMENT_PRICE_QUICK_ADDS}
            value={priceText}
            onChange={setPriceText}
          />
          <Text className="ml-1 text-xs text-text-muted">메소</Text>
        </FieldRow>
        <FieldRow label="교환 불가">
          <AmountInput
            testID="spend-sheet-hexa-untradable"
            label="교환 불가"
            context="이벤트로 얻은 교환 불가 솔 에르다 조각"
            icon="fragment"
            unit="개"
            chips={COUNT_QUICK_ADDS}
            value={untradableText}
            onChange={setUntradableText}
          />
          <Text className="ml-1 text-xs text-text-muted">개</Text>
        </FieldRow>
      </FieldCard>

      <AmountFigure value={amount} unit="메소" testID="spend-sheet-amount" />
    </>
  )
}

/** 코어 종류 그림과 이름. 닫힌 줄의 위쪽 줄이다. */
function KindChip(props: { icon: string; name: string }): React.JSX.Element {
  const icon = getItemIconUrlByFile(props.icon)
  return (
    <View className="flex-row items-center gap-1">
      {icon !== null && <Image source={icon} resizeMode="contain" style={{ width: 18, height: 18 }} />}
      <Text className="text-11 font-semibold text-text-muted">{props.name}</Text>
    </View>
  )
}

/** 코어의 스킬 그림과 첫 스킬 이름. 여러 스킬을 묶은 코어는 `외 n` 을 붙여 한 줄에 둔다. */
function CoreName(props: { core: HexaCore; iconSize: number; selected?: boolean }): React.JSX.Element {
  const icon = getSkillIconByFile(props.core.icon)
  const { first, more } = hexaCoreLabel(props.core.name)
  return (
    <View className="flex-row items-center gap-1.5">
      {icon !== null && <Image source={icon} resizeMode="contain" style={{ width: props.iconSize, height: props.iconSize }} />}
      <Text numberOfLines={1} className={`shrink text-sm ${props.selected === true ? 'font-semibold text-primary-ink' : 'text-text'}`}>
        {first}
      </Text>
      {more > 0 && (
        <Text className="rounded-full bg-control-track px-1.5 py-px text-10 font-semibold text-text-muted">{`외 ${more}`}</Text>
      )}
    </View>
  )
}
