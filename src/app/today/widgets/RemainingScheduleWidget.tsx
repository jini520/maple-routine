/**
 * 위젯 2 — **캐릭터별 남은 스케줄**(`4×auto`, [[ADR-181]]).
 *
 * ## 주기는 열이 아니라 **탭**이다 ([[ADR-181]] 결정 1)
 *
 * 제목 줄 오른쪽, **합계 `N개` 가 있던 자리**에 세그먼트 셋(일간 · 주간 · 월간)이 선다. 목록은 그
 * 탭의 수치만 그린다. 별도 줄에 두면 타일이 34px 높아지는데 제목 줄에 얹으면 6px 이다.
 *
 * 열로 세운 시안도 만들었고 **월간 열이 값을 못 해서** 접었다 — 검마는 한 달에 한 번, 그것도 일부
 * 캐릭터만 잡아 대부분의 날에 그 열이 완료 표식으로만 찬다(사용자 판정). 탭으로 접으면 **월간 탭이
 * 곧 검마의 자리**가 된다.
 *
 * ## 세그먼트는 앱이 이미 쓰는 것이다 ([[ADR-181]] 결정 2)
 *
 * `molecules/Segment`([[ADR-173]] 결정 3 — 가계부 시트가 통화·형태를 고르는 그 조각)를 **한 줄도 안
 * 고치고** 쓴다. 여기서만 다른 세그먼트를 만들면 앱에 «고르는 축» 이 두 벌이 된다.
 *
 * 그 조각이 고른 칸을 `primary-tint` 로 칠하는 것은 **[[ADR-147]] 정정 9 의 금지에 안 걸린다** — 그
 * 규칙의 근거가 «타일 하나에 강조색이 **캐릭터 수만큼** 반복된다» 였고, 세그먼트는 머리글에 하나뿐이다.
 * 수치는 여전히 굵기로만 강조한다.
 *
 * ## 수치는 「갈래 N개」다 ([[ADR-181]] 결정 3)
 *
 * ```
 * 일간   야간비행                      퀘스트 4개
 * 주간   야간비행             퀘스트 3개  보스 2개
 * 월간   야간비행                        보스 1개
 * ```
 *
 * **값이 있는 갈래가 자기 이름과 함께 선다** — 탭마다 다른 모양이 없다(사용자 지정). 탭 이름만으로
 * 뜻이 닫히는 일간 · 월간에도 라벨을 두는 대신 규칙이 하나로 줄고, 열 표가 열로 갈랐던
 * «컨텐츠 / 보스» 묶음이 여기서는 **행 안**에 남는다.
 *
 * ## 0 은 언제나 `CLEAR` 다 — 「완료했다」가 아니다 ([[ADR-181]] 결정 5)
 *
 * 그 탭의 남은 수가 0 이면 수치 자리에 `CLEAR` 하나. **대상이 애초에 없던 캐릭터도 같은 배지**를
 * 받는다(사용자 확정 — 레벨 미달로 보스가 안 뜨는 경우, [[ADR-162]]). 표기를 가르지 않기로 했으므로
 * **이 배지의 뜻은 «이 주기에 지금 할 게 없다»** 이고, 그래서 뷰모델이 분모를 셀 필요가 없다.
 *
 * ## 목록은 캐릭터 전부이고, **탭마다 다시 선다** ([[ADR-181]] 결정 6 · 정정 1)
 *
 * 그 탭을 끝낸 캐릭터도 자리를 지킨다 — 사람 수가 늘 같아야 «어제와 같은 화면» 이고, 이 타일이
 * `4×auto` 라 목록이 줄면 **아래 위젯 전부가 하루 동안 따라 움직인다**. 「외 N명」 접기도 상한도 없다.
 *
 * **순서는 보고 있는 주기가 정한다**(사용자 지정, 정정 1):
 *
 * ```
 * ① 동기화 실패는 언제나 맨 아래   ② 그 주기에 남은 개수 많은 순   ③ 동수면 캐릭터 관리 순서
 * ```
 *
 * 뷰모델은 **관리 순서까지만** 세워 준다 — 「남은 개수 많은 순」은 «어느 주기의» 개수인지가 정해져야
 * 셀 수 있고 그 주기는 이 위젯의 탭이다. 동수의 기준인 관리 순서를 그대로 쓰려면 정렬이 한 번만
 * 일어나야 해서, 그 한 번을 여기서 한다.
 */

