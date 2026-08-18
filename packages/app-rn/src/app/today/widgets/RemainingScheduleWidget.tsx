/**
 * 위젯 2 — **캐릭터별 남은 스케줄**(`4×auto`, [[ADR-147]] 결정 6 · 정정 3·9·12).
 *
 * ## 형태의 전부는 «정렬» 이다 ([[ADR-147]] 정정 12)
 *
 * 수치를 배지에서 텍스트로 바꾸고 나니 숫자가 어디에도 정렬되지 않았다 — 라벨 길이가 제각각
 * (「일퀘」 2자 · 「주간 보스」 4자)이라 행마다 다른 x 에서 끝나 «누가 제일 밀렸나» 를 세로로 훑을 수가
 * 없었다. 그래서 **라벨 폭을 고정하고 숫자에 `tabular-nums`** 를 걸어 2×2 격자로 세운다
 * (col A = 일퀘/주간 보스 · col B = 주간퀘/검마). `·` 구분자는 열이 생기면 할 일이 없어 사라진다.
 *
 * ## 강조는 굵기 하나뿐이다 ([[ADR-147]] 정정 9)
 *
 * 숫자는 **크기도 색도 라벨과 같고** `font-weight` 만 400 → 800 이다. 라벨은 `text-muted`, 숫자는
 * 닉네임과 같은 `text`(읽기 2 확정). **테마 색을 쓰지 않는다** — 숫자를 `primary-ink` 로 칠하면 이
 * 타일 하나에 강조색이 **캐릭터 수만큼 반복**돼 격자에서 «여기가 제일 중요하다» 를 잘못 말한다.
 *
 * ## 배지는 «수치» 가 아니라 «상태» 에만 선다
 *
 * `CLEAR`(전부 완료)와 「동기화 실패」 둘뿐이다 — 수치가 아니라 상태라 다른 형태를 가질 근거가 있다.
 * 「다 했습니다」 같은 문장도, **전부 완료 전용 UI 도 두지 않는다**: 형태가 안 바뀌어야 «어제와 같은
 * 화면» 으로 읽힌다.
 *
 * ## 줄도 칸도 «그 행» 이 정한다 ([[ADR-147]] 정정 35~37)
 *
 * ```
 * 줄  = 그 행에 그 계열(① 컨텐츠 ② 보스)의 값이 하나라도 있을 때
 * 칸  = 그 행에 그 수치가 있을 때
 * ```
 *
 * **세 번에 걸쳐 여기까지 왔다**(전부 사용자 보고 — 빈 자리가 크다).
 *
 * 1. 원래는 «값이 0인 칸도 글자만 비우고 자리는 남긴다» 였다(정정 9·12). 그래야 숫자가 모든 행에서
 *    같은 x 에 서고 행 높이가 데이터를 안 따라간다.
 * 2. 정정 35 는 그 질문을 **목록 전체**에 물어 «아무도 안 쓰는 칸» 을 다 같이 죽였다.
 * 3. 정정 36·37 이 그 장치를 도로 지웠다 — **빈 자리를 남기는 것이 곧 정렬**이라 둘 다는 못 가지고,
 *    간결함이 선택됐다.
 *
 * 그래서 **포기한 것 둘**을 여기 적어 둔다: «모양이 다른 행 사이의 정렬» 과 «고른 행 높이». 값이 넷
 * 다 있는 행은 두 줄, 하나만 있는 행은 한 줄이다.
 *
 * 남긴 것도 있다.
 *
 * - **줄은 오른쪽 정렬**(`items-end`) — 칸이 줄면 왼쪽으로 짧아져야 셰브런 옆이 붙는다.
 * - `tabular-nums` 와 **숫자 칸 고정 폭** — 그것까지 놓으면 `10` 과 `1` 사이에서 오른쪽 끝이 떨린다.
 *   같은 모양의 행끼리는 이 폭 덕에 여전히 한 열이고, 목록이 남은 개수 순이라(정정 3) 그런 행들이
 *   대체로 붙어 선다.
 * - **계열 묶음**(① 일퀘·주간퀘 ② 주간 보스·검마) — 정정 13 이 안 B 를 기각한 이유가 «컨텐츠 /
 *   보스 묶음이 사라진다» 였다. 줄이 접히는 단위는 여전히 계열이다.
 *
 * ## 목록은 자르지 않는다
 *
 * 「외 N명」 접기도 상한도 없다 — 캐릭터 전부를 그리고, 늘어난 만큼 `resolveWidgetPositions` 가 아래
 * 타일을 민다(그것이 `h: 'auto'` 를 둔 이유다). 정렬은 뷰모델이 이미 끝냈다(남은 개수 많은 순 →
 * 동수면 캐릭터 관리 순서 · **동기화 실패는 언제나 맨 아래**).
 */

