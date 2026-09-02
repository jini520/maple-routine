/**
 * 아이템 분배 계산기 — 유틸리티의 첫 도구.
 *
 * ## 무엇을 푸는가
 *
 * 파티가 먹은 아이템을 한 명이 경매장에 팔아 나눠 줄 때 **수수료가 두 번** 떼인다(판매 · 분배).
 * 그래서 「정산 대상 ÷ 인원」을 그대로 보내면 받는 사람만 분배 수수료를 물어 균등이 깨진다.
 * 화면이 내놓는 것은 그 역산값 하나 — **한 명에게 보낼 금액**이다.
 *
 * 계산은 전부 `lib/cashbook/item-split` 이 진다. 이 파일에는 «어떤 입력이 그 인자로 가는가» 만 있다.
 *
 * ## 금액 입력에 자체 키패드를 두지 않는다
 *
 * `DropPricePad`가 키패드를 그리는 이유는 둘이었고 여기서는 하나만 남는다 —
 * *"자릿수를 세게 된다"* 는 여기서도 참이지만(그래서 **단위 칩을 가져온다**), *"키보드가 뜨면
 * 시트가 밀리거나 잘린다"* 는 바텀시트 안이라서 생긴 문제고 이 화면은 스크롤되는 전체 화면이다.
 * 324줄짜리 패드를 추출 리팩터해서 얻는 것이 «여기서는 성립하지 않는 이유» 하나뿐이라 안 한다.
 */

import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ArrowLeftIcon, Card, Text, TextInput } from '../../components/atoms'
import { PartySizeStepper } from '../../components/molecules/PartySizeStepper/PartySizeStepper'
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
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useScreenNavigation } from '../use-screen-navigation'
import { ITEM_SPLIT_TOOL_NAME } from './tool-names'

const FEE_PERCENTS = [3, 5] as const satisfies readonly FeePercent[]

/**
 * 처음 서 있는 값.
 *
 * 파티원 수 **2**(사용자 지정, 2026-08-23) — 정원(6)이 아니라 «나눌 수 있는 가장 작은 파티» 다.
 * 스테퍼가 올리기만 하면 되고, 1 로 내려가면 결과가 사라져 «보낼 곳이 없다» 를 곧바로 만난다.
 *
 * 수수료는 사용자가 첫 번째로 든 상황(*"모든 파티원이 실버등급 이상이 모든 거래를 경매장으로
 * 하는 경우"*)이다.
 */
const DEFAULT_PARTY_SIZE = 2
const DEFAULT_FEE_PERCENT: FeePercent = 3

/** 친 글자에서 금액을 읽는다 — 숫자가 아닌 것은 흘리고 상한에서 멈춘다. */
function parseMesoInput(text: string): number {
  const digits = text.replace(/[^0-9]/g, '')
  if (digits === '') return 0
  const parsed = Number(digits)
  if (!Number.isFinite(parsed)) return MAX_SALE_PRICE_MESO
  return Math.min(parsed, MAX_SALE_PRICE_MESO)
}

function FeeToggle(props: {
  /** 「판매」·「분배」 — 접근성 이름의 접두이기도 하다. */
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
              // RN 의 접근성 상태에 *pressed* 가 없다 — 고른 것을 담을 수 있는 것은 `selected`
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
  const [salePriceMeso, setSalePriceMeso] = useState(0)
  const [partySize, setPartySize] = useState(DEFAULT_PARTY_SIZE)
  const [saleFeePercent, setSaleFeePercent] = useState<FeePercent>(DEFAULT_FEE_PERCENT)
  const [splitFeePercent, setSplitFeePercent] = useState<FeePercent>(DEFAULT_FEE_PERCENT)

  const transfer = transferPerMember({ salePriceMeso, partySize, saleFeePercent, splitFeePercent })

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <Pressable
              role="button"
              aria-label="뒤로"
              onPress={() => navigation.goBack()}
              className="-ml-1 p-1"
            >
              <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
            <Text className="text-lg font-semibold text-text">{ITEM_SPLIT_TOOL_NAME}</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-4 px-4 pb-4" testID="screen-UtilityItemSplit">
        <Card className="gap-3 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-text-muted">판매가</Text>
            {salePriceMeso > 0 && (
              <Pressable role="button" aria-label="금액 초기화" onPress={() => setSalePriceMeso(0)}>
                <Text className="text-xs font-medium text-text-muted">초기화</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            aria-label="판매가"
            value={salePriceMeso === 0 ? '' : salePriceMeso.toLocaleString()}
            onChangeText={(text) => setSalePriceMeso(parseMesoInput(text))}
            keyboardType="number-pad"
            placeholder="0"
            className="rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-right text-2xl font-extrabold text-text"
            style={TABULAR_NUMS}
          />
          {/* 치는 동안 자릿수를 눈으로 세지 않게 한다 — 확정 금액의 `toLocaleString()` 과 짝이다.
              **비어 있어도 줄을 그린다**(사용자 지정, 2026-08-23) — 조건부로 그리면 첫 글자를
              치는 순간 이 줄이 생기며 아래 카드가 통째로 밀린다. 빈 문자열은 줄 높이를 못 만들어
              공백 한 칸을 넣는다. */}
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
                onPress={() =>
                  setSalePriceMeso((current) => Math.min(current + chip.value, MAX_SALE_PRICE_MESO))
                }
                className="rounded-full border border-border bg-surface px-3 py-1.5"
              >
                <Text className="text-xs font-medium text-text-muted">{chip.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card className="gap-3 px-4 py-4">
          <Text className="text-xs font-semibold text-text-muted">파티원 수</Text>
          <PartySizeStepper
            label="분배"
            value={partySize}
            max={MAX_PARTY_SIZE}
            onChange={setPartySize}
          />
        </Card>

        <Card className="gap-3 px-4 py-4">
          <Text className="text-xs font-semibold text-text-muted">경매장 수수료</Text>
          {/* MVP 실버 등급 이상이면 5% → 3%(사용자 확인 2026-08-23). 판매와 분배를
              각각 고르는 것이 결정이다 — 세 대표 상황 밖의 조합도 나온다. */}
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
                  className="text-3xl font-extrabold text-text"
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
