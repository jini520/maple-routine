/**
 * 게임 데이터를 다 받기 전에 앱을 가리는 잠금 화면. 테마 바탕 위에 스크림을 깔고 패널 하나를 띄운다.
 *
 * 처음 받을 때는 먼저 확인 패널을 띄운다. 받을 크기를 보이고 `확인` 을 눌러야 그림을 받는다.
 *
 * 패널은 가운데 모달과 같은 껍데기(`ModalSurface`)다. RN `Modal` 이 아니라 화면 위 층이라 스크림을 직접 깐다.
 * 단계는 게임 데이터 · 이미지 데이터 둘이고 크기(MB)로 센다. 이미지 장 수로 세면 큰 지도와 작은 아이콘이 같은 한 칸이라
 * 막대가 받는 시간과 어긋난다.
 */
import { View } from 'react-native'

import { Button, CheckIcon, CloudDownloadIcon, ProgressBar, RingSpinner, Text } from '../../components/atoms'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { InsetRow } from '../../components/molecules/InsetRow/InsetRow'
import { ModalHeader } from '../../components/molecules/ModalHeader/ModalHeader'
import { ModalSurface } from '../../components/organisms/Modal/Modal'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import {
  confirmGameData,
  retryGameData,
  type GameDataProgress,
  type GameDataStatus,
} from '../../features/game-data/sync'

type StepState = 'done' | 'run' | 'wait'

/** 소수 한 자리 MB. 1MB 를 1,000,000 바이트로 센다. */
function mb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1)
}

function StepRow(props: { id: string; label: string; state: StepState; right?: string }): React.JSX.Element {
  return (
    <InsetRow
      testID={`game-data-step-${props.id}-${props.state}`}
      leading={
        props.state === 'done' ? (
          <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-primary">
            <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={2.5} aria-hidden />
          </View>
        ) : props.state === 'run' ? (
          <RingSpinner size={18} />
        ) : (
          <View className="h-[18px] w-[18px] rounded-full border-2 border-border" />
        )
      }
      label={props.label}
      value={props.right}
      valueClassName={
        props.state === 'run'
          ? 'text-xs font-semibold text-text'
          : props.state === 'done'
            ? 'text-xs text-text-muted'
            : 'text-xs text-text-disabled'
      }
    />
  )
}

function Header(props: { title: string; description: string }): React.JSX.Element {
  return <ModalHeader icon={CloudDownloadIcon} tone="primary" title={props.title} description={props.description} />
}

function SizeRow(props: { label: string; bytes: number | null }): React.JSX.Element {
  return (
    <InsetRow
      label={props.label}
      trailing={props.bytes === null ? <RingSpinner size={14} /> : undefined}
      value={props.bytes === null ? undefined : `${mb(props.bytes)}MB`}
    />
  )
}

/** 받기 전 확인. 게임 데이터를 받는 동안은 크기를 몰라 `확인` 을 막는다. */
function Confirm(props: { progress: GameDataProgress }): React.JSX.Element {
  const { dataBytes, imageTotal } = props.progress
  const known = dataBytes !== null

  return (
    <View className="gap-4">
      <Header title="추가 리소스 다운로드" description="필요한 데이터를 다운로드 합니다" />
      <View className="gap-1.5">
        <SizeRow label="게임 데이터" bytes={dataBytes} />
        <SizeRow label="이미지 데이터" bytes={known ? imageTotal : null} />
      </View>
      <View className="flex-row items-center justify-between px-0.5">
        <Text className="text-xs text-text-muted">받을 크기</Text>
        {known && (
          <Text className="text-xs font-semibold text-primary-ink" style={TABULAR_NUMS}>
            {`모두 ${mb(dataBytes + imageTotal)}MB`}
          </Text>
        )}
      </View>
      <Button
        variant="primary"
        disabled={!known}
        onPress={confirmGameData}
        className={`w-full flex-row items-center justify-center${known ? '' : ' opacity-50'}`}
      >
        확인
      </Button>
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
      <Header title="게임 데이터를 받고 있어요" description="처음 한 번만 받아요" />

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
  // 사본을 읽는 짧은 순간이다. 사본이 있으면 곧 열리므로 아무것도 그리지 않는다(스플래시가 덮고 있다).
  if (props.status.phase === 'checking' || props.status.phase === 'ready') return null

  return (
    <View testID="game-data-lock" className="absolute inset-0 items-center justify-center bg-scrim px-4">
      <ModalSurface>
        {props.status.phase === 'failed' ? (
          <ErrorState
            title="게임 데이터를 받지 못했습니다"
            description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
            action={{ label: '다시 시도', onClick: () => void retryGameData() }}
          />
        ) : props.status.phase === 'confirm' ? (
          <Confirm progress={props.status.progress} />
        ) : (
          <Progress progress={props.status.progress} />
        )}
      </ModalSurface>
    </View>
  )
}