import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'

import { DifficultyBadge } from '../../../components/atoms/DifficultyBadge/DifficultyBadge'
import { faceCropStyle } from '../../../lib/face-crop'
import { ChevronDownIcon, ChevronUpIcon } from '../../../lib/icons'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { RemainingBossView, ScheduleRowView } from '../view-model'
import type { WidgetProps } from './types'

/** 행 초상화 지름 — 목록 밀도(행 45px)에 맞춘 값이라 `FACE_AVATAR_SIZE`(36)보다 작다. */
const PORTRAIT_PX = 32

/**
 * 라벨·숫자 열의 **고정 폭**. 이 두 값이 모든 행의 숫자를 같은 x 에 세운다([[ADR-147]] 정정 12) —
 * 라벨을 내용 폭으로 두면 「일퀘」와 「주간 보스」가 다른 자리에서 끝난다.
 */
const LABEL_WIDTH_PX = 48
/**
 * **두 자리에 맞춘 폭**([[ADR-147]] 정정 40). 18 은 세 자리를 담을 폭이라 오른쪽 정렬에서 남는 4px 이
 * 전부 왼쪽 여백이 되어 한 자리 수치가 라벨에서 떨어져 보였다. 세 자리가 실제로 나오면 그때 넓힌다.
 */
const VALUE_WIDTH_PX = 14

/**
 * 수치 한 줄의 **고정 높이**(10.5px × 1.25 를 올림).
 *
 * 원래 이유(«빈 `Text` 의 높이는 플랫폼마다 다르다»)는 정정 37 로 사라졌다 — 값이 없는 칸도 줄도
 * 아예 안 그리므로 빈 글자가 없다. 그래도 남기는 것은 이 상수가 **한 줄 행과 두 줄 행의 높이를
 * 예측 가능한 관계**로 묶기 때문이다. 행 높이가 줄 수를 따라가는 것은 받아들이되, 줄 하나의 높이는
 * 데이터와 무관해야 한다.
 */
const STAT_LINE_HEIGHT_PX = 14

/**
 * 「검마」는 **월간 보스가 하나뿐이라 성립하는 이름**이다([[ADR-147]] 정정 3) — 참조 데이터에서
 * 파생시키지 않는다. 월간 보스가 둘이 되면 이 이름이 거짓이 되고, 그때 다시 정한다([[ADR-006]] 태도).
 */
const LABEL = {
  dailyQuest: '일퀘',
  weeklyQuest: '주간퀘',
  weeklyBoss: '주간 보스',
  monthlyBoss: '검마',
} as const

type StatKey = keyof typeof LABEL

/** 줄 = 계열. 순서가 곧 화면 순서다(① 컨텐츠 ② 보스). */
const STAT_LINES: readonly (readonly StatKey[])[] = [
  ['dailyQuest', 'weeklyQuest'],
  ['weeklyBoss', 'monthlyBoss'],
]

function statValue(row: ScheduleRowView, key: StatKey): number {
  if (key === 'dailyQuest') return row.dailyNames.length
  if (key === 'weeklyQuest') return row.weeklyNames.length
  if (key === 'weeklyBoss') return row.weeklyBosses.length
  return row.monthlyBosses.length
}

const VALUE_CLASS = 'text-right text-[10.5px] font-extrabold leading-tight text-text'
const LABEL_CLASS = 'text-right text-[10.5px] leading-tight text-text-muted'

/** 값이 있는 칸만 온다 — 0 인 칸은 부모가 접는다([[ADR-147]] 정정 36). */
function StatCell(props: { label: string; value: number }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-0.5">
      <Text numberOfLines={1} style={{ width: LABEL_WIDTH_PX }} className={LABEL_CLASS}>
        {props.label}
      </Text>
      <Text style={{ width: VALUE_WIDTH_PX, ...TABULAR_NUMS }} className={VALUE_CLASS}>
        {String(props.value)}
      </Text>
    </View>
  )
}

