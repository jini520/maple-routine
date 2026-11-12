/**
 * 사냥 기록을 고치거나 지워 조각이 모자랄 때 함께 바뀌는 뒤 기록을 보이는 확인 창.
 *
 * 알림 모달과 같은 머리 · 칸 · 버튼 차례이지만 RN `Modal` 이 아니다. 가격 칸이 입력 카드를 여는데, RN `Modal` 은 앱 맨 위의
 * 별도 창이라 그 아래에 그려지는 입력 카드를 가린다. 그래서 앱 뿌리의 `FragmentCutsHost` 가 시트 위 · 입력 카드 아래에 그린다.
 */
import { useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AlertTriangleIcon, Button, Text } from '../../components/atoms'
import { INSET_ROW_CLASS } from '../../components/molecules/InsetRow/InsetRow'
import { ModalHeader } from '../../components/molecules/ModalHeader/ModalHeader'
import {
  acceptMesoText,
  mesoValueOf,
  optionalMesoTextOf,
  optionalMesoValueOf,
} from '../../components/organisms/MesoPad/meso-pad'
import { ModalSurface } from '../../components/organisms/Modal/Modal'
import { FRAGMENT_PRICE_QUICK_ADDS } from '../../constants/domain/meso-quick-adds'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { FragmentCutRow, FragmentCutsPrompt } from '../../features/cashbook/fragment-cuts'
import { openInputCard } from '../../features/input-card/store'
import { formatMonthDay } from '../../lib/calendar'
import { formatMesoSigned } from '../../lib/cashbook/meso-compact'
import { resolveModalMaxHeight } from '../../lib/modal-metrics'
import { FieldRow } from './sheet-fields'

const TONE_CLASS = { rise: 'text-rise-ink', fall: 'text-fall-ink', muted: 'text-text-muted' } as const

/** 줄의 금액 변화. 가격을 받아야 하는 줄은 받은 가격으로 센다. */
function effectOf(row: FragmentCutRow, price: number | null): { text: string; tone: keyof typeof TONE_CLASS } {
  if (row.side === 'income') {
    const text = `수입 ${formatMesoSigned(row.mesoBefore, '+')} → ${formatMesoSigned(row.mesoAfter ?? 0, '+')}`
    return { text: row.removed ? `${text} · 기록 지움` : text, tone: 'rise' }
  }
  const after = row.mesoAfter ?? (price === null ? null : row.pricedFragments * price)
  if (after === null) return { text: '지출은 개당 가격을 넣으면 셉니다', tone: 'muted' }
  if (after === row.mesoBefore) return { text: '금액 그대로', tone: 'muted' }
  return { text: `지출 ${formatMesoSigned(row.mesoBefore, '−')} → ${formatMesoSigned(after, '−')}`, tone: 'fall' }
}

/** 설명 문장. 고친 사냥의 날짜와 조각 변화가 선다. */
function descriptionOf(prompt: FragmentCutsPrompt): string {
  const date = formatMonthDay(prompt.hunt.earnedOn)
  const tail = '그 조각을 쓴 기록이 아래처럼 바뀝니다.'
  const { change } = prompt.preview
  if (change.kind === 'remove') return `${date} 사냥을 지우면, ${tail}`
  const before = prompt.hunt.hunt?.fragments ?? 0
  const after = change.record.hunt?.fragments ?? 0
  return after < before ? `${date} 사냥의 조각을 ${before}개에서 ${after}개로 줄이면, ${tail}` : `${date} 사냥을 고치면, ${tail}`
}

/**
 * 개당 가격 칸. 누르면 입력 카드가 받는다. 빈 칸과 0 을 가른다. 빈 칸은 아직 안 넣은 것이고, 0 은 돈이 안 든 조각이다.
 * `AmountInput` 은 0 을 빈 칸으로 접어 쓰지 않는다.
 */
