/**
 * 아이템 분배 계산기 화면. 파티가 먹은 아이템을 한 명이 팔아 나눠 줄 때 한 명에게 보낼 금액을 낸다.
 *
 * 수수료가 두 번 떼여서(판매 · 분배) 정산 대상 ÷ 인원을 그대로 보내면 받는 사람만 분배 수수료를
 * 물어 균등이 깨진다. 화면이 내놓는 것은 그 역산값 하나다.
 *
 * 계산은 전부 `lib/cashbook/item-split` 이 진다. 여기에는 어떤 입력이 그 인자로 가는가만 있다.
 *
 * 자체 키패드를 두지 않는다. 시트 안이 아니라 스크롤되는 전체 화면이라 키보드가 밀 것이 없다.
 * 자릿수 문제는 단위 칩과 금액 단위 세그먼트(기본 · 만 · 억)로 받는다.
 */

import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Badge, Text, TextInput } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { ShareField } from '../../components/molecules/ShareField/ShareField'
import { Stepper } from '../../components/molecules/Stepper/Stepper'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { formatMesoUnits } from '../../lib/drop/drop-price'
import {
  MAX_PARTY_SIZE,
  MAX_SALE_PRICE_MESO,
  transferPerMember,
  type FeePercent,
} from '../../lib/cashbook/item-split'
import { MESO_QUICK_ADDS } from '../../constants/domain/meso-quick-adds'
import { Segment } from '../../components/molecules/Segment/Segment'
import { mesoTextOf, mesoValueOf } from '../../components/organisms/MesoPad/meso-pad'
import {
  MESO_UNITS,
  MESO_UNIT_LABELS,
  acceptUnitText,
  mesoTextOfUnit,
  shownUnitText,
  unitTextOf,
} from '../../components/organisms/MesoPad/meso-unit'
import { mesoUnitOf, rememberMesoUnit } from '../../features/input-card/meso-unit'
import type { MesoUnit } from '../../types/meso-unit'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { ITEM_SPLIT_TOOL_NAME } from './tool-names'

const FEE_PERCENTS = [3, 5] as const satisfies readonly FeePercent[]

/**
 * 처음 서 있는 값.
 *
 * 파티원 수 2. 정원(6)이 아니라 나눌 수 있는 가장 작은 파티다. 스테퍼가 올리기만 하면 되고,
 * 1 로 내려가면 결과가 사라져 보낼 곳이 없다 를 곧바로 만난다.
 *
 * 수수료는 모든 파티원이 실버등급 이상이고 모든 거래를 경매장으로 하는 경우다.
 */
const DEFAULT_PARTY_SIZE = 2
const DEFAULT_FEE_PERCENT: FeePercent = 3

const UNIT_OPTIONS = MESO_UNITS.map((unit) => MESO_UNIT_LABELS[unit])

/**
 * 친 글자 중 칸에 남길 것. 숫자와 소수점만 흘리고, **상한을 넘으면 상한에서 멈춘다.**
 *
 * 입력 카드처럼 앞 글자로 되돌리지 않는 것은 이 칸이 붙여넣기도 받기 때문이다. 상한을 넘으면
 * `N × 100` 이 안전 정수를 벗어나 계산이 조용히 틀린다.
 */
function acceptSalePrice(prev: string, text: string, unit: MesoUnit): string {
  const accepted = acceptUnitText(prev, text, unit)
  const int = text.replace(/[^0-9.]/g, '').split('.')[0] ?? ''
  if (accepted === prev && int !== '' && Number(mesoTextOfUnit(int, unit)) > MAX_SALE_PRICE_MESO) {
    return unitTextOf(String(MAX_SALE_PRICE_MESO), unit)
  }
  return accepted
}

const FEE_OPTIONS = FEE_PERCENTS.map((percent) => `${percent}%` as const)

/** 수수료 한 줄. 두 줄이 같은 글자(`3%` · `5%`)라 줄째 `testID` 로 가른다. */
function FeeRow(props: {
  /** 판매 · 분배 */
  label: '판매' | '분배'
  value: FeePercent
  onChange: (next: FeePercent) => void
}): React.JSX.Element {
  return (
    <View testID={`item-split-fee-${props.label}`} className="flex-row items-center justify-between">
      <Text className="text-sm text-text">{props.label}</Text>
      <Segment
        options={FEE_OPTIONS}
        selected={`${props.value}%`}
        size="md"
        onSelect={(option) => props.onChange(Number.parseInt(option, 10) as FeePercent)}
      />
    </View>
  )
}

