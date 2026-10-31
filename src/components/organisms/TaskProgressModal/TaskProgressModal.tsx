/**
 * 오래 걸리는 작업의 진행률 모달. 배지 아이콘 · 제목 · 단위 · 단계는 작업이 주고, 막대 · 건수 · 퍼센트는 이 부품이 갖는다.
 *
 * 닫는 버튼이 없고 바깥 탭 · 뒤로가기로 안 닫힌다. 작업이 끝나면 부르는 쪽이 내린다. 단계 목록은 단계가 둘 이상일 때만 선다.
 *
 * @example
 * <TaskProgressModal icon={CrownIcon} title="지난 기록에 수수료를 적용하고 있어요" done={812} total={1240} steps={steps} />
 */
import { View } from 'react-native'

import { CheckIcon, ProgressBar, RingSpinner, Text } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { InsetRow } from '../../molecules/InsetRow/InsetRow'
import { ModalHeader, type ModalIcon } from '../../molecules/ModalHeader/ModalHeader'
import { Modal } from '../Modal/Modal'

export interface TaskProgressStep {
  label: string
  sub?: string
  state: 'done' | 'run' | 'wait'
  done: number
  total: number
}

export interface TaskProgressModalProps {
  icon: ModalIcon
  /** 무엇을 하는 중인지 한 문장. `…하고 있어요` */
  title: string
  done: number
  total: number
  /** 건수의 단위. 기본 `건` */
  unit?: string
  steps?: TaskProgressStep[]
}

function StepRow(props: { step: TaskProgressStep; unit: string }): React.JSX.Element {
  const { step } = props
  return (
    <View testID={`task-step-${step.state}`}>
      <InsetRow
        leading={
          step.state === 'done' ? (
            <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-primary">
              <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={2.5} aria-hidden />
            </View>
          ) : step.state === 'run' ? (
            <RingSpinner size={18} />
          ) : (
            <View className="h-[18px] w-[18px] rounded-full border-2 border-border" />
          )
        }
        label={step.label}
        sub={step.sub}
        value={
          step.state === 'wait'
            ? '대기'
            : step.state === 'done'
              ? `${step.total.toLocaleString()}${props.unit}`
              : `${step.done.toLocaleString()} / ${step.total.toLocaleString()}${props.unit}`
        }
        valueClassName={
          step.state === 'wait'
            ? 'text-xs text-text-disabled'
            : step.state === 'done'
              ? 'text-xs text-text-muted'
              : 'text-xs font-bold text-text'
        }
      />
    </View>
  )
}

export function TaskProgressModal(props: TaskProgressModalProps): React.JSX.Element {
  const unit = props.unit ?? '건'
  const percent = props.total > 0 ? Math.round((props.done * 100) / props.total) : 0
  const steps = props.steps ?? []

  return (
    <Modal onClose={() => {}} testId="task-progress" align="center">
      <Modal.Card>
        <View className="gap-4">
          <ModalHeader icon={props.icon} tone="primary" title={props.title} />

          {steps.length > 1 && (
            <View className="gap-1.5">
              {steps.map((step) => (
                <StepRow key={step.label} step={step} unit={unit} />
              ))}
            </View>
          )}

          <View className="gap-1.5">
            <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-text" style={TABULAR_NUMS}>
                {`${props.done.toLocaleString()} / ${props.total.toLocaleString()}${unit}`}
              </Text>
              <Text className="text-xs font-bold text-primary-ink" style={TABULAR_NUMS}>
                {`${percent}%`}
              </Text>
            </View>
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}
