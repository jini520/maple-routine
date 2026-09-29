/**
 * 그림을 모르는 캐릭터의 얼굴. `CharacterAvatar` 의 `fallback` 으로 넣는 남색 그라데이션 원 + 흰 실루엣.
 *
 * 실루엣 머리는 넥슨 룩 얼굴보다 커서 `lib/face-crop` 표로 자르면 머리 안쪽만 잡힌다. 그래서 자기
 * 크롭을 든다. 바탕은 테마와 상관없이 어두운 남색 그라데이션이다. 밝은 바탕에서는 흰 실루엣이 안 보인다.
 */
import { Image } from 'react-native'

import { unknownCharacterAsset } from '../../../lib/assets/asset-lookup'
import { LinearGradient } from '../../../lib/nativewind-interop'

/** 180×180 실루엣에서 머리와 어깨까지 잡는 박스 */
const SILHOUETTE_SIZE = 180
const SILHOUETTE_CROP = { centerX: 86, centerY: 95, size: 60 } as const

/** 왼쪽 위에서 오른쪽 아래로 밝아지는 남색 */
const BACKDROP_GRADIENT = ['#19223d', '#333f63'] as const

export interface UnknownCharacterFaceProps {
  /** 원의 지름(px). `CharacterAvatar` 에 준 값과 같아야 한다. */
  readonly size: number
  readonly testID?: string
}

export function UnknownCharacterFace(props: UnknownCharacterFaceProps): React.JSX.Element {
  const scale = props.size / SILHOUETTE_CROP.size
  return (
    <LinearGradient
      testID={props.testID}
      colors={BACKDROP_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-full w-full"
    >
      <Image
        source={unknownCharacterAsset()}
        style={{
          position: 'absolute',
          width: SILHOUETTE_SIZE * scale,
          height: SILHOUETTE_SIZE * scale,
          left: props.size / 2 - SILHOUETTE_CROP.centerX * scale,
          top: props.size / 2 - SILHOUETTE_CROP.centerY * scale,
        }}
      />
    </LinearGradient>
  )
}
