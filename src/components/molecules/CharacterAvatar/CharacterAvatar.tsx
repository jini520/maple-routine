/**
 * 캐릭터 얼굴 원 하나. 300×300 전신 룩에서 얼굴만 확대해 자른다.
 *
 * 아홉 자리가 각자 그리던 것을 여기로 모았다. 크롭 표를
 * `lib/face-crop` 으로 모은 것만으로는 복사본이 셋 남아 있었다. 원을 그리는 일까지 부품이 들어야
 * 호출부에 베낄 것이 안 남는다.
 *
 * **폴백은 이 부품이 안 고른다**. 지금 세 모양이 살아 있고, 어느 것을 쓸지는 호출부가 정한다.
 */
import { Image, View } from 'react-native'

import { faceCropStyle } from '../../../lib/face-crop'
import { UnavailableFaceMark } from './UnavailableFaceMark'

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
}

export function CharacterAvatar(props: CharacterAvatarProps): React.JSX.Element {
  const unavailable = props.unavailable === true
  return (
    <View
      testID={props.testID}
      style={{ width: props.size, height: props.size }}
      // 크롭한 그림은 원보다 커서 삐져나온다. RN 의 `<Image>` 는 자식이라 부모가 안 자르면 네모다.
      className={`overflow-hidden rounded-full ${props.className ?? ''}`}
    >
      {props.imageUrl !== null && (
        <Image
          testID={props.imageTestID}
          accessibilityLabel={props.name}
          source={{ uri: props.imageUrl }}
          // RN 의 `filter: blur` 는 이 앱에서 두 플랫폼 모두 안 그려진다. 흐림은 그림이 직접 낸다.
          blurRadius={unavailable ? blurRadiusOf(props.size) : undefined}
          style={{ position: 'absolute', ...faceCropStyle(props.size, props.faceZoom, props.mirrored) }}
        />
      )}
      {props.imageUrl === null && props.fallback}
      {unavailable && <UnavailableFaceMark size={props.size} />}
    </View>
  )
}
