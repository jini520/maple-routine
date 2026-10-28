import { Image, View } from 'react-native'

import { Text } from '../../atoms'
import { mvpPlateAsset } from '../../../lib/assets/asset-lookup'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { findMvpGrade, type MvpGradeKey } from '../../../lib/mvp/grades'

/**
 * MVP 등급 명패. 폭은 그림이 정하고, 그림이 없는 일반은 같은 높이 · 폭 비율 · 모서리의 `일반` 글자 판이다.
 *
 * @example <MvpPlate grade="diamond" height={18} />
 */
/** 명패 그림의 폭 ÷ 높이(243×50). 그림이 없는 일반 판도 이 모양으로 서야 이력 줄에서 다른 명패와 같아 보인다. */
const PLATE_ASPECT = 243 / 50

export function MvpPlate(props: { grade: MvpGradeKey; height: number; testID?: string }): React.JSX.Element {
  const name = findMvpGrade(props.grade)?.name ?? ''
  const source = mvpPlateAsset(props.grade)
  if (source === null) {
    return (
      <View
        testID={props.testID}
        accessibilityLabel={`MVP ${name}`}
        style={{ height: props.height, width: props.height * PLATE_ASPECT, borderRadius: 4 }}
        className="items-center justify-center bg-surface-2"
      >
        {/* 줄 높이가 판보다 높으면 글자가 판 안에서 눌린다. text-11 의 줄은 16 이다. */}
        <Text className={`${props.height >= 16 ? 'text-11' : 'text-10'} font-semibold text-text-muted`}>
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