function StatGrid(props: { row: ScheduleRowView }): React.JSX.Element {
  return (
    // `items-end` — 칸이 줄면 **왼쪽으로** 짧아져야 셰브런 옆이 붙는다([[ADR-147]] 정정 36).
    <View testID="schedule-stats" className="shrink-0 items-end gap-0.5">
      {STAT_LINES.map((line) => {
        // 줄도 칸도 **이 행**이 정한다([[ADR-147]] 정정 37) — 값이 없는 계열은 줄째로 빠지므로
        // 빈 줄이 안 남는다. 목록에 물어 «아무도 안 쓰는 칸» 을 죽이던 장치(정정 35)는 지웠다.
        const cells = line.filter((key) => statValue(props.row, key) > 0)
        if (cells.length === 0) return null

        return (
          <View
            key={line.join('-')}
            testID="schedule-stat-line"
            className="flex-row items-center gap-2"
            style={{ height: STAT_LINE_HEIGHT_PX }}
          >
            {cells.map((key) => (
              <StatCell key={key} label={LABEL[key]} value={statValue(props.row, key)} />
            ))}
          </View>
        )
      })}
    </View>
  )
}

/** 상태 배지 — 톤 둘뿐이라 `Badge` atom(primary/third)이 아니라 여기서 인라인으로 둔다. */
function StatusBadge(props: { testID: string; tone: 'clear' | 'issue'; label: string }): React.JSX.Element {
  const tone =
    props.tone === 'clear' ? 'bg-secondary-tint text-secondary-ink' : 'bg-error-tint text-error-ink'

  return (
    <Text
      testID={props.testID}
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}
    >
      {props.label}
    </Text>
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
          <Text className="text-xs font-bold text-on-primary">?</Text>
        </View>
      )}
    </View>
  )
}

/** 본문의 항목 하나 — 이름만 있는 알약. 보스는 아래 `BossChip` 이 난이도를 앞에 단다. */
function NameChip(props: { name: string }): React.JSX.Element {
  return (
    <Text
      testID="schedule-detail-chip"
      numberOfLines={1}
      className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] leading-tight text-text"
    >
      {props.name}
    </Text>
  )
}

/**
 * 보스 한 줄 — 난이도는 **공용 `DifficultyBadge`** 가 그린다(사용자 지정).
 *
 * 이 화면만의 표기를 새로 만들지 않는 것이 요점이다. 같은 난이도가 보스 스케줄러·수익 화면과
 * 다른 색으로 보이면 그것이 같은 값이라는 것을 사람이 알아볼 수 없다.
 */
function BossChip(props: { boss: RemainingBossView }): React.JSX.Element {
  return (
    <View testID="schedule-detail-boss" className="flex-row items-center gap-1">
      {/* 작은 크기 — 20px 배지가 줄 높이를 혼자 정하고 있었다([[ADR-147]] 정정 40). */}
      <DifficultyBadge difficulty={props.boss.difficulty} size="small" />
      <Text numberOfLines={1} className="text-[10px] leading-tight text-text">
        {props.boss.name}
      </Text>
    </View>
  )
}

function DetailGroup(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="gap-1">
      <Text className="text-[9.5px] font-bold tracking-[.02em] text-text-muted">{props.label}</Text>
      <View className="flex-row flex-wrap items-center gap-1">{props.children}</View>
    </View>
  )
}

/**
 * 펼친 본문 — **항목을 이름으로 낱개로** 센다([[ADR-147]] 정정 25).
 *
 * **자르지 않는다.** 일퀘가 여덟이면 여덟을 다 적는다 — 「외 3개」로 접으면 펼친 이유가 사라진다.
 * 펼침은 «더 보겠다» 는 명시적 행동이고 그 답을 다시 접는 것은 앞뒤가 안 맞는다. 늘어난 높이는
 * `resolveWidgetPositions` 가 아래 타일을 밀어 흡수한다(그것이 `h: 'auto'` 를 둔 이유다).
 *
 * 보스는 **주간과 검마를 한 그룹**으로 묶는다 — 접힘의 수치는 둘을 갈라 세지만(한도가 다르다),
 * 펼침에서 물어보는 것은 «무엇이 남았나» 하나라 굳이 두 줄로 나눌 이유가 없다.
 */
