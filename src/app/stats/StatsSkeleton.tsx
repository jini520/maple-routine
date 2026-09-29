/**
 * 통계의 조회 중 자리. 읽기 전에 `0 메소` 와 빈 그래프로 기록이 없다고 말하지 않으려고 둔다.
 *
 * 카드 제목은 그대로 세우고 본문만 막대로 채운다. 본문 높이는 각 카드의 상수(그래프 높이 · 말풍선 자리 ·
 * 단상 블록 · 도넛 비율)와 글자 줄 높이에서 온다. 카드 모양을 고치면 여기 높이도 함께 고칠 것.
 */
import { useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { Path } from 'react-native-svg'

import { Skeleton } from '../../components/atoms'
import { Svg } from '../../lib/nativewind-interop'
import { StatsSection } from './StatsSection'

/** `typography.cjs` 의 줄 높이(px). 막대가 아니라 그 글자가 설 상자의 높이다 */
const LINE = { 11: 16, xl: 28, '2xl': 31 } as const

/** `TrendSection` 의 말풍선 자리 · 그래프 높이 · 왼쪽 눈금 폭 · 아래 축 높이 · 위 여백 */
const TREND = { bubble: 54, chart: 150, axisLeft: 46, axisBottom: 20, topPad: 8 } as const
/** 추이 막대 여덟의 높이. 0 선에서 위(+) · 아래(−)로 뻗는 비율이라 순수익 그래프로 읽힌다 */
const TREND_BARS = [0.35, 0.6, -0.25, 0.5, 0.8, -0.4, 0.55, 0.7] as const
/** `CumulativeSection` 의 말풍선 자리 · 그래프 높이 · 위아래 여백 */
const CUMULATIVE = { bubble: 42, chart: 96, pad: 8 } as const
/** 누적 곡선을 잇는 점 수 */
const CUMULATIVE_POINTS = 32
/** `CharacterSection` 의 단상. 그림 자리 높이와 2 · 1 · 3 위 블록 높이 */
const PODIUM = { figure: 62, blocks: [60, 74, 50] } as const
/** `CategorySection` 의 반원 도넛. 폭 300 기준 좌표다 */
const DONUT = { width: 300, cx: 116, cy: 122, outer: 108, inner: 52 } as const

/** 글자 한 줄의 자리. 막대는 줄 높이보다 낮게 세워야 글자로 읽힌다 */
function LineBar(props: { height: number; className: string }): React.JSX.Element {
  return (
    <View style={{ height: props.height }} className="justify-center">
      <Skeleton className={props.className} />
    </View>
  )
}

/** 0 선 위아래로 뻗은 막대 여덟과 아래 축 글자 자리 */
function TrendChart(): React.JSX.Element {
  const plotHeight = TREND.chart - TREND.topPad - TREND.axisBottom
  const zeroY = TREND.topPad + plotHeight / 2
  return (
    <View style={{ height: TREND.chart }}>
      {/* 눈금 글자 다섯. 순수익 그래프는 위 끝부터 아래 끝까지 4등분한 자리에 선다. */}
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} className="absolute left-0 h-2 w-7" style={{ top: TREND.topPad + (plotHeight / 4) * index - 4 }}>
          <Skeleton className="flex-1" />
        </View>
      ))}
      <View className="absolute right-0 h-px bg-border" style={{ left: TREND.axisLeft, top: zeroY }} />
      <View className="absolute bottom-0 right-0 top-0 flex-row" style={{ left: TREND.axisLeft }}>
        {TREND_BARS.map((ratio, index) => {
          const height = Math.abs(ratio) * (plotHeight / 2)
          return (
            <View key={index} className="flex-1 items-center">
              <View className="absolute w-1/2 max-w-[22px]" style={{ top: ratio > 0 ? zeroY - height : zeroY, height }}>
                <Skeleton className="flex-1" fillClassName={ratio > 0 ? 'rounded-b-none' : 'rounded-t-none'} />
              </View>
              <View className="absolute bottom-1">
                <Skeleton className="h-2 w-5" />
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/**
 * 반원 도넛과 오른쪽 항목 글자 자리. 구멍은 섹션 바탕색 원으로 덮는다.
 *
 * 구멍 원은 `Skeleton` 밖에 둔다. 펄스 안에 두면 함께 흐려져 고리 색이 구멍으로 비친다.
 */
function DonutChart(): React.JSX.Element {
  const [width, setWidth] = useState(0)
  const scale = width / DONUT.width
  const cx = DONUT.cx * scale
  const cy = DONUT.cy * scale
  const outer = DONUT.outer * scale
  const inner = DONUT.inner * scale
  return (
    <View
      style={{ height: cy + 8 }}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      <View className="absolute left-0 right-0 top-0 overflow-hidden" style={{ height: cy }}>
        <View className="absolute" style={{ left: cx - outer, top: cy - outer, width: outer * 2, height: outer * 2 }}>
          <Skeleton className="flex-1" fillClassName="rounded-full" />
        </View>
        <View
          className="absolute rounded-full bg-stats-section"
          style={{ left: cx - inner, top: cy - inner, width: inner * 2, height: inner * 2 }}
        />
      </View>
      <View className="absolute right-0 gap-4" style={{ top: cy * 0.2 }}>
        {[0, 1, 2].map((index) => (
          <View key={index} className="items-end gap-1">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-2 w-10" />
          </View>
        ))}
      </View>
    </View>
  )
}

/** 0 에서 1 사이 위치의 누적 높이 비율. 곧게 오르지 않고 중간에 한 번 주춤한다 */
function cumulativeRatio(progress: number): number {
  return 0.12 + 0.88 * progress ** 1.4 - 0.06 * Math.sin(progress * Math.PI * 2)
}

/**
 * 오른쪽으로 갈수록 오르는 누적 면적. 네모 스켈레톤 하나를 깔고 곡선 위쪽을 섹션 바탕색으로 덮는다.
 *
 * 조각마다 스켈레톤을 세우면 펄스가 조각마다 따로 돌아 얼룩이 진다. 덮개는 `Skeleton` 밖에 둔다.
 */
function CumulativeChart(): React.JSX.Element {
  const [width, setWidth] = useState(0)
  const plotHeight = CUMULATIVE.chart - CUMULATIVE.pad * 2
  const curve = Array.from({ length: CUMULATIVE_POINTS }, (_, index) => {
    const progress = index / (CUMULATIVE_POINTS - 1)
    const y = CUMULATIVE.pad + plotHeight * (1 - cumulativeRatio(progress))
    return `L${(progress * width).toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return (
    <View style={{ height: CUMULATIVE.chart }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      <View className="absolute left-0 right-0" style={{ top: CUMULATIVE.pad, bottom: CUMULATIVE.pad }}>
        <Skeleton className="flex-1" fillClassName="rounded-none" />
      </View>
      <Svg className="absolute left-0 top-0 text-stats-section" width={width} height={CUMULATIVE.chart}>
        <Path d={`M0 0 ${curve} L${width} 0 Z`} fill="currentColor" />
      </Svg>
    </View>
  )
}

/** 제목 옆 세그먼트 자리. 없으면 제목 줄이 낮아져 아래 카드가 값이 올 때 밀린다 */
function SegmentPill(): React.JSX.Element {
  return <Skeleton className="h-7 w-[132px]" fillClassName="rounded-full" />
}

export function StatsSkeleton(): React.JSX.Element {
  return (
    // 조회 중임을 말하는 것은 이 상자다. 안쪽 막대는 장식이라 스스로 숨는다.
    <View testID="stats-skeleton" role="status" aria-busy className="gap-2">
      <StatsSection title="순 수익">
        <View className="flex-row items-end justify-between gap-3">
          <LineBar height={LINE.xl} className="h-5 w-32" />
          <View className="items-end gap-1">
            <LineBar height={LINE[11]} className="h-2.5 w-20" />
            <LineBar height={LINE[11]} className="h-2.5 w-20" />
          </View>
        </View>
      </StatsSection>

      <StatsSection title="추이" trailing={<SegmentPill />}>
        <View style={{ paddingTop: TREND.bubble }}>
          <TrendChart />
        </View>
        <View className="self-end">
          <LineBar height={LINE[11]} className="h-2.5 w-32" />
        </View>
      </StatsSection>

      <StatsSection title="캐릭터별" trailing={<SegmentPill />}>
        <View className="flex-row items-end gap-2">
          <View className="flex-1 gap-3">
            <LineBar height={20} className="h-3 w-24" />
            {[0, 1, 2].map((index) => (
              <View key={index} className="gap-1">
                <LineBar height={LINE[11]} className="h-2.5 w-16" />
                <Skeleton className="h-[7px] w-full" fillClassName="rounded-full" />
              </View>
            ))}
          </View>
          <View className="flex-1 flex-row items-end gap-1" style={{ paddingTop: PODIUM.figure }}>
            {PODIUM.blocks.map((height, index) => (
              <Skeleton key={index} className="flex-1" style={{ height }} fillClassName="rounded-b-[3px] rounded-t-lg" />
            ))}
          </View>
        </View>
      </StatsSection>

      <StatsSection title="수입 내역">
        <DonutChart />
      </StatsSection>
      <StatsSection title="지출 내역">
        <DonutChart />
      </StatsSection>

      <StatsSection title="보스별 수익" trailing={<SegmentPill />}>
        <LineBar height={LINE.xl} className="h-5 w-28" />
        <View className="flex-row gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((index) => (
            // 폭은 `BossSection` 의 `TILE_WIDTH` 와 같다.
            <Skeleton key={index} className="h-[128px] w-[88px]" fillClassName="rounded-xl" />
          ))}
        </View>
      </StatsSection>

      <StatsSection title="누적 순수익">
        <LineBar height={LINE['2xl']} className="h-6 w-36" />
        <Skeleton className="h-[26px] w-32" fillClassName="rounded-full" />
        <View style={{ paddingTop: CUMULATIVE.bubble }}>
          <CumulativeChart />
        </View>
      </StatsSection>
    </View>
  )
}
