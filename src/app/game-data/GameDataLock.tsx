/**
 * 게임 데이터를 다 받기 전에 앱을 가리는 잠금 화면. 테마 바탕 위에 스크림을 깔고 패널 하나를 띄운다.
 *
 * 패널은 테두리가 없다. 다크에서는 바텀시트처럼 표면을 한 단 올려(`buildSheetScopeVariables`) 스크림과 가른다.
 * 단계는 게임 데이터 · 이미지 데이터 둘이고 크기(MB)로 센다. 이미지 장 수로 세면 큰 지도와 작은 아이콘이 같은 한 칸이라
 * 막대가 받는 시간과 어긋난다.
 */
import { vars } from 'nativewind'
import { View } from 'react-native'

import { CheckIcon, CloudDownloadIcon, ProgressBar, RingSpinner, Text } from '../../components/atoms'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { retryGameData, type GameDataProgress, type GameDataStatus } from '../../features/game-data/sync'
import { useThemeAppearance } from '../../theme/context'
import { buildSheetScopeVariables } from '../../theme/theme-vars'

type StepState = 'done' | 'run' | 'wait'

/** 소수 한 자리 MB. 1MB 를 1,000,000 바이트로 센다. */
function mb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1)
}

function StepRow(props: { id: string; label: string; state: StepState; right?: string }): React.JSX.Element {
  return (
    <View
      testID={`game-data-step-${props.id}-${props.state}`}
      className="flex-row items-center gap-2.5 rounded-[10px] bg-card-inset px-3 py-2.5"
    >
      {props.state === 'done' ? (
        <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-primary">
          <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={2.5} aria-hidden />
        </View>
      ) : props.state === 'run' ? (
        <RingSpinner size={18} />
      ) : (
        <View className="h-[18px] w-[18px] rounded-full border-2 border-border" />
      )}
      <Text className="flex-1 text-13 text-text">{props.label}</Text>
      {props.right !== undefined && (
        <Text
          className={
            props.state === 'run'
              ? 'text-xs font-semibold text-text'
              : props.state === 'done'
                ? 'text-xs text-text-muted'
                : 'text-xs text-text-disabled'
          }
          style={TABULAR_NUMS}
        >
          {props.right}
        </Text>
      )}
    </View>
  )
}

function Progress(props: { progress: GameDataProgress }): React.JSX.Element {
  const { dataBytes, imageBytes, imageTotal } = props.progress
  const dataKnown = dataBytes !== null
  const imagesDone = dataKnown && imageBytes >= imageTotal
  const total = (dataBytes ?? 0) + imageTotal
  const done = (dataBytes ?? 0) + imageBytes
  const percent = dataKnown && total > 0 ? Math.floor((done * 100) / total) : 0

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint">
          <CloudDownloadIcon className="h-5 w-5 text-primary-ink" strokeWidth={1.75} aria-hidden />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-text">게임 데이터를 받고 있어요</Text>
          <Text className="text-xs text-text-muted">처음 한 번만 받아요</Text>
        </View>
      </View>

      <View className="gap-1.5">
        <StepRow
          id="data"
          label="게임 데이터"
          state={dataKnown ? 'done' : 'run'}
          right={dataKnown ? `${mb(dataBytes)}MB` : undefined}
        />
        <StepRow
          id="images"
          label="이미지 데이터"
          state={!dataKnown ? 'wait' : imagesDone ? 'done' : 'run'}
          right={!dataKnown ? '대기' : imagesDone ? `${mb(imageTotal)}MB` : `${mb(imageBytes)} / ${mb(imageTotal)}MB`}
        />
      </View>

      <View className="gap-1.5">
        <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} animated />
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-text" style={TABULAR_NUMS}>
            {dataKnown ? `${mb(done)} / ${mb(total)}MB` : ''}
          </Text>
          <Text className="text-xs font-semibold text-primary-ink" style={TABULAR_NUMS}>
            {`${percent}%`}
          </Text>
        </View>
      </View>
    </View>
  )
}

export function GameDataLock(props: { status: GameDataStatus }): React.JSX.Element | null {
  const { definition } = useThemeAppearance()
  // 사본을 읽는 짧은 순간이다. 사본이 있으면 곧 열리므로 아무것도 그리지 않는다(스플래시가 덮고 있다).
  if (props.status.phase === 'checking' || props.status.phase === 'ready') return null

  return (
    <View testID="game-data-lock" className="absolute inset-0 items-center justify-center bg-scrim px-4">
      <View style={vars(buildSheetScopeVariables(definition))} className="w-full max-w-sm">
        <View className="rounded-[14px] bg-surface p-6">
          {props.status.phase === 'failed' ? (
            <ErrorState
              title="게임 데이터를 받지 못했습니다"
              description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
              action={{ label: '다시 시도', onClick: () => void retryGameData() }}
            />
          ) : (
            <Progress progress={props.status.progress} />
          )}
        </View>
      </View>
    </View>
  )
}
