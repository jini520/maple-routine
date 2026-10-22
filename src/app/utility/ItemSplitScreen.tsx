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

import { Card, Switch, Text, TextInput } from '../../components/atoms'
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

function FeeToggle(props: {
  /** 판매·분배. 접근성 이름의 접두이기도 하다. */
  label: string
  value: FeePercent
  onChange: (next: FeePercent) => void
}): React.JSX.Element {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-text">{props.label}</Text>
      <View className="flex-row gap-2">
        {FEE_PERCENTS.map((percent) => {
          const isSelected = props.value === percent
          return (
            <Pressable
              key={percent}
              role="button"
              // RN 의 접근성 상태에 *pressed* 가 없다. 고른 것을 담을 수 있는 것은 `selected`
              // 뿐이다(`DifficultySegment` ①과 같은 처방).
              aria-selected={isSelected}
              aria-label={`${props.label} 수수료 ${percent}%`}
              onPress={() => {
                if (!isSelected) props.onChange(percent)
              }}
              className={`min-w-[56px] items-center rounded-full border px-3 py-1.5 ${
                isSelected ? 'border-primary bg-primary/10' : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-text-muted'}`}
                style={TABULAR_NUMS}
              >
                {percent}%
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function ItemSplitScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const [unit, setUnit] = useState<MesoUnit>(() => mesoUnitOf('itemSplit'))
  /** 칸이 든 글자. **고른 단위의 글자**다(`99.9`). 셈은 메소로 옮긴 값으로 한다. */
  const [saleText, setSaleText] = useState('')
  const salePriceMeso = mesoValueOf(mesoTextOfUnit(saleText, unit))
  const [partySize, setPartySize] = useState(DEFAULT_PARTY_SIZE)
  // 비율 약속은 흔한 일이 아니라 스위치를 켜야 선다. 끄면 지금 그대로 파티원 수로 균등이다.
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
        <Card className="gap-3 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-text-muted">판매가</Text>
            {/* 단위는 입력 칸 바로 위 오른쪽이다. 입력 카드의 단위 세그먼트와 같은 자리다. */}
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

          <TextInput
            aria-label="판매가"
            value={shownUnitText(saleText)}
            onChangeText={(text) => setSaleText(acceptSalePrice(saleText, text, unit))}
            keyboardType="decimal-pad"
            placeholder="0"
            className="h-12 rounded-[10px] border border-border bg-surface-2 px-3 text-right text-2xl font-bold text-text"
            style={TABULAR_NUMS}
          />
          {/* 치는 동안 자릿수를 눈으로 세지 않게 한다. 확정 금액의 `toLocaleString()` 과
              짝이다. 비어 있어도 줄을 그린다. 조건부로 그리면 첫 글자를 치는 순간 이 줄이
              생기며 아래 카드가 통째로 밀린다. 빈 문자열은 줄 높이를 못 만들어 공백 한 칸을
              넣는다. */}
          <Text
            testID="item-split-sale-price-units"
            className="text-right text-xs text-text-muted"
          >
            {salePriceMeso > 0 ? formatMesoUnits(salePriceMeso) : ' '}
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {MESO_QUICK_ADDS.map((chip) => (
              <Pressable
                key={chip.label}
                role="button"
                // 칩은 메소를 더한다. 억 단위에서 `+1억` 은 칸의 수를 1 올린다.
                onPress={() =>
                  setSaleText(unitTextOf(mesoTextOf(Math.min(salePriceMeso + chip.value, MAX_SALE_PRICE_MESO)), unit))
                }
                className="rounded-full border border-border bg-surface px-3 py-1.5"
              >
                <Text className="text-xs font-medium text-text-muted">{chip.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card className="gap-3 px-4 py-4">
          {/* 비율을 켜면 파티원 수가 사라진다. 비율은 `나 : 나머지` 라 두 쪽이고 인원이 식에
              안 들어간다. */}
          {shares === null && (
            <>
              <Text className="text-xs font-semibold text-text-muted">파티원 수</Text>
              <Stepper
                size="lg"
                label="분배 파티원 수"
                value={partySize}
                max={MAX_PARTY_SIZE}
                onChange={setPartySize}
              />
            </>
          )}

          <Switch
            on={shares !== null}
            label="비율로 입력"
            size="lg"
            className="justify-between"
            // 반반으로 시작한다. 아무것도 약속하지 않은 상태다.
            onToggle={() => setShares(shares === null ? { myShare: 1, sharesTotal: 2 } : null)}
          >
            <Text className="text-xs font-semibold text-text-muted">비율로 입력</Text>
          </Switch>

          {/* 받는 사람들의 비율은 나머지를 고르게 나눈 것으로 본다. 파는 사람이 아는 것은 자기
              몫과 합뿐이다. */}
          {shares !== null && <ShareField label="내 몫" value={shares} onChange={setShares} />}
        </Card>

        <Card className="gap-3 px-4 py-4">
          <Text className="text-xs font-semibold text-text-muted">경매장 수수료</Text>
          {/* MVP 실버 등급 이상이면 5% → 3%(사용자 확인). 판매와 분배를
              각각 고르는 것이 결정이다. 세 대표 상황 밖의 조합도 나온다. */}
          <FeeToggle label="판매" value={saleFeePercent} onChange={setSaleFeePercent} />
          <FeeToggle label="분배" value={splitFeePercent} onChange={setSplitFeePercent} />
        </Card>

        <Card className="items-center gap-1 px-4 py-5">
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
        </Card>
      </View>
    </ScreenScroll>
  )
}
