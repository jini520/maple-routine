/**
 * 심볼 강화의 폼. 갈래를 고르면 곧바로 선다. 캐릭터 · 심볼 · 레벨 · 금액 차례다.
 *
 * 레벨마다 비용이 달라 `unitPrice` × 수량으로 못 낸다. 금액은 강화 전부터 강화 후 바로 앞까지 단계
 * 비용의 합이고, 저장할 때 계산해 굳힌다.
 */
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { ChevronDownIcon, Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { SelectField, type SelectOption } from '../../../components/organisms/SelectField/SelectField'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { useSpendSubmit } from '../../../hooks/useSpendSubmit'
import { getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import { spendCategoryNameOf } from '../../../lib/cashbook/categories'
import {
  SYMBOL_COSTS_FROM,
  findSymbol,
  symbolMenu,
  symbolRecordName,
  symbolUpgradeCost,
} from '../../../lib/cashbook/symbol-costs'
import { CharacterField } from '../sheet-fields'
import { SpendHeader, useSaveSlot, type SpendFormProps } from './form-shared'
import { type LevelRange } from './level-range'
import { LevelRangeSlider } from './LevelRangeSlider'

/** 심볼을 고르기 전의 자리. 칸만 흐리게 서므로 값은 뜻이 없다. */
const EMPTY: LevelRange = { from: 1, to: 1 }

export function SymbolForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [symbolKey, setSymbolKey] = useState<string | null>(props.editing?.itemKey ?? null)
  const [range, setRange] = useState<LevelRange>(() => ({
    from: props.editing?.levelFrom ?? EMPTY.from,
    to: props.editing?.levelTo ?? EMPTY.to,
  }))
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  /** 넥슨이 준 그 캐릭터의 심볼 레벨. 만렙 묶음을 가른다. 다른 캐릭터의 것이 남지 않게 ocid 를 함께 든다. */
  const [symbolLevels, setSymbolLevels] = useState<{ ocid: string; levels: Readonly<Record<string, number>> } | null>(null)
  const { saving, submit, remove } = useSpendSubmit(props)

  const found = findSymbol(symbolKey)
  const character = ocid === null ? null : (props.characters.find((each) => each.ocid === ocid) ?? null)
  const menu = symbolMenu(
    character === null
      ? null
      : { level: character.level, symbolLevels: symbolLevels?.ocid === ocid ? symbolLevels.levels : null },
  )
  const options: SelectOption[] = menu.flatMap((section) =>
    section.symbols.map((symbol) => ({ value: symbol.key, label: symbol.name, group: section.name })),
  )
  const amount = found === null ? 0 : symbolUpgradeCost(found.symbol, range.from, range.to)
  // 표는 2026-09-17 부터다. 그 전 날짜로 열린 폼은 저장을 막는다. 안내는 없다(사용자 지정).
  const beforeTable = !editing && props.dateKey < SYMBOL_COSTS_FROM
  const earliest = props.earliestDateKey > SYMBOL_COSTS_FROM ? props.earliestDateKey : SYMBOL_COSTS_FROM

  function selectSymbol(key: string | null): void {
    const next = findSymbol(key)
    setSymbolKey(next === null ? null : next.symbol.key)
    setRange(next === null ? EMPTY : { from: next.group.defaultRange[0], to: next.group.defaultRange[1] })
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
    void props.loadSymbolLevels(next).then((levels) => {
      if (levels !== null) setSymbolLevels({ ocid: next, levels })
    })
  }

  useSaveSlot(props.setSave, {
    showSave: true,
    editing,
    canSave: found !== null && range.to > range.from && !beforeTable,
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
        memo: null,
      })
    },
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  const icon = found === null ? null : getItemIconUrlByFile(found.symbol.icon)

  return (
    <>
      <SpendHeader
        title={spendCategoryNameOf(props.category)}
        dateKey={props.dateKey}
        todayDateKey={props.todayDateKey}
        earliestDateKey={earliest}
        onDateChange={props.onDateChange}
        onBack={editing ? undefined : props.onBack}
      />

      <CharacterField characters={props.characters} selected={ocid} onSelect={selectCharacter} testID="spend-sheet-chain" />

      <SelectField
        label="심볼"
        options={options}
        selected={symbolKey}
        onSelect={selectSymbol}
        testID="spend-sheet-symbol"
        renderTrigger={(open) => (
          <Pressable
            role="button"
            aria-label="심볼"
            testID="spend-sheet-symbol"
            onPress={open}
            className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2 active:opacity-60"
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
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-text-disabled" strokeWidth={2} aria-hidden />
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

      <View className="gap-2 border-b border-border pb-2">
        <View className="min-h-7 flex-row items-center justify-between">
          <Text className="text-xs text-text-muted">레벨</Text>
          {found === null ? (
            <Text className="text-xs text-text-disabled">심볼을 먼저 고르세요</Text>
          ) : (
            <View className="flex-row items-center gap-1.5">
              <Text className="text-sm font-bold text-text" style={TABULAR_NUMS}>
                {`Lv.${range.from} → Lv.${range.to}`}
              </Text>
              <Text className="rounded-full bg-primary-tint px-2 py-0.5 text-11 font-bold text-primary-ink" style={TABULAR_NUMS}>
                {`${range.to - range.from}단계`}
              </Text>
            </View>
          )}
        </View>
        <LevelRangeSlider
          max={found?.group.maxLevel ?? 20}
          from={range.from}
          to={range.to}
          disabled={found === null}
          onChange={setRange}
        />
      </View>

      <AmountFigure value={amount} unit="메소" testID="spend-sheet-amount" />
    </>
  )
}
