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

import { Badge, CopyIcon, Text, TextInput } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { Stepper } from '../../components/molecules/Stepper/Stepper'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { useToastStore } from '../../features/toast/store'
import { copyText, systemAnnouncesCopy } from '../../native/clipboard'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { formatMesoUnits } from '../../lib/drop/drop-price'
import { acceptSharePercentText, sharesFromPercentText } from '../../lib/boss/party-shares'
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
      <Text className="text-xs text-text">{props.label}</Text>
      <Segment
        options={FEE_OPTIONS}
        selected={`${props.value}%`}
        size="md"
        onSelect={(option) => props.onChange(Number.parseInt(option, 10) as FeePercent)}
      />
    </View>
  )
}

/** 16px 복사 아이콘의 누르는 영역을 권장 크기 44px 로 넓히는 값. */
const COPY_HIT_SLOP = 14

/**
 * 정산 금액을 쉼표 없는 숫자로 클립보드에 넣는 함수. 다른 앱의 숫자 칸에 붙일 값이라 쉼표 · 단위를 넣지 않는다.
 *
 * 성공 토스트는 OS 가 스스로 복사를 알리는 기기에서 건너뛴다. 실패하면 OS 알림이 없으므로 어느 기기에서나 알린다.
 */
async function copyTransfer(transfer: number): Promise<void> {
  try {
    await copyText(String(transfer))
  } catch {
    useToastStore.getState().showError('정산 금액을 복사하지 못했습니다')
    return
  }
  if (!systemAnnouncesCopy()) useToastStore.getState().showSuccess('정산 금액을 복사했어요')
}

/** 테두리 없는 카드. 이 화면의 카드는 바탕색만으로 갈린다. */
const CARD_CLASS = 'rounded-[14px] bg-surface'

const SPLIT_OPTIONS = ['기본', '비율'] as const

/** `비율` 을 고르면 놓이는 내 몫. 50% 는 2명이 똑같이 나눌 때와 같다. */
const START_PERCENT_TEXT = '50'