/** 테두리 없는 카드. 이 화면의 카드는 바탕색만으로 갈린다. */
const CARD_CLASS = 'rounded-[14px] bg-surface'

const SPLIT_OPTIONS = ['기본', '비율'] as const

export function ItemSplitScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const [unit, setUnit] = useState<MesoUnit>(() => mesoUnitOf('itemSplit'))
  /** 칸이 든 글자. **고른 단위의 글자**다(`99.9`). 셈은 메소로 옮긴 값으로 한다. */
  const [saleText, setSaleText] = useState('')
  const salePriceMeso = mesoValueOf(mesoTextOfUnit(saleText, unit))
  const [partySize, setPartySize] = useState(DEFAULT_PARTY_SIZE)
  // `비율` 을 골라야 선다. `기본` 이면 파티원 수로 균등이다.
  const [shares, setShares] = useState<{ myShare: number; sharesTotal: number } | null>(null)
  const [saleFeePercent, setSaleFeePercent] = useState<FeePercent>(DEFAULT_FEE_PERCENT)
  const [splitFeePercent, setSplitFeePercent] = useState<FeePercent>(DEFAULT_FEE_PERCENT)

  const transfer = transferPerMember({
    salePriceMeso,
    partySize,
    saleFeePercent,
    splitFeePercent,
    myShare: shares?.myShare ?? null,
    sharesTotal: shares?.sharesTotal ?? null,
  })

  return (
    <ScreenScroll
      hasTabBar={false}
      keyboardAware
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <BackButton onPress={() => navigation.goBack()} />
            <Text className="text-lg font-semibold text-text">{ITEM_SPLIT_TOOL_NAME}</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-4 px-4 pb-4" testID="screen-UtilityItemSplit">
        <View className={`${CARD_CLASS} gap-3 p-4`}>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-text">판매가</Text>
            {/* 단위는 값 상자 바로 위 오른쪽이다. 입력 카드의 단위 세그먼트와 같은 자리다. */}
            <View className="flex-row items-center gap-3">
              {salePriceMeso > 0 && (
                <Pressable role="button" aria-label="금액 초기화" onPress={() => setSaleText('')}>
                  <Text className="text-xs font-medium text-text-muted">초기화</Text>
                </Pressable>
              )}
              <Segment
                options={UNIT_OPTIONS}
                selected={MESO_UNIT_LABELS[unit]}
                size="sm"
                onSelect={(label) => {
                  const next = MESO_UNITS.find((candidate) => MESO_UNIT_LABELS[candidate] === label) ?? 'base'
                  // 값은 그대로 두고 칸의 숫자만 그 단위로 다시 적는다.
                  setSaleText(unitTextOf(mesoTextOfUnit(saleText, unit), next))
                  setUnit(next)
                  rememberMesoUnit('itemSplit', next)
                }}
              />
            </View>
          </View>

          {/* 입력 카드의 값 상자와 같은 모양이다. 단위 읽기를 상자 안 위 오른쪽에 겹쳐 두어, 값을 치기
              시작해도 상자 높이가 안 바뀐다. 비어 있어도 공백 한 칸을 넣어 자리를 지킨다. */}
          <View className="relative min-h-14 flex-row items-center gap-2 rounded-xl bg-card-inset px-3.5 pb-1 pt-[18px]">
            <Text
              testID="item-split-sale-price-units"
              numberOfLines={1}
              className="absolute right-3.5 top-1.5 text-11 text-text-muted"
              style={TABULAR_NUMS}
            >
              {salePriceMeso > 0 ? formatMesoUnits(salePriceMeso) : ' '}
            </Text>
            <TextInput
              aria-label="판매가"
              value={shownUnitText(saleText)}
              onChangeText={(text) => setSaleText(acceptSalePrice(saleText, text, unit))}
              keyboardType="decimal-pad"
              placeholder="0"
              className="h-9 flex-1 text-right font-bold text-text"
              style={[TABULAR_NUMS, { fontSize: 20 }]}
            />
            <Text className="shrink-0 text-xs font-semibold text-text-muted">
              {unit === 'base' ? '메소' : `${MESO_UNIT_LABELS[unit]} 메소`}
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-end gap-1.5">
            {MESO_QUICK_ADDS.map((chip) => (
              <Pressable
                key={chip.label}
                role="button"
                // 칩은 메소를 더한다. 억 단위에서 `+1억` 은 칸의 수를 1 올린다.
                onPress={() =>
                  setSaleText(unitTextOf(mesoTextOf(Math.min(salePriceMeso + chip.value, MAX_SALE_PRICE_MESO)), unit))
                }
                className="h-6 justify-center rounded-full bg-card-inset px-2"
              >
                <Text className="text-11 font-semibold text-text-muted" style={TABULAR_NUMS}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className={`${CARD_CLASS} gap-3 p-4`}>
          {/* 금액 단위 세그먼트에도 `기본` 이 있어 줄째 `testID` 로 가른다. */}
          <View testID="item-split-split" className="flex-row items-center justify-between gap-2.5">
            <Text className="text-13 font-bold text-text">분배 방식</Text>
            <Segment
              options={SPLIT_OPTIONS}
              selected={shares === null ? '기본' : '비율'}
              size="md"
              // 반반으로 시작한다. 아무것도 약속하지 않은 상태다. 파티원 수는 그대로 들고 있다.
              onSelect={(option) => setShares(option === '기본' ? null : { myShare: 1, sharesTotal: 2 })}
            />
          </View>

          {/* 두 칸의 높이를 96 으로 못박는다. 다르면 세그먼트를 누를 때마다 아래 카드가 뛴다. */}
          <View testID="item-split-split-body" className="h-24 rounded-[12px] bg-card-inset px-3 pb-3 pt-[11px]">
            {shares === null ? (
              <>
                <View className="flex-row items-center justify-between gap-1.5">
                  <Text className="text-11 font-semibold leading-[14px] tracking-[.04em] text-text-muted">
                    파티 인원
                  </Text>
                  <Badge variant="primary" size="xs" style={TABULAR_NUMS}>
                    최대 {MAX_PARTY_SIZE}명
                  </Badge>
                </View>
                <View className="flex-1 items-center justify-center">
                  <Stepper
                    size="md"
                    label="분배 파티원 수"
                    value={partySize}
                    max={MAX_PARTY_SIZE}
                    onChange={setPartySize}
                  />
                </View>
              </>
            ) : (
              // 받는 사람들의 비율은 나머지를 고르게 나눈 것으로 본다. 파는 사람이 아는 것은 자기
              // 몫과 합뿐이다.
              <ShareField label="내 몫" value={shares} onChange={setShares} />
            )}
          </View>
        </View>

        <View className={`${CARD_CLASS} gap-3 p-4`}>
          <Text className="text-13 font-bold text-text">경매장 수수료</Text>
          {/* MVP 실버 등급 이상이면 5% → 3%(사용자 확인). 판매와 분배를
              각각 고르는 것이 결정이다. 세 대표 상황 밖의 조합도 나온다. */}
          <FeeRow label="판매" value={saleFeePercent} onChange={setSaleFeePercent} />
          <FeeRow label="분배" value={splitFeePercent} onChange={setSplitFeePercent} />
        </View>

        <View className={`${CARD_CLASS} items-center gap-1 px-4 py-5`}>
          <Text className="text-xs font-semibold text-text-muted">정산 금액</Text>
          {salePriceMeso === 0 ? (
            <Text className="pt-1 text-sm text-text-muted">판매가를 입력하세요</Text>
          ) : transfer === null ? (
            <Text className="pt-1 text-sm text-text-muted">혼자서는 나눌 것이 없습니다</Text>
          ) : (
            <>
              <View className="flex-row items-baseline gap-1">
                <Text
                  testID="item-split-transfer"
                  className="text-3xl font-bold text-text"
                  style={TABULAR_NUMS}
                >
                  {transfer.toLocaleString()}
                </Text>
                <Text className="text-sm font-semibold text-text-muted">메소</Text>
              </View>
              <Text className="text-xs text-text-muted">{formatMesoUnits(transfer)}</Text>
            </>
          )}
        </View>
      </View>
    </ScreenScroll>
  )
}
