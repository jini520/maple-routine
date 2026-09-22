import { Pressable, View } from 'react-native'

import { ChevronRightIcon, Text } from '../../components/atoms'
import { MvpPlate } from '../../components/molecules/MvpPlate/MvpPlate'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { formatDayLabel } from '../../lib/calendar'
import { findMvpGrade } from '../../lib/mvp/grades'
import type { MvpGradeEntry } from '../../lib/mvp/history'

/**
 * 등급 이력 타임라인의 한 줄. 점 · `시작 날짜 부터` · 명패. 지금 기록은 채운 점과 `지금` 칩이다.
 * 누를 수 있으면 오른쪽에 화살표가 서고, 등급이 빈 줄은 명패 자리에 `등급 없음` 알약이 선다.
 *
 * @example <GradeTimelineRow entry={entry} isNow connector onPress={() => edit(entry.startDate)} />
 */
export function GradeTimelineRow(props: {
  entry: MvpGradeEntry
  isNow: boolean
  /** 아래 줄로 잇는 선. 마지막 줄은 없다 */
  connector: boolean
  onPress?: () => void
}): React.JSX.Element {
  const { entry } = props
  const name = findMvpGrade(entry.grade)?.name ?? '등급 없음'

  const body = (
    <>
      <View className="h-5 w-3 shrink-0 justify-center">
        <View
          className={`h-3 w-3 rounded-full border-2 ${props.isNow ? 'border-primary bg-primary' : 'border-border bg-surface'}`}
        />
        {/* 다음 줄의 점까지 잇는 선. 줄 사이 여백(8)을 넘어 내려간다. */}
        {props.connector && (
          <View style={{ left: 5, top: 22, bottom: -14, width: 2 }} className="absolute bg-border" />
        )}
      </View>
      <View className="min-w-0 flex-1 flex-row items-center">
        <Text className="text-xs text-text" style={TABULAR_NUMS}>
          {formatDayLabel(entry.startDate)}
        </Text>
        <Text className="text-xs text-text-muted"> 부터</Text>
        {props.isNow && (
          <View className="ml-1.5 rounded-full bg-primary-tint px-1.5">
            <Text fixed className="text-10 font-bold text-primary-ink">
              지금
            </Text>
          </View>
        )}
      </View>
      {entry.grade === null ? (
        <View className="h-[18px] shrink-0 items-center justify-center rounded-full bg-surface-2 px-2">
          <Text fixed className="text-11 font-semibold text-text-muted">
            등급 없음
          </Text>
        </View>
      ) : (
        <MvpPlate grade={entry.grade} height={18} />
      )}
      {props.onPress !== undefined && (
        <ChevronRightIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
      )}
    </>
  )

  if (props.onPress === undefined) return <View className="flex-row items-center gap-2.5 py-2">{body}</View>
  return (
    <Pressable
      role="button"
      aria-label={`${formatDayLabel(entry.startDate)}부터 ${name} 고치기`}
      onPress={props.onPress}
      className="flex-row items-center gap-2.5 py-2"
    >
      {body}
    </Pressable>
  )
}
