/**
 * 캐릭터 얼굴 원 하나. 300×300 전신 룩에서 얼굴만 확대해 자른다.
 *
 * 아홉 자리가 각자 그리던 것을 여기로 모았다. 크롭 표를
 * `lib/face-crop` 으로 모은 것만으로는 복사본이 셋 남아 있었다. 원을 그리는 일까지 부품이 들어야
 * 호출부에 베낄 것이 안 남는다.
 *
 * **폴백은 이 부품이 안 고른다**. 지금 세 모양이 살아 있고, 어느 것을 쓸지는 호출부가 정한다.
 */
import MaskedView from '@react-native-masked-view/masked-view'
import { Image, View, type ImageStyle } from 'react-native'

import { faceCropStyle, headOverflowCropStyle, headOverflowFrame } from '../../../lib/face-crop'
import { UnavailableFaceMark } from './UnavailableFaceMark'

/** 마스크 조각의 색. 마스크는 알파만 읽는다. 3자리 hex 는 안드로이드가 거부한다. */
const MASK_COLOR = '#000000'

/** 조회 불가 얼굴의 흐림 반지름. 얼굴 지름의 5% 이고 1.2 보다 작게 하지 않는다. */
function blurRadiusOf(faceSize: number): number {
  return Math.max(faceSize * 0.05, 1.2)
}

export interface CharacterAvatarProps {
  /** 넥슨이 주는 전신 룩 URL. `null` 이면 `fallback` 이 선다. */
  readonly imageUrl: string | null
  /** 읽어 주는 이름. */
  readonly name: string
  /** 원의 지름(px). 크롭 배율의 기준이기도 하다. */
  readonly size: number
  /** 그림이 없을 때 원 안에 그릴 것. 안 주면 빈 원이다. */
  readonly fallback?: React.ReactNode
  /** 원에 붙는 클래스. 배치(`shrink-0`)나 바탕이 필요한 자리가 있다. */
  readonly className?: string
  /**
   * 얼굴을 원 안에서 **작게** 보이게 하는 배수. 안 주면 크롭 박스가 원을 꽉 채운다(기본).
   *
   * 큰 원에서 얼굴만 꽉 차면 머리통만 보인다. 그 자리에서 둘레를 더 보여 주려고 쓴다. 지금 주는
   * 곳은 today 머리의 캐릭터 관리 버튼 하나뿐이고, 나머지 여덟 자리는 기본값이다.
   */
  readonly faceZoom?: number
  /** 그림을 좌우로 뒤집는다. 줄의 왼쪽 끝에 서는 얼굴은 오른쪽의 글자를 봐야 한다. 폴백과 조회 불가 덮개는 안 뒤집는다. */
  readonly mirrored?: boolean
  readonly testID?: string
  readonly imageTestID?: string
  /** 조회할 수 없게 된 캐릭터. 그림을 흐리고 원 안을 경고 덮개로 덮는다. */
  readonly unavailable?: boolean
  /**
   * 머리를 원 밖으로 그린다. 원 위로 지름만큼, 양옆으로 지름만큼 넓혀 자르고 중심선 아래는 원으로 자른다.
   * 링이 얼굴 바로 둘레에 있는 자리(레일 · 보스 카드)는 안 준다. 머리가 링을 가린다.
   */
  readonly headOverflow?: boolean
}

/** 잘라 낸 전신 그림. 원이 자르는 얼굴과 마스크가 자르는 얼굴이 배치만 달리 쓴다. */
function FaceImage(props: { avatar: CharacterAvatarProps; imageUrl: string; style: ImageStyle }): React.JSX.Element {
  return (
    <Image
      testID={props.avatar.imageTestID}
      accessibilityLabel={props.avatar.name}
      source={{ uri: props.imageUrl }}
      // RN 의 `filter: blur` 는 이 앱에서 두 플랫폼 모두 안 그려진다. 흐림은 그림이 직접 낸다.
      blurRadius={props.avatar.unavailable === true ? blurRadiusOf(props.avatar.size) : undefined}
      style={{ position: 'absolute', ...props.style }}
    />
  )
}

/** 머리를 원 밖으로 그리는 얼굴. 원이 자르지 않고 마스크가 자른다. */
function HeadOverflowAvatar(props: CharacterAvatarProps): React.JSX.Element {
  const frame = headOverflowFrame(props.size)
  return (
    <View
      testID={props.testID}
      // 원 밖의 머리가 핸들 · 버튼 · 위 줄에 걸려도 그 자리의 누름은 그쪽이 받아야 한다. iOS 는 부모가 자르지 않는
      // 자식을 부모 밖에서도 누름 대상으로 고른다.
      pointerEvents="none"
      // 머리가 같은 줄의 이름 위에 서야 한다. RN 은 나중 형제를 위에 그려서 그대로 두면 이름이 머리를 덮는다.
      style={{ width: props.size, height: props.size, zIndex: 1 }}
      className={`rounded-full ${props.className ?? ''}`}
    >
      {props.imageUrl !== null && (
        <MaskedView
          style={{ position: 'absolute', left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
          maskElement={
            <View style={{ flex: 1 }}>
              <View
                style={{ position: 'absolute', left: 0, top: 0, ...frame.upper, backgroundColor: MASK_COLOR }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: frame.circle.left,
                  top: frame.circle.top,
                  width: frame.circle.size,
                  height: frame.circle.size,
                  borderRadius: frame.circle.size / 2,
                  backgroundColor: MASK_COLOR,
                }}
              />
            </View>
          }
        >
          <FaceImage
            avatar={props}
            imageUrl={props.imageUrl}
            style={headOverflowCropStyle(props.size, props.faceZoom, props.mirrored)}
          />
        </MaskedView>
      )}
      {/* 폴백과 조회 불가 덮개는 원 안에만 선다. 이 얼굴은 루트가 자르지 않아서 원 모양 상자를 따로 둔다. */}
      {(props.imageUrl === null || props.unavailable === true) && (
        <View className="absolute inset-0 overflow-hidden rounded-full">
          {props.imageUrl === null && props.fallback}
          {props.unavailable === true && <UnavailableFaceMark size={props.size} />}
        </View>
      )}
    </View>
  )
}

export function CharacterAvatar(props: CharacterAvatarProps): React.JSX.Element {
  if (props.headOverflow === true) return <HeadOverflowAvatar {...props} />

  const unavailable = props.unavailable === true
  return (
    <View
      testID={props.testID}
      style={{ width: props.size, height: props.size }}
      // 크롭한 그림은 원보다 커서 삐져나온다. RN 의 `<Image>` 는 자식이라 부모가 안 자르면 네모다.
      className={`overflow-hidden rounded-full ${props.className ?? ''}`}
    >
      {props.imageUrl !== null && (
        <FaceImage
          avatar={props}
          imageUrl={props.imageUrl}
          style={faceCropStyle(props.size, props.faceZoom, props.mirrored)}
        />
      )}
      {props.imageUrl === null && props.fallback}
      {unavailable && <UnavailableFaceMark size={props.size} />}
    </View>
  )
}
