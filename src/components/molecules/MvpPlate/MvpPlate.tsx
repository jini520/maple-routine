import { Image, View } from 'react-native'

import { Text } from '../../atoms'
import { mvpPlateAsset } from '../../../lib/assets/asset-lookup'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { findMvpGrade, type MvpGradeKey } from '../../../lib/mvp/grades'

/**
 * MVP 등급 명패. 폭은 그림이 정하고, 그림이 없는 일반은 같은 높이의 `일반` 글자 알약이다.
 *
 * @example <MvpPlate grade="diamond" height={18} />
 */
export function MvpPlate(props: { grade: MvpGradeKey; height: number; testID?: string }): React.JSX.Element {
  const name = findMvpGrade(props.grade)?.name ?? ''
  const source = mvpPlateAsset(props.grade)
  if (source === null) {
    return (
      <View
        testID={props.testID}
        accessibilityLabel={`MVP ${name}`}
        style={{ height: props.height }}
        className="items-center justify-center rounded-full bg-surface-2 px-2"
      >
        <Text fixed className="text-11 font-semibold text-text-muted">
          {name}
        </Text>
      </View>
    )
  }
  return (
    <Image
      testID={props.testID}
      accessibilityLabel={`MVP ${name}`}
      source={source}
      // 폭을 안 적으면 명패의 고유 폭(215 · 243)이 남아 줄이 벌어진다.
      style={[naturalAspectStyle(source, { height: props.height }), { borderRadius: 4 }]}
      resizeMode="contain"
    />
  )
}