import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { Badge, Text } from '../../../components/atoms'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { faceCropStyle } from '../../../lib/face-crop'
import { ChevronDownIcon, ChevronUpIcon } from '../../../lib/icons'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { RemainingBossView, ScheduleRowView } from '../view-model'
import type { WidgetProps } from './types'

/** 행 초상화 지름 — 목록 밀도(행 45px)에 맞춘 값이라 `FACE_AVATAR_SIZE`(36)보다 작다. */
const PORTRAIT_PX = 32

/**
 * 숫자 칸의 **바닥**(천장이 아니다 — [[ADR-165]]).
 *
 * 14 는 한 자리 수치가 라벨에서 떨어져 보이지 않게 잡은 값이고([[ADR-147]] 정정 40), 두 자리가
 * 오면 칸이 내용을 따라 늘어난다. **`width` 로 두면 안 된다** — 고정 폭이던 시절 [[ADR-163]] 이
 * 글자만 +1px 올리자 두 자리 수치의 마지막 글자가 오른쪽에서 잘렸다(시뮬레이터 3x 실측).
 */
const VALUE_MIN_WIDTH_PX = 14

/** 세그먼트가 고르는 값 — 라벨이 곧 값이다(`Segment` 가 `options` 를 그대로 그린다). */
const CYCLE_LABELS = ['일간', '주간', '월간'] as const
type Cycle = (typeof CYCLE_LABELS)[number]

/**
 * 한 주기에 남은 것 — **뷰모델의 배열을 고를 뿐 새 판정을 하지 않는다**([[ADR-147]] 정정 26).
 *
 * 「검마」라는 이름은 화면에서 사라졌지만 그 전제는 그대로다 — 월간 보스가 하나뿐이라 월간 탭이
 * 성립한다([[ADR-147]] 정정 3). 둘이 되면 그때 다시 정한다([[ADR-006]] 태도).
 */
interface CycleItems {
  quests: readonly string[]
  bosses: readonly RemainingBossView[]
}

function cycleItems(row: ScheduleRowView, cycle: Cycle): CycleItems {
  if (cycle === '일간') return { quests: row.dailyNames, bosses: [] }
  if (cycle === '주간') return { quests: row.weeklyNames, bosses: row.weeklyBosses }
  return { quests: [], bosses: row.monthlyBosses }
}

function itemCount(items: CycleItems): number {
  return items.quests.length + items.bosses.length
}

/**
 * 그 탭의 순서 — **실패는 맨 아래 · 남은 개수 많은 순 · 동수면 관리 순서**([[ADR-181]] 정정 1).
 *
 * 받은 배열이 이미 관리 순서라(뷰모델) 그 **인덱스가 곧 동수의 기준**이다. 인덱스를 얹어 정렬하는
 * 것은 정렬의 안정성에 기대지 않기 위해서다(뷰모델의 `orderByTracked` 와 같은 태도).
 *
 * 실패한 캐릭터는 남은 개수를 **모르는** 것이라 개수 비교에 참여시키지 않는다 — 위로 올리면
 * «제일 밀린 캐릭터» 자리를 모르는 값이 거짓으로 차지한다([[ADR-147]] 정정 12 가 정한 태도).
 */