function ScheduleDetail(props: { row: ScheduleRowView }): React.JSX.Element {
  const { row } = props
  const bosses = [...row.weeklyBosses, ...row.monthlyBosses]

  return (
    <View testID="schedule-detail" className="gap-2 pb-2.5 pl-10 pt-0.5">
      {row.dailyNames.length > 0 && (
        <DetailGroup label={LABEL.dailyQuest}>
          {row.dailyNames.map((name, index) => (
            <NameChip key={`${name}-${String(index)}`} name={name} />
          ))}
        </DetailGroup>
      )}
      {row.weeklyNames.length > 0 && (
        <DetailGroup label={LABEL.weeklyQuest}>
          {/* **키가 이름이면 안 된다** — `[주간 퀘스트] 타락한 세계수 주간 임무` 와 `… 정화에 대한
              보답` 이 둘 다 「타락한 세계수」로 접혀 같은 키가 둘이 된다([[ADR-147]] 정정 40). */}
          {row.weeklyNames.map((name, index) => (
            <NameChip key={`${name}-${String(index)}`} name={name} />
          ))}
        </DetailGroup>
      )}
      {bosses.length > 0 && (
        <DetailGroup label="보스">
          {bosses.map((boss) => (
            <BossChip key={`${boss.difficulty}-${boss.name}`} boss={boss} />
          ))}
        </DetailGroup>
      )}
    </View>
  )
}

function ScheduleRow(props: {
  row: ScheduleRowView
  first: boolean
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  const { row } = props
  // 펼칠 것이 없는 행은 누를 수도 없다 — CLEAR 는 보여 줄 것이 없고, 실패는 **모른다**.
  const openable = !row.hasSyncIssue && row.remainingTotal > 0

  const head = (
    <View testID="schedule-row" className="flex-row items-center gap-2 py-1.5">
      <Portrait row={row} />
      <Text
        testID="schedule-name"
        numberOfLines={1}
        className="min-w-0 flex-1 text-xs font-semibold text-text"
      >
        {row.characterName}
      </Text>
      {row.hasSyncIssue ? (
        <StatusBadge testID="schedule-issue" tone="issue" label="동기화 실패" />
      ) : row.remainingTotal === 0 ? (
        <StatusBadge testID="schedule-clear" tone="clear" label="CLEAR" />
      ) : (
        <StatGrid row={row} />
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
      {openable && props.expanded && <ScheduleDetail row={row} />}
    </View>
  )
}

export function RemainingScheduleWidget({ data }: WidgetProps): React.JSX.Element {
  /**
   * 펼친 행 하나 — **`null` 은 전부 접힘**이다.
   *
   * **하나만 연다.** 여섯 명이 다 열리면 이 타일이 1,000px 을 넘고, 타일 안 스크롤은
   * [[ADR-147]] 결정 3 이 금지한다 — 동시 펼침을 하나로 묶는 것이 그 금지와 짝이 되는 선택이다.
   *
   * **기억하지 않는다**(사용자 지정). 저장소에 쓰지 않으므로 앱을 다시 켜면 전부 접혀 있다
   * ([[ADR-096]] 결정 3 의 탭 상태와 같은 태도). 화면이 탭이라 앱을 켜 둔 동안은 남는다.
   */
  const [expandedOcid, setExpandedOcid] = useState<string | null>(null)

  return (
    <View testID="widget-remaining-schedule" className="p-3">
      {/* 합계도 칩이 아니라 텍스트다([[ADR-147]] 정정 9) — 숫자만 굵다. 동기화 실패 캐릭터의 몫은
          여기 안 들어 있다(뷰모델이 «모르는 것을 더하지 않는다»). */}
      <View className="flex-row items-center border-b border-border-strong pb-2">
        <Text className="text-[11px] font-bold text-text-muted">남은 스케줄</Text>
        <Text className="ml-auto text-[11px] text-text-muted">
          <Text style={TABULAR_NUMS} className="text-[11px] font-extrabold text-text">
            {data.scheduleTotal}
          </Text>
          개
        </Text>
      </View>

      {data.schedule.length === 0 ? (
        <Text className="pt-2.5 text-xs text-text-muted">추적 중인 캐릭터가 없습니다</Text>
      ) : (
        data.schedule.map((row, index) => (
          <ScheduleRow
            key={row.ocid}
            row={row}
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
