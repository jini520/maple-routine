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

/**
 * 얼굴 지름에서 표식 지름을 낸다. 0.42 는 26px 얼굴에서 11, 40px 에서 17 이다.
 *
 * 아래로 자르는 것은 그보다 작으면 아이콘이 안 읽히기 때문이고, 위로 자르는 것은 큰 얼굴에서
 * 표식이 얼굴만큼 커지지 않게 하기 위해서다.
 */
function markSizeOf(faceSize: number): number {
  return Math.min(Math.max(Math.round(faceSize * 0.42), 12), 18)
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
  readonly testID?: string
  readonly imageTestID?: string
  /**
   * 조회할 수 없게 된 캐릭터. 원의 **오른쪽 아래**에 표식이 붙는다.
   *
   * 표식은 원 **밖**에 서야 한다. 그림을 자르는 `overflow-hidden` 이 원 안의 것을 함께 자르므로,
   * 참이면 자르지 않는 바깥 상자를 한 겹 두르고 그 위에 얹는다.
   *
   * 그 상자 위로 링을 그리는 자리(`CharacterPortrait`)는 **링을 먼저 그려야 한다**. RN 은 형제
   * 순서가 곧 그리는 순서라, 뒤에 선 링이 이 표식을 덮는다.
   */
  readonly unavailable?: boolean
}

export function CharacterAvatar(props: CharacterAvatarProps): React.JSX.Element {
  const circle = (
    <View
      testID={props.unavailable === true ? undefined : props.testID}
      style={{ width: props.size, height: props.size }}
      // 크롭한 그림은 원보다 커서 삐져나온다. RN 의 `<Image>` 는 자식이라 부모가 안 자르면 네모다.
      className={`overflow-hidden rounded-full ${props.className ?? ''}`}
    >
      {props.imageUrl !== null && (
        <Image
          testID={props.imageTestID}
          accessibilityLabel={props.name}
          source={{ uri: props.imageUrl }}
          style={{ position: 'absolute', ...faceCropStyle(props.size) }}
        />
      )}
      {props.imageUrl === null && props.fallback}
    </View>
  )

  if (props.unavailable !== true) {
    return circle
  }

  const markSize = markSizeOf(props.size)
  return (
    // 바깥 상자는 원과 같은 크기이고 **안 자른다**. 표식이 절반쯤 밖으로 나가 원 테두리에 걸린다.
    //
    // `className` 은 이쪽으로 안 넘긴다. 이 상자는 안 깎이므로 바탕색이 실리면 **둥근 얼굴 뒤에
    // 네모가 한 겹** 생긴다(보스 수익 아코디언 머리에서 관측). 그 클래스가 노리는 것은 그림 뒤에
    // 비치는 바탕이라 자리가 원이다.
    //
    // 대신 `shrink-0` 을 여기서 박는다. 형제들 사이에 서는 것이 이 상자라, 안쪽으로 내려가면
    // 얼굴이 옆 글자에 밀려 찌그러진다. 지름을 프롭으로 받는 부품이 줄어들 이유는 어차피 없다.
    <View
      testID={props.testID}
      style={{ width: props.size, height: props.size }}
      className="relative shrink-0"
    >
      {circle}
      <View className="absolute" style={{ right: -markSize / 4, bottom: -markSize / 4 }}>
        <UnavailableFaceMark size={markSize} />
      </View>
    </View>
  )
}