function PriceInput(props: { testID: string; value: string; onChange: (next: string) => void }): React.JSX.Element {
  const empty = props.value === ''
  return (
    <Pressable
      testID={props.testID}
      role="button"
      aria-label="개당 가격"
      onPress={() =>
        openInputCard({
          label: '개당 가격',
          context: '솔 에르다 조각 · 개당',
          icon: 'meso',
          unit: '메소',
          reading: true,
          chips: FRAGMENT_PRICE_QUICK_ADDS,
          placeholder: '입력',
          value: props.value,
          onConfirm: (next) => props.onChange(optionalMesoTextOf(optionalMesoValueOf(acceptMesoText(props.value, next)))),
        })
      }
      className="h-5 flex-1"
    >
      <Text className={`text-right text-sm ${empty ? 'text-text-disabled' : 'font-semibold text-text'}`} style={TABULAR_NUMS}>
        {empty ? '입력' : mesoValueOf(props.value).toLocaleString()}
      </Text>
    </Pressable>
  )
}

export function FragmentCutsConfirm(props: { prompt: FragmentCutsPrompt }): React.JSX.Element {
  const { prompt } = props
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const priced = prompt.preview.rows.filter((row) => row.mesoAfter === null)
  const [priceTexts, setPriceTexts] = useState<Readonly<Record<string, string>>>({})
  const priceOf = (id: string): number | null => optionalMesoValueOf(priceTexts[id] ?? '')
  const ready = priced.every((row) => priceOf(row.id) !== null)
  const cancel = (): void => prompt.answer(null)
  const confirm = (): void => {
    if (!ready) return
    prompt.answer(Object.fromEntries(priced.map((row) => [row.id, priceOf(row.id)!])))
  }

  return (
    <Pressable
      testID="fragment-cuts"
      onPress={cancel}
      className="absolute inset-0 items-center justify-center bg-scrim px-4"
    >
      <ModalSurface
        claimsTouch
        maxHeight={resolveModalMaxHeight({
          windowHeightPx: window.height,
          insetTopPx: insets.top,
          insetBottomPx: insets.bottom,
          align: 'center',
        })}
      >
        <ModalHeader icon={AlertTriangleIcon} tone="secondary" title="다른 기록도 함께 바뀝니다" description={descriptionOf(prompt)} />
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} className="mt-4" bounces={false} keyboardShouldPersistTaps="handled">
          <View className="gap-1.5">
            {prompt.preview.rows.map((row) => {
              const effect = effectOf(row, priceOf(row.id))
              return (
                <View key={row.id} testID={`fragment-cuts-row-${row.id}`} className={`flex-row items-center gap-2.5 ${INSET_ROW_CLASS}`}>
                  <View className="min-w-0 flex-1 gap-px">
                    <Text className="text-xs font-semibold text-text">{row.name}</Text>
                    <Text className="text-11 text-text-muted">{row.sub}</Text>
                    <Text testID={`fragment-cuts-effect-${row.id}`} className={`text-11 ${TONE_CLASS[effect.tone]}`}>
                      {effect.text}
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
                    {`${row.fragmentsBefore} → ${row.fragmentsAfter}개`}
                  </Text>
                </View>
              )
            })}
          </View>
          {priced.map((row) => (
            <View key={row.id} className="mt-4 gap-1.5">
              <Text className="text-xs font-bold text-text">{`${row.name} 의 개당 가격`}</Text>
              <FieldRow label="개당 가격">
                <PriceInput
                  testID={`fragment-cuts-price-${row.id}`}
                  value={priceTexts[row.id] ?? ''}
                  onChange={(next) => setPriceTexts((current) => ({ ...current, [row.id]: next }))}
                />
                <Text className="ml-1 text-xs text-text-muted">메소</Text>
              </FieldRow>
            </View>
          ))}
        </ScrollView>
        <View className="mt-4 gap-1">
          <Button
            testID="fragment-cuts-confirm"
            variant="primary"
            onPress={confirm}
            disabled={!ready}
            className={`w-full items-center${ready ? '' : ' opacity-50'}`}
          >
            함께 저장
          </Button>
          <Button testID="fragment-cuts-cancel" variant="text" size="sm" onPress={cancel} className="self-center">
            취소
          </Button>
        </View>
      </ModalSurface>
    </Pressable>
  )
}