function orderForCycle(rows: readonly ScheduleRowView[], cycle: Cycle): ScheduleRowView[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (a.row.hasSyncIssue !== b.row.hasSyncIssue) return a.row.hasSyncIssue ? 1 : -1

      const countA = itemCount(cycleItems(a.row, cycle))
      const countB = itemCount(cycleItems(b.row, cycle))
      if (countA !== countB) return countB - countA

      return a.index - b.index
    })
    .map((entry) => entry.row)
}

const VALUE_CLASS = 'text-right text-[11.5px] font-extrabold leading-tight text-text'
const LABEL_CLASS = 'text-[11.5px] leading-tight text-text-muted'

/** 수치 한 덩이 — 「퀘스트 3개」·「보스 1개」. */
function Amount(props: { label: string; count: number }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-0.5">
      <Text fixed numberOfLines={1} className={LABEL_CLASS}>
        {props.label}
      </Text>
      <Text fixed style={{ minWidth: VALUE_MIN_WIDTH_PX, ...TABULAR_NUMS }} className={VALUE_CLASS}>
        {String(props.count)}
      </Text>
      <Text fixed className={LABEL_CLASS}>
        개
      </Text>
    </View>
  )
}

/**
 * **갈래 라벨은 어느 탭에서나 붙는다**(사용자 지정) — 일간은 「퀘스트 N개」, 월간은 「보스 N개」.
 *
 * 탭 이름만으로 뜻이 닫히는 자리에도 라벨을 두는 대신, 규칙이 **하나로 준다**: 값이 있는 갈래가
 * 자기 이름과 함께 선다. 그래서 탭마다 다른 모양을 만들 분기가 없다.
 */
function Amounts(props: { items: CycleItems }): React.JSX.Element {
  const { items } = props

  return (
    <View testID="schedule-stats" className="shrink-0 flex-row items-center gap-2.5">
      {items.quests.length > 0 && <Amount label="퀘스트" count={items.quests.length} />}
      {items.bosses.length > 0 && <Amount label="보스" count={items.bosses.length} />}
    </View>
  )
}

/** 상태 배지 — 톤 둘뿐이라 `Badge` atom(primary/third)이 아니라 여기서 인라인으로 둔다. */
function StatusBadge(props: { testID: string; tone: 'clear' | 'issue'; label: string }): React.JSX.Element {
  // 같은 줄에 서는 난이도 배지가 `mini` 라 이것도 `mini` 다(사용자 규칙 2026-09-01 —
  // 같은 곳에 서는 배지는 같은 크기를 쓴다).
  return (
    <Badge
      variant={props.tone === 'clear' ? 'secondary' : 'error'}
      size="mini"
      weight="bold"
      testID={props.testID}
      className="shrink-0"
    >
      {props.label}
    </Badge>
  )
}

function Portrait(props: { row: ScheduleRowView }): React.JSX.Element {
  return (
    <View
      className="shrink-0 overflow-hidden rounded-full"
      style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
    >
      {props.row.imageUrl !== null ? (
        <Image
          testID="schedule-face"
          accessibilityLabel={props.row.characterName}
          source={{ uri: props.row.imageUrl }}
          style={{ position: 'absolute', ...faceCropStyle(PORTRAIT_PX) }}
        />
      ) : (
        // `CharacterRow` 와 같은 폴백 — 이름 첫 글자는 «이 캐릭터의 얼굴» 처럼 보여 «못 가져왔다» 를
        // 말하지 못한다.
        <View
          testID="schedule-face-fallback"
          className="h-full w-full items-center justify-center bg-primary"
        >
          <Text fixed className="text-13 font-bold text-on-primary">?</Text>
        </View>
      )}
    </View>
  )
}

/** 본문의 항목 하나 — 이름만 있는 알약. 보스는 아래 `BossChip` 이 난이도를 앞에 단다. */
function NameChip(props: { name: string }): React.JSX.Element {
  return (
    <Text
      fixed
      testID="schedule-detail-chip"
      numberOfLines={1}
      className="rounded-md bg-surface-2 px-1.5 py-0.5 text-11 leading-tight text-text"
    >
      {props.name}
    </Text>
  )
}

