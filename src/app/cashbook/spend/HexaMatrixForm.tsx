/**
 * 헥사 매트릭스의 폼. `강화 종류` 줄의 세그먼트로 헥사 스킬 · 헥사 스탯을 오간다.
 *
 * 헥사 강화는 메소 대신 솔 에르다 조각을 쓴다. 필요 조각에서 교환 불가를 먼저 빼고, 보관 중인 조각 사용을 켜면 같은
 * 메이플 ID 캐릭터의 보관에서 최대한 가져온다. 지출은 개당 가격을 곱할 개수 × 개당 가격이고 저장할 때 굳힌다.
 * 헥사 스킬은 그 캐릭터의 실제 코어를 고르고 필요 조각을 비용 표에서 더한다. 헥사 스탯은 활성화 조각을 체크로 더하고
 * 강화에 쓴 조각은 직접 친다. 강화마다 개수가 달라 미리 알 수 없기 때문이다.
 */
import { useEffect, useState } from 'react'
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
import { getAssetImage, solErdaFragmentIcon } from '../../../lib/assets/asset-lookup'
import { spendCategoryNameOf } from '../../../lib/cashbook/categories'
import {
  allocateHexaStorage,
  findHexaCore,
  findHexaStat,
  hexaCoreLabel,
  hexaFragmentsBetween,
  hexaFragmentsLeft,
  hexaJobCores,
  hexaPricedFragments,
  hexaSkillRecordName,
  hexaSpendMeso,
  hexaStats,
  type HexaCore,
  type HexaStorages,
} from '../../../lib/cashbook/hexa-matrix'
import { AmountInput, CharacterField, FIELD_CELL_CLASS, FieldCard, FieldRow, SelectRow } from '../sheet-fields'
import { useHeaderSlot, useSaveSlot, type SpendFormProps } from './form-shared'
import { type LevelRange, type RangeEnd } from './level-range'
import { LevelRangeGrid } from './LevelRangeGrid'

type Mode = '헥사 스킬' | '헥사 스탯'
const MODES: readonly Mode[] = ['헥사 스킬', '헥사 스탯']

/**
 * 코어 줄 안쪽의 높이. 고르기 전(한 줄)과 고른 뒤(종류 · 스킬 이름 두 줄)가 같은 높이여야 고를 때 아래 줄들이 안 흔들린다.
 * 두 줄(종류 그림 18 · 사이 4 · 스킬 그림 22)이 들어가는 값이다.
 */
