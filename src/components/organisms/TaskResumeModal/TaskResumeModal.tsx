/**
 * 앱이 중간에 닫혀 끝나지 않은 작업을 이어서 할지 묻는 모달. 제목 · 설명 · 버튼은 모든 작업이 같이 쓰고, 작업 줄만 작업이 준다.
 *
 * 작업 이름을 제목에 넣지 않는 것은 이름마다 조사(이/가)가 갈려서다. 미룰 수 없어 버튼이 하나이고 바깥 탭 · 뒤로가기로 안 닫힌다.
 *
 * @example <TaskResumeModal tasks={resume} busy={false} onResume={resumePending} />
 */
import { View } from 'react-native'

import { ProgressBar, RefreshCwIcon, Text } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { NoticeModal } from '../NoticeModal/NoticeModal'

export interface TaskResumeLine {
  name: string
  done: number
  total: number
  /** 건수의 단위. 기본 `건` */
  unit?: string
  /** 앞 작업 뒤에 기다리며 아직 손대지 않은 작업 */
  waiting: boolean
}

export function TaskResumeModal(props: {
  tasks: TaskResumeLine[]
  busy: boolean
  onResume: () => void
}): React.JSX.Element {
  return (
    <NoticeModal
      icon={RefreshCwIcon}
      tone="primary"
      title="끝나지 않은 작업이 있어요"
      content={
        <View className="rounded-[12px] border border-border px-3">
          {props.tasks.map((task, index) => {
            const percent = task.total > 0 ? Math.round((task.done * 100) / task.total) : 0
            return (
              <View
                key={task.name}
                testID={`task-resume-${index}`}
                className={`gap-1.5 py-2.5${index === 0 ? '' : ' border-t border-border'}`}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-13 text-text">{task.name}</Text>
                  {task.waiting ? (
                    <Text className="text-xs text-text-disabled">대기</Text>
                  ) : (
                    <Text className="text-xs text-text" style={TABULAR_NUMS}>
                      {`${task.done.toLocaleString()} / ${task.total.toLocaleString()}${task.unit ?? '건'}`}
                    </Text>
                  )}
                </View>
                <ProgressBar percent={task.waiting ? 0 : percent} />
              </View>
            )
          })}
        </View>
      }
      description="앱이 중간에 닫혀 멈춘 작업이에요. 멈춘 곳부터 이어서 진행해요."
      action={{ label: '이어서 진행하기', onPress: props.onResume, busy: props.busy }}
      onClose={() => {}}
      testId="task-resume"
    />
  )
}