/**
 * 보스 한 줄 — 난이도는 **공용 `Badge`** 가 그린다(사용자 지정).
 *
 * 이 화면만의 표기를 새로 만들지 않는 것이 요점이다. 같은 난이도가 보스 스케줄러·수익 화면과
 * 다른 색으로 보이면 그것이 같은 값이라는 것을 사람이 알아볼 수 없다.
 */
function BossChip(props: { boss: RemainingBossView }): React.JSX.Element {
  return (
    <View testID="schedule-detail-boss" className="flex-row items-center gap-1">
      {/* 작은 크기 — 20px 배지가 줄 높이를 혼자 정하고 있었다([[ADR-147]] 정정 40). */}
      <Badge variant={props.boss.difficulty} size="mini">
        {props.boss.difficulty}
      </Badge>
      <Text fixed numberOfLines={1} className="text-11 leading-tight text-text">
        {props.boss.name}
      </Text>
    </View>
  )
}

/**
 * 이름표는 **갈래가 둘일 때만**(주간) 붙는다 — 여기서 라벨이 하는 일은 «퀘스트 칩과 보스 칩을
 * 가르는 것» 이라, 그릴 그룹이 하나뿐이면 할 일이 없다(접힘은 갈래마다 수치가 붙어 사정이 다르다).
 */
function DetailGroup(props: { label: string | null; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="gap-1">
      {props.label !== null && (
        <Text fixed className="text-[10.5px] font-bold tracking-[.02em] text-text-muted">
          {props.label}
        </Text>
      )}
      <View className="flex-row flex-wrap items-center gap-1">{props.children}</View>
    </View>
  )
}

/**
 * 펼친 본문 — **그 탭의 항목을 이름으로 낱개로** 센다([[ADR-181]] 결정 7).
 *
 * **자르지 않는다.** 일퀘가 여덟이면 여덟을 다 적는다 — 「외 3개」로 접으면 펼친 이유가 사라진다.
 * 늘어난 높이는 `resolveWidgetPositions` 가 아래 타일을 밀어 흡수한다(그것이 `h: 'auto'` 를 둔 이유다).
 */
function ScheduleDetail(props: { items: CycleItems; cycle: Cycle }): React.JSX.Element {
  const { items, cycle } = props
  const labelled = cycle === '주간'

  return (
    <View testID="schedule-detail" className="gap-2 pb-2.5 pl-10 pt-0.5">
      {items.quests.length > 0 && (
        <DetailGroup label={labelled ? '퀘스트' : null}>
          {/* **키가 이름이면 안 된다** — `[주간 퀘스트] 타락한 세계수 주간 임무` 와 `… 정화에 대한
              보답` 이 둘 다 「타락한 세계수」로 접혀 같은 키가 둘이 된다([[ADR-147]] 정정 40). */}
          {items.quests.map((name, index) => (
            <NameChip key={`${name}-${String(index)}`} name={name} />
          ))}
        </DetailGroup>
      )}
      {items.bosses.length > 0 && (
        <DetailGroup label={labelled ? '보스' : null}>
          {items.bosses.map((boss) => (
            <BossChip key={`${boss.difficulty}-${boss.name}`} boss={boss} />
          ))}
        </DetailGroup>
      )}
    </View>
  )
}

