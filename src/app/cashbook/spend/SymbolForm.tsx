/**
 * 심볼 강화의 폼. 갈래를 고르면 곧바로 선다. 캐릭터 · 심볼 · 레벨 · 금액 차례다.
 *
 * 레벨마다 비용이 달라 `unitPrice` × 수량으로 못 낸다. 금액은 강화 전부터 강화 후 바로 앞까지 단계
 * 비용의 합이고, 저장할 때 계산해 굳힌다. 강화 전은 캐릭터의 기억한 레벨로 선다.
 */
import { useRef, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { SelectChevron, SelectField, type SelectOption } from '../../../components/organisms/SelectField/SelectField'
import { useSpendSubmit } from '../../../hooks/useSpendSubmit'
import { getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import { spendCategoryNameOf } from '../../../lib/cashbook/categories'
import {
  findSymbol,
  symbolCostsFrom,
  symbolMenu,
  symbolRecordName,
  symbolUpgradeCost,
} from '../../../lib/cashbook/symbol-costs'
import { CharacterField, FIELD_CELL_CLASS, FieldCard } from '../sheet-fields'
import { useHeaderSlot, useSaveSlot, type SpendFormProps } from './form-shared'
import { type LevelRange, type RangeEnd } from './level-range'
import { LevelRangeGrid } from './LevelRangeGrid'

/** 심볼을 고르기 전의 자리. 칸만 흐리게 서므로 값은 뜻이 없다. */
const EMPTY: LevelRange = { from: 1, to: 1 }

/**
 * 심볼을 고른 순간의 범위. 기억한 레벨이 있으면 그 레벨에서 한 칸 위까지이고, 없으면 묶음의 기본 범위다.
 * 만렙을 기억한 심볼은 마지막 한 단계로 연다. 올릴 단계가 없는 범위는 저장할 수 없다.
 */
function rangeFor(found: NonNullable<ReturnType<typeof findSymbol>>, remembered: number | undefined): LevelRange {
  if (remembered === undefined) return { from: found.group.defaultRange[0], to: found.group.defaultRange[1] }
  const from = Math.min(Math.max(remembered, 1), found.group.maxLevel - 1)
  return { from, to: from + 1 }
}

export function SymbolForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [symbolKey, setSymbolKey] = useState<string | null>(props.editing?.itemKey ?? null)
  const [range, setRange] = useState<LevelRange>(() => ({
    from: props.editing?.levelFrom ?? EMPTY.from,
    to: props.editing?.levelTo ?? EMPTY.to,
  }))
  /** 격자에서 지금 고르는 쪽. 강화 전은 기억한 레벨로 서므로 강화 후부터 고른다. */
  const [editingEnd, setEditingEnd] = useState<RangeEnd>('to')
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  /** 그 캐릭터의 기억한 심볼 레벨. 강화 전과 만렙 묶음을 가른다. 다른 캐릭터의 것이 남지 않게 ocid 를 함께 든다. */
  const [symbolLevels, setSymbolLevels] = useState<{ ocid: string; levels: Readonly<Record<string, number>> } | null>(null)
  const { saving, submit, remove } = useSpendSubmit(props)

  const found = findSymbol(symbolKey)
  /**
   * 지금 고른 심볼. 기억이 늦게 오는 사이 심볼이 바뀌거나 지워질 수 있어 응답이 렌더 때의 값이 아니라 이것을 본다.
   * 심볼은 `selectSymbol` 로만 바뀌고 거기서 함께 맞춘다.
   */
  const symbolKeyRef = useRef(symbolKey)
  const remembered = symbolLevels !== null && symbolLevels.ocid === ocid ? symbolLevels.levels : null
  const character = ocid === null ? null : (props.characters.find((each) => each.ocid === ocid) ?? null)
  const menu = symbolMenu(character === null ? null : { level: character.level, symbolLevels: remembered })
  const options: SelectOption[] = menu.flatMap((section) =>
    section.symbols.map((symbol) => ({ value: symbol.key, label: symbol.name, group: section.name })),
  )
  // 단계마다 적는 날짜의 주간 기간에 유효한 줄을 더한다. 표가 서기 전 날짜거나 비용이 없는 레벨이면 null 이라
  // 저장을 막는다.
  const cost = found === null ? null : symbolUpgradeCost(found.symbol, range.from, range.to, props.dateKey)
  const amount = cost ?? 0
  // 표가 서는 첫날 전으로는 날짜를 못 고른다. 그 전 날짜로 열린 폼은 저장을 막는다. 안내는 없다(사용자 지정).
  const tableFrom = symbolCostsFrom()
  const beforeTable = !editing && tableFrom !== null && props.dateKey < tableFrom
  const earliest = tableFrom !== null && tableFrom > props.earliestDateKey ? tableFrom : props.earliestDateKey

  function selectSymbol(key: string | null, levels: Readonly<Record<string, number>> | null = remembered): void {
    const next = findSymbol(key)
    symbolKeyRef.current = next === null ? null : next.symbol.key
    setSymbolKey(symbolKeyRef.current)
    setRange(next === null ? EMPTY : rangeFor(next, levels?.[next.symbol.key]))
    setEditingEnd('to')
  }

  function selectCharacter(next: string | null): void {
    setOcid(next)
    const nextCharacter = next === null ? null : (props.characters.find((each) => each.ocid === next) ?? null)
    // 새 캐릭터가 못 쓰는 심볼을 고른 채 두면 화면과 기록이 갈린다. 수정에서는 기록의 심볼을 지키고
    // 만렙 여부는 거르지 않으므로(만렙 묶음에 남는다) 레벨로만 본다.
    if (!editing && found !== null && nextCharacter?.level != null && found.symbol.requiredLevel > nextCharacter.level) {
      selectSymbol(null)
    }
    if (next === null) return
    void props.loadRememberedLevels(next, 'symbol').then((levels) => {
      setSymbolLevels({ ocid: next, levels })
      // 기억이 늦게 와도 고른 심볼의 강화 전을 그 값으로 맞춘다. 수정은 기록의 레벨을 지킨다.
      if (!editing && symbolKeyRef.current !== null) selectSymbol(symbolKeyRef.current, levels)
    })
  }

  useSaveSlot(props.setSave, {
    showSave: true,
    editing,
    canSave: found !== null && cost !== null && range.to > range.from && !beforeTable,
    saving,
    onSave: () => {
      if (found === null) return
      void submit({
        ocid,
        spentOn: props.dateKey,
        category: props.category,
        item: symbolRecordName(found.symbol.name, range.from, range.to),
        itemKey: found.symbol.key,
        formItemKeys: null,
        itemKind: null,
        levelFrom: range.from,
        levelTo: range.to,
        // 수량 칸의 뜻은 `unitPrice` × 수량이라 여기서 안 쓴다.
        quantity: null,
        mesoAmount: amount,
        tariffMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        hexa: null,
      })
    },
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  const icon = found === null ? null : getItemIconUrlByFile(found.symbol.icon)

  useHeaderSlot(props.setHeader, {
    title: spendCategoryNameOf(props.category),
    dateKey: props.dateKey,
    todayDateKey: props.todayDateKey,
    earliestDateKey: earliest,
    onDateChange: props.onDateChange,
    onBack: editing ? undefined : props.onBack,
  })

  return (
    <>
      <FieldCard>
        <CharacterField characters={props.characters} selected={ocid} onSelect={selectCharacter} testID="spend-sheet-chain" />

        <SelectField
          label="심볼"
          options={options}
          selected={symbolKey}
          onSelect={selectSymbol}
          testID="spend-sheet-symbol"
          boxClassName={FIELD_CELL_CLASS}
          renderTrigger={(open, isOpen) => (
            <Pressable
              role="button"
              aria-label="심볼"
              testID="spend-sheet-symbol"
              onPress={open}
              className="min-h-6 flex-1 flex-row items-center gap-3 active:opacity-60"
            >
              <Text className="shrink-0 text-xs text-text-muted">심볼</Text>
              <View className="ml-auto shrink flex-row items-center gap-1.5">
                {icon !== null && (
                  <Image
                    testID="spend-sheet-symbol-icon"
                    source={icon}
                    resizeMode="contain"
                    style={{ width: 22, height: 22 }}
                  />
                )}
                <Text numberOfLines={1} className={`shrink text-sm ${found === null ? 'text-text-disabled' : 'text-text'}`}>
                  {found === null ? '심볼 선택' : found.symbol.name}
                </Text>
              </View>
              <SelectChevron open={isOpen} />
            </Pressable>
          )}
          renderOption={(option, isSelected) => {
            const symbol = findSymbol(option.value)?.symbol
            const optionIcon = symbol === undefined ? null : getItemIconUrlByFile(symbol.icon)
            return (
              <View className="flex-row items-center gap-2.5">
                {optionIcon !== null && (
                  <Image source={optionIcon} resizeMode="contain" style={{ width: 26, height: 26 }} />
                )}
                <Text numberOfLines={1} className={`text-sm ${isSelected ? 'font-semibold text-primary-ink' : 'text-text'}`}>
                  {option.label}
                </Text>
              </View>
            )
          }}
        />

        <View className={`${FIELD_CELL_CLASS} flex-col items-stretch gap-2`}>
          {found === null && (
            <View className="min-h-7 flex-row items-center justify-between">
              <Text className="text-xs text-text-muted">레벨</Text>
              <Text className="text-xs text-text-disabled">심볼을 먼저 고르세요</Text>
            </View>
          )}
          <LevelRangeGrid
            min={1}
            max={found?.group.maxLevel ?? 20}
            range={range}
            editing={editingEnd}
            disabled={found === null}
            onChange={(next) => {
              setRange(next.range)
              setEditingEnd(next.editing)
            }}
            testID="spend-sheet-symbol-level"
          />
        </View>
      </FieldCard>

      <AmountFigure value={amount} unit="메소" testID="spend-sheet-amount" />
    </>
  )
}