const CORE_ROW_HEIGHT = 44

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
  const [editingEnd, setEditingEnd] = useState<RangeEnd>('from')
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
  // 수정은 그 기록에 저장한 체크로, 새 기록은 직전에 새 기록을 저장한 때의 체크로 연다.
  const [useStorage, setUseStorage] = useState(editedHexa?.useStorage ?? props.hexaStorageChecks.useStorage)
  const [storageAsSpend, setStorageAsSpend] = useState(editedHexa?.storageAsSpend ?? props.hexaStorageChecks.storageAsSpend)
  /**
   * 보관을 가져올 캐릭터와 그 보관. 캐릭터나 날짜를 빠르게 바꾸면 먼저 부른 응답이 늦게 올 수 있어, 지금 고른 것과
   * 열쇠가 다른 값은 안 쓴다. `value` 가 `null` 이면 한 캐릭터라도 못 읽은 것이다.
   */
  const [storages, setStorages] = useState<{ key: string; value: HexaStorages | null } | null>(null)
  const { saving, submit, remove } = useSpendSubmit(props)

  const { loadHexaStorages, dateKey } = props
  const editingId = props.editing?.id
  const storageKey = ocid === null ? null : `${ocid}:${dateKey}`
  useEffect(() => {
    if (ocid === null) return
    const key = `${ocid}:${dateKey}`
    let live = true
    void loadHexaStorages(ocid, dateKey, editingId).then((value) => {
      if (live) setStorages({ key, value })
    })
    return () => {
      live = false
    }
  }, [ocid, dateKey, editingId, loadHexaStorages])

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
  /** 기타 조각과 캐릭터마다 센 보관. 안 골랐거나 읽는 중이면 `undefined`, 한 자리라도 못 읽었으면 `null` 이다. */
  const loaded = storages !== null && storages.key === storageKey ? storages.value : undefined
  // 꺼져 있어도 켜면 가져올 개수를 흐리게 보이려고 센다.
  const allocation =
    fragments !== null && loaded != null
      ? allocateHexaStorage({ fragments, untradable, other: loaded.other, storages: loaded.hunts })
      : null
  const taken = useStorage ? (allocation?.taken ?? 0) : 0
  const asSpend = useStorage && storageAsSpend
  const left = fragments === null ? null : hexaFragmentsLeft({ fragments, untradable, taken })
  const priced = fragments === null ? 0 : hexaPricedFragments({ fragments, untradable, taken, takenAsSpend: asSpend })
  // 곱할 개수가 없으면 개당 가격을 받지 않는다. 받게 하면 저장하려고 아무 값이나 넣게 된다.
  const priceNeeded = priced > 0
  const amount =
    fragments === null || !priceNeeded || price === null
      ? 0
      : hexaSpendMeso({ fragments, untradable, price, taken, takenAsSpend: asSpend })

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
    setEditingEnd('from')
  }

  const canSave =
    ocid !== null &&
    (!priceNeeded || price !== null) &&
    fragments !== null &&
    // 보관을 쓰면 배분을 굳혀야 저장할 수 있다. 못 읽은 채 저장하면 보관이 줄지 않는다.
    (!useStorage || allocation !== null) &&
    (mode === '헥사 스킬' ? core !== null && skillCost !== null : stat !== null && fragments > 0)

  useSaveSlot(props.setSave, {
    showSave: true,
    editing,
    canSave,
    saving,
    onSave: () => {
      if (!canSave || fragments === null) return
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
        hexa: {
          fragmentCount: fragments,
          untradableFragmentCount: untradable,
          fragmentPrice: priceNeeded ? price : null,
          activation: isSkill ? null : activation,
          useStorage,
          storageAsSpend,
          storageUses: useStorage ? (allocation?.uses ?? []) : [],
          ...(useStorage && allocation?.otherUse !== undefined ? { otherUse: allocation.otherUse } : {}),
        },
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
  const fragmentIcon = solErdaFragmentIcon()
  // 헥사 스킬은 종류와 레벨이 바로 위 칸들에 이미 보여 둘째 줄을 두지 않는다. 헥사 스탯만 활성화 몫을 가른다.
  const detail =
    mode === '헥사 스킬'
      ? null
      : stat === null
        ? null
        : activation && activationFragments !== undefined
          ? `활성화 ${activationFragments.toLocaleString()} + 강화 ${enhanceFragments.toLocaleString()}`
          : `강화 ${enhanceFragments.toLocaleString()}`

  return (
    <>
      <FieldCard>
        <CharacterField characters={props.characters} selected={ocid} onSelect={selectCharacter} testID="spend-sheet-chain" />
        {/* 사냥 전리품 판매의 분류 줄과 같은 모양이다. 수정으로 열면 기록이 무엇이었는지가 정해져 있어 오가지 못한다. */}
        <FieldRow label="강화 종류" testID="spend-sheet-hexa-mode">
          <Segment size="sm" options={MODES} selected={mode} onSelect={setMode} disabled={editing} />
        </FieldRow>

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
                  className="flex-1 flex-row items-center gap-3 active:opacity-60"
                  style={{ height: CORE_ROW_HEIGHT }}
                >
                  <Text className="shrink-0 text-xs text-text-muted">코어</Text>
                  <View className="ml-auto shrink items-end gap-1">
                    {core === null ? (
                      <Text className="text-sm text-text-disabled">{ocid === null ? '캐릭터를 먼저 고르세요' : '코어 선택'}</Text>
                    ) : (
                      <>
                        {core.kind !== null && <KindChip iconAssetId={core.kind.iconAssetId} name={core.kind.name} />}
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
              <Text className="text-sm font-semibold text-text">이번 기록에 활성화 포함</Text>
              <Text
                className={`ml-auto text-sm ${activation ? 'font-bold text-primary-ink' : 'text-text-disabled'}`}
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
          {/* 교환 불가와 보관 몫을 뺀 수다. 줄인 수와 원래 수 사이(4)가 줄의 다른 칸 사이(12)보다 좁아야 한 값으로 읽힌다. */}
          <View className="ml-auto flex-row items-baseline gap-1">
            <Text testID="spend-sheet-hexa-fragment-count" className="text-lg font-bold text-text" style={TABULAR_NUMS}>
              {left === null ? '-' : left.toLocaleString()}
            </Text>
            {fragments !== null && left !== fragments && (
              <Text
                testID="spend-sheet-hexa-fragment-original"
                className="text-sm text-text-disabled line-through"
                style={TABULAR_NUMS}
              >
                {fragments.toLocaleString()}
              </Text>
            )}
          </View>
          <Text className="text-xs text-text-muted">개</Text>
        </View>
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
        {/* 교환 불가처럼 필요 조각을 줄이는 칸이라 바로 아래에 둔다. 꺼져 있어도 켜면 가져올 개수를 흐리게 보인다. */}
        <Pressable
          role="checkbox"
          aria-checked={useStorage}
          testID="spend-sheet-hexa-use-storage"
          onPress={() => setUseStorage((current) => !current)}
          className={FIELD_CELL_CLASS}
        >
          <View className="flex-row items-center gap-2">
            <CheckBox checked={useStorage} />
            <Text className="text-xs text-text-muted">보관 중인 조각 사용</Text>
          </View>
          <Text
            testID="spend-sheet-hexa-storage-taken"
            className={`ml-auto text-sm ${useStorage ? 'font-bold text-primary-ink' : 'text-text-disabled'}`}
            style={TABULAR_NUMS}
          >
            {allocation === null ? '-' : `${allocation.taken.toLocaleString()}개`}
          </Text>
        </Pressable>
        <FieldRow label="개당 가격">
          {useStorage && (
            <Pressable
              role="checkbox"
              aria-label="보관 중인 조각도 지출로 기록하기"
              aria-checked={storageAsSpend}
              testID="spend-sheet-hexa-storage-as-spend"
              onPress={() => setStorageAsSpend((current) => !current)}
              hitSlop={8}
              className="flex-row items-center gap-2"
            >
              <CheckBox checked={storageAsSpend} />
              <Text className="text-11 text-text-muted">{'보관 중인 조각도\n지출로 기록하기'}</Text>
            </Pressable>
          )}
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
            disabled={!priceNeeded}
          />
          <Text className={`ml-1 text-xs text-text-muted${priceNeeded ? '' : ' opacity-40'}`}>메소</Text>
        </FieldRow>
      </FieldCard>

      <AmountFigure value={amount} unit="메소" testID="spend-sheet-amount" />
    </>
  )
}

/** 코어 종류 그림과 이름. 닫힌 줄의 위쪽 줄이다. */
function KindChip(props: { iconAssetId: string; name: string }): React.JSX.Element {
  const icon = getAssetImage(props.iconAssetId)
  return (
    <View className="flex-row items-center gap-1">
      {icon !== null && <Image source={icon} resizeMode="contain" style={{ width: 18, height: 18 }} />}
      <Text className="text-11 text-text-muted">{props.name}</Text>
    </View>
  )
}

/** 코어의 스킬 그림과 첫 스킬 이름. 여러 스킬을 묶은 코어는 `외 n` 을 붙여 한 줄에 둔다. */
function CoreName(props: { core: HexaCore; iconSize: number; selected?: boolean }): React.JSX.Element {
  const icon = getAssetImage(props.core.iconAssetId)
  const { first, more } = hexaCoreLabel(props.core.name)
  return (
    <View className="flex-row items-center gap-1.5">
      {icon !== null && <Image source={icon} resizeMode="contain" style={{ width: props.iconSize, height: props.iconSize }} />}
      <Text
        numberOfLines={1}
        className={`shrink text-sm ${
          props.selected === true ? 'font-semibold text-primary-ink' : props.selected === false ? 'text-text' : 'font-semibold text-text'
        }`}
      >
        {first}
      </Text>
      {more > 0 && (
        <Text className="rounded-full bg-control-track px-1.5 py-px text-chip-sm font-semibold text-text-muted">{`외 ${more}`}</Text>
      )}
    </View>
  )
}