function ScheduleRow(props: {
  row: ScheduleRowView
  cycle: Cycle
  first: boolean
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  const { row, cycle } = props
  const items = cycleItems(row, cycle)
  // 펼칠 것이 없는 행은 누를 수도 없다 — CLEAR 는 보여 줄 것이 없고, 실패는 **모른다**.
  const openable = !row.hasSyncIssue && itemCount(items) > 0

  const head = (
    <View testID="schedule-row" className="flex-row items-center gap-2 py-1.5">
      <Portrait row={row} />
      <Text
        fixed
        testID="schedule-name"
        numberOfLines={1}
        className="min-w-0 flex-1 text-13 font-semibold text-text"
      >
        {row.characterName}
      </Text>
      {row.hasSyncIssue ? (
        <StatusBadge testID="schedule-issue" tone="issue" label="동기화 실패" />
      ) : itemCount(items) === 0 ? (
        <StatusBadge testID="schedule-clear" tone="clear" label="CLEAR" />
      ) : (
        <Amounts items={items} />
      )}
      {openable &&
        (props.expanded ? (
          <ChevronUpIcon testID="schedule-chevron" className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={2.5} aria-hidden />
        ) : (
          <ChevronDownIcon testID="schedule-chevron" className="h-3.5 w-3.5 shrink-0 text-text-disabled" strokeWidth={2.5} aria-hidden />
        ))}
    </View>
  )

  return (
    <View className={props.first ? '' : 'border-t border-border'}>
      {openable ? (
        <Pressable testID="schedule-toggle" role="button" aria-expanded={props.expanded} onPress={props.onToggle}>
          {head}
        </Pressable>
      ) : (
        head
      )}
      {openable && props.expanded && <ScheduleDetail items={items} cycle={cycle} />}
    </View>
  )
}

export function RemainingScheduleWidget({ data }: WidgetProps): React.JSX.Element {
  /**
   * 보고 있는 주기 — **저장소에 안 쓴다**([[ADR-181]] 결정 1). 앱을 다시 켜면 언제나 일간이고,
   * **요일에 따라 기본 탭을 바꾸지 않는다**: 첫 화면이 날마다 다른 얼굴로 열리면 «어제와 같은
   * 화면» 이 깨지고 그 규칙을 사람이 배워야 한다.
   */
  const [cycle, setCycle] = useState<Cycle>('일간')

  /**
   * 펼친 행 하나 — **`null` 은 전부 접힘**이다.
   *
   * **하나만 연다.** 여섯 명이 다 열리면 이 타일이 1,000px 을 넘고, 타일 안 스크롤은
   * [[ADR-147]] 결정 3 이 금지한다. 기억하지도 않는다(화면이 탭이라 앱을 켜 둔 동안은 남는다).
   */
  const [expandedOcid, setExpandedOcid] = useState<string | null>(null)

  return (
    <View testID="widget-remaining-schedule" className="p-3">
      {/* 제목 줄이 곧 탭 줄이다 — 합계 `N개` 가 있던 자리에 세그먼트가 선다([[ADR-181]] 결정 1·4). */}
      <View className="flex-row items-center border-b border-border-strong pb-2">
        <Text fixed className="text-11 font-bold text-text-muted">남은 스케줄</Text>
        <View className="ml-auto">
          <Segment
            options={CYCLE_LABELS}
            selected={cycle}
            onSelect={(value) => {
              setCycle(value)
              // 접힘이 「이 주기에 N개」인데 펼침이 다른 주기의 이름을 들면 두 층이 어긋난다.
              setExpandedOcid(null)
            }}
          />
        </View>
      </View>

      {data.schedule.length === 0 ? (
        <Text fixed className="pt-2.5 text-13 text-text-muted">추적 중인 캐릭터가 없습니다</Text>
      ) : (
        orderForCycle(data.schedule, cycle).map((row, index) => (
          <ScheduleRow
            key={row.ocid}
            row={row}
            cycle={cycle}
            first={index === 0}
            expanded={expandedOcid === row.ocid}
            // 열린 행을 다시 누르면 닫는다(사용자 지정) — 닫는 방법이 셰브런뿐이면 «어디를 눌러야
            // 닫히나» 를 사용자가 배워야 한다.
            onToggle={() => setExpandedOcid((current) => (current === row.ocid ? null : row.ocid))}
          />
        ))
      )}
    </View>
  )
}
