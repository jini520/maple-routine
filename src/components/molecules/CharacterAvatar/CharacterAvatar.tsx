/**
 * 캐릭터 얼굴 원 하나. 300×300 전신 룩에서 얼굴만 확대해 자른다([[ADR-015]]).
 *
 * 아홉 자리가 각자 그리던 것을 여기로 모았다([[ADR-204]] 결정 1 · 정정 1). 크롭 표를
 * `lib/face-crop` 으로 모은 것만으로는 복사본이 셋 남아 있었다. 원을 그리는 일까지 부품이 들어야
 * 호출부에 베낄 것이 안 남는다.
 *
 * **폴백은 이 부품이 안 고른다**([[ADR-204]] 결정 2). 지금 세 모양이 살아 있고 그중 둘은 각각
 * [[ADR-144]] 와 [[ADR-188]] 결정 1 이 정한 것이다.
 */
import { Image, View } from 'react-native'

import { faceCropStyle } from '../../../lib/face-crop'

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
}

export function CharacterAvatar(props: CharacterAvatarProps): React.JSX.Element {
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
          style={{ position: 'absolute', ...faceCropStyle(props.size) }}
        />
      )}
      {props.imageUrl === null && props.fallback}
    </View>
  )
}
