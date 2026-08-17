/**
 * 위젯 2 — **캐릭터별 남은 스케줄**(`4×auto`, [[ADR-146]] 결정 6 · 정정 3·9·12).
 *
 * ## 형태의 전부는 «정렬» 이다 ([[ADR-146]] 정정 12)
 *
 * 수치를 배지에서 텍스트로 바꾸고 나니 숫자가 어디에도 정렬되지 않았다 — 라벨 길이가 제각각
 * (「일퀘」 2자 · 「주간 보스」 4자)이라 행마다 다른 x 에서 끝나 «누가 제일 밀렸나» 를 세로로 훑을 수가
 * 없었다. 그래서 **라벨 폭을 고정하고 숫자에 `tabular-nums`** 를 걸어 2×2 격자로 세운다
 * (col A = 일퀘/주간 보스 · col B = 주간퀘/검마). `·` 구분자는 열이 생기면 할 일이 없어 사라진다.
 *
 * ## 강조는 굵기 하나뿐이다 ([[ADR-146]] 정정 9)
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
 * ## 행 높이는 데이터에 흔들리지 않는다
 *
 * 값이 0인 칸은 **글자만 비우고 자리는 남긴다.** 보스가 0인 캐릭터의 둘째 줄이 통째로 사라지면 행
 * 높이가 캐릭터마다 달라지고, 그러면 이 타일의 auto 높이(`55 + 45n`)가 성립하지 않는다
 * ([[ADR-146]] 정정 9·12).
 *
 * ## 목록은 자르지 않는다
 *
 * 「외 N명」 접기도 상한도 없다 — 캐릭터 전부를 그리고, 늘어난 만큼 `resolveWidgetPositions` 가 아래
 * 타일을 민다(그것이 `h: 'auto'` 를 둔 이유다). 정렬은 뷰모델이 이미 끝냈다(남은 개수 많은 순 →
 * 동수면 캐릭터 관리 순서 · **동기화 실패는 언제나 맨 아래**).
 */

import { Image, Text, View } from 'react-native'

import { faceCropStyle } from '../../../lib/face-crop'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { ScheduleRowView } from '../view-model'
import type { WidgetProps } from './types'

/** 행 초상화 지름 — 목록 밀도(행 45px)에 맞춘 값이라 `FACE_AVATAR_SIZE`(36)보다 작다. */
const PORTRAIT_PX = 32

/**
 * 라벨·숫자 열의 **고정 폭**. 이 두 값이 모든 행의 숫자를 같은 x 에 세운다([[ADR-146]] 정정 12) —
 * 라벨을 내용 폭으로 두면 「일퀘」와 「주간 보스」가 다른 자리에서 끝난다.
 */
const LABEL_WIDTH_PX = 48
const VALUE_WIDTH_PX = 18

/**
 * 수치 한 줄의 **고정 높이**(10.5px × 1.25 를 올림).
 *
 * 값이 0인 칸을 빈 글자로 두는 것만으로는 부족하다 — **빈 `Text` 의 높이는 플랫폼마다 다르다**
 * (글리프가 없으면 0으로 재는 경우가 있다). 그러면 보스가 0인 캐릭터의 둘째 줄이 실제로 접혀 행
 * 높이가 데이터를 따라 움직이고, 이 타일의 auto 높이(`55 + 45n`)가 성립하지 않는다. 높이를 줄에
 * 박아 두면 그 질문 자체가 사라진다.
 */
const STAT_LINE_HEIGHT_PX = 14

/**
 * 「검마」는 **월간 보스가 하나뿐이라 성립하는 이름**이다([[ADR-146]] 정정 3) — 참조 데이터에서
 * 파생시키지 않는다. 월간 보스가 둘이 되면 이 이름이 거짓이 되고, 그때 다시 정한다([[ADR-006]] 태도).
 */
const LABEL = {
  dailyQuest: '일퀘',
  weeklyQuest: '주간퀘',
  weeklyBoss: '주간 보스',
  monthlyBoss: '검마',
} as const

const VALUE_CLASS = 'text-right text-[10.5px] font-extrabold leading-tight text-text'
const LABEL_CLASS = 'text-right text-[10.5px] leading-tight text-text-muted'

function StatCell(props: { label: string; value: number }): React.JSX.Element {
  // 0 은 그리지 않고 **자리만 남긴다** — 「일퀘 0」은 훑는 눈에 잡음이고, 칸을 없애면 행 높이가
  // 데이터마다 달라진다(파일 머리).
  const drawn = props.value > 0

  return (
    <View className="flex-row items-center gap-1">
      <Text numberOfLines={1} style={{ width: LABEL_WIDTH_PX }} className={LABEL_CLASS}>
        {drawn ? props.label : ''}
      </Text>
      <Text style={{ width: VALUE_WIDTH_PX, ...TABULAR_NUMS }} className={VALUE_CLASS}>
        {drawn ? String(props.value) : ''}
      </Text>
    </View>
  )
}

function StatGrid(props: { row: ScheduleRowView }): React.JSX.Element {
  return (
    <View testID="schedule-stats" className="shrink-0 gap-0.5">
      <View
        testID="schedule-stat-line"
        className="flex-row items-center gap-3"
        style={{ height: STAT_LINE_HEIGHT_PX }}
      >
        <StatCell label={LABEL.dailyQuest} value={props.row.dailyQuest} />
        <StatCell label={LABEL.weeklyQuest} value={props.row.weeklyQuest} />
      </View>
      <View
        testID="schedule-stat-line"
        className="flex-row items-center gap-3"
        style={{ height: STAT_LINE_HEIGHT_PX }}
      >
        <StatCell label={LABEL.weeklyBoss} value={props.row.weeklyBoss} />
        <StatCell label={LABEL.monthlyBoss} value={props.row.monthlyBoss} />
      </View>
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

function ScheduleRow(props: { row: ScheduleRowView; first: boolean }): React.JSX.Element {
  const { row } = props

  return (
    <View
      testID="schedule-row"
      className={`flex-row items-center gap-2 py-1.5${props.first ? '' : ' border-t border-border'}`}
    >
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
    </View>
  )
}

export function RemainingScheduleWidget({ data }: WidgetProps): React.JSX.Element {
  return (
    <View testID="widget-remaining-schedule" className="p-3">
      {/* 합계도 칩이 아니라 텍스트다([[ADR-146]] 정정 9) — 숫자만 굵다. 동기화 실패 캐릭터의 몫은
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
          <ScheduleRow key={row.ocid} row={row} first={index === 0} />
        ))
      )}
    </View>
  )
}