export function ItemSplitScreen(): React.JSX.Element {
  const faq = useFaqSheet('utility-item-split')
  const navigation = useScreenNavigation()
  const [unit, setUnit] = useState<MesoUnit>(() => mesoUnitOf('itemSplit'))
  /** 칸이 든 글자. **고른 단위의 글자**다(`99.9`). 셈은 메소로 옮긴 값으로 한다. */
  const [saleText, setSaleText] = useState('')
  const salePriceMeso = mesoValueOf(mesoTextOfUnit(saleText, unit))
  const [partySize, setPartySize] = useState(DEFAULT_PARTY_SIZE)
  // `비율` 을 골라야 선다. `기본` 이면 파티원 수로 균등이다.
  const [shares, setShares] = useState<{ myShare: number; sharesTotal: number } | null>(null)
  /** `분배 비율` 칸의 글자. `33.` 처럼 치는 중인 글자도 칸에는 남아야 해서 비율과 따로 든다. */
  const [percentText, setPercentText] = useState(START_PERCENT_TEXT)
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
            <View className="flex-row items-center">
              <Text className="text-lg font-bold text-text">{ITEM_SPLIT_TOOL_NAME}</Text>
              <FaqButton sheet={faq} />
            </View>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-4 px-4 pb-4" testID="screen-UtilityItemSplit">
        <View className={`${CARD_CLASS} gap-3 p-4`}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-text">판매가</Text>
            {/* 단위는 값 상자 바로 위 오른쪽이다. 입력 카드의 단위 세그먼트와 같은 자리다. */}
            <View className="flex-row items-center gap-3">
              {salePriceMeso > 0 && (
                <Pressable role="button" aria-label="금액 초기화" onPress={() => setSaleText('')}>
                  <Text className="text-xs font-semibold text-text-muted">초기화</Text>
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
              className="h-9 flex-1 text-right font-semibold text-text"
              style={[TABULAR_NUMS, { fontSize: 18 }]}
            />
            <Text className="shrink-0 text-xs text-text-muted">
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
            <Text className="text-xs font-bold text-text">분배 방식</Text>
            <Segment
              options={SPLIT_OPTIONS}
              selected={shares === null ? '기본' : '비율'}
              size="md"
              // 50% 로 시작한다. 아무것도 약속하지 않은 상태다. 파티원 수는 그대로 들고 있다.
              onSelect={(option) => {
                setPercentText(START_PERCENT_TEXT)
                setShares(option === '기본' ? null : sharesFromPercentText(START_PERCENT_TEXT))
              }}
            />
          </View>

          {/*
            값 줄은 바탕 칸 없이 카드 위에 바로 놓는다. 드롭 가격 카드의 줄과 같은 짜임이다. 높이 36 을 못박는다.
            두 줄의 높이가 다르면 세그먼트를 누를 때마다 아래 카드가 뛴다.
          */}
          <View testID="item-split-split-body" className="h-9 flex-row items-center gap-2">
            {shares === null ? (
              <>
                <Text className="text-xs leading-[14px] tracking-[.04em] text-text-muted">파티 인원</Text>
                <Badge variant="primary" size="xs" style={TABULAR_NUMS}>
                  최대 {MAX_PARTY_SIZE}명
                </Badge>
                <View className="flex-1" />
                <Stepper
                  size="md"
                  label="분배 파티원 수"
                  value={partySize}
                  max={MAX_PARTY_SIZE}
                  onChange={setPartySize}
                />
              </>
            ) : (
              // 받는 사람들의 비율은 나머지를 고르게 나눈 것으로 본다. 파는 사람이 아는 것은 자기 몫뿐이다.
              <>
                <Text className="flex-1 text-xs tracking-[.04em] text-text-muted">분배 비율</Text>
                <TextInput
                  aria-label="분배 비율 내 몫"
                  value={percentText}
                  onChangeText={(next) => {
                    const text = acceptSharePercentText(percentText, next)
                    setPercentText(text)
                    const parsed = sharesFromPercentText(text)
                    if (parsed !== null) setShares(parsed)
                  }}
                  keyboardType="decimal-pad"
                  className="h-[25px] min-w-[44px] text-right text-lg font-semibold text-text"
                  style={TABULAR_NUMS}
                />
                <Text className="text-xs text-text-muted">%</Text>
              </>
            )}
          </View>
        </View>

        <View className={`${CARD_CLASS} gap-3 p-4`}>
          <Text className="text-xs font-bold text-text">경매장 수수료</Text>
          {/* MVP 실버 등급 이상이면 5% → 3%(사용자 확인). 판매와 분배를
              각각 고르는 것이 결정이다. 세 대표 상황 밖의 조합도 나온다. */}
          <FeeRow label="판매" value={saleFeePercent} onChange={setSaleFeePercent} />
          <FeeRow label="분배" value={splitFeePercent} onChange={setSplitFeePercent} />
        </View>

        <View className={`${CARD_CLASS} items-center gap-1 px-4 py-5`}>
          <Text className="text-xs text-text-muted">정산 금액</Text>
          {salePriceMeso === 0 ? (
            <Text className="pt-1 text-sm text-text-muted">판매가를 입력하세요</Text>
          ) : transfer === null ? (
            <Text className="pt-1 text-sm text-text-muted">혼자서는 나눌 것이 없습니다</Text>
          ) : (
            <>
              <View className="flex-row items-baseline gap-1">
                <Text
                  testID="item-split-transfer"
                  className="text-2xl font-bold text-text"
                  style={TABULAR_NUMS}
                >
                  {transfer.toLocaleString()}
                </Text>
                <Text className="text-xs text-text-muted">메소</Text>
                <Pressable
                  role="button"
                  aria-label="정산 금액 복사"
                  hitSlop={COPY_HIT_SLOP}
                  className="ml-1 self-center"
                  onPress={() => void copyTransfer(transfer)}
                >
                  <CopyIcon className="h-4 w-4 text-text-muted" aria-hidden />
                </Pressable>
              </View>
              <Text className="text-xs text-text-muted">{formatMesoUnits(transfer)}</Text>
            </>
          )}
        </View>
      </View>
    </ScreenScroll>
  )
}
