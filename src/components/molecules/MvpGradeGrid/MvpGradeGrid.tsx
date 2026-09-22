import { Image, Pressable, View } from 'react-native'

import { Text } from '../../atoms'
import { mvpPlateAsset } from '../../../lib/assets/asset-lookup'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { MVP_GRADES, type MvpGradeKey } from '../../../lib/mvp/grades'

/** 문양 타일의 한 변. 명패 높이를 이 수로 맞추면 왼쪽 정사각이 문양이다. */
const TILE = 34

/**
 * MVP 등급 일곱을 한 줄에서 고르는 7칸 격자. 고른 칸은 테마색 테두리와 굵은 이름이다.
 *
 * @example <MvpGradeGrid selected={grade} onSelect={setGrade} />
 */
export function MvpGradeGrid(props: { selected: MvpGradeKey | null; onSelect: (grade: MvpGradeKey) => void }): React.JSX.Element {
  return (
    <View className="flex-row pt-1">
      {MVP_GRADES.map((grade) => {
        const on = grade.key === props.selected
        const source = mvpPlateAsset(grade.key)
        return (
          <Pressable
            key={grade.key}
            role="button"
            aria-label={grade.name}
            aria-selected={on}
            onPress={() => props.onSelect(grade.key)}
            className="flex-1 items-center gap-1.5"
          >
            <View
              style={{ width: TILE, height: TILE }}
              className={`items-center justify-center overflow-hidden rounded-[8px] ${
                on ? 'border-2 border-primary' : ''
              } ${source === null ? 'bg-surface-2' : ''}`}
            >
              {source === null ? (
                <Text fixed className="text-10 font-semibold text-text-muted">
                  일반
                </Text>
              ) : (
                // 높이를 타일에 맞추고 왼쪽에 붙이면 명패의 왼쪽 정사각(문양)이 보인다.
                <Image
                  source={source}
                  style={[naturalAspectStyle(source, { height: TILE }), { position: 'absolute', left: 0, top: 0 }]}
                  resizeMode="cover"
                />
              )}
            </View>
            <Text fixed className={`text-10 ${on ? 'font-bold text-primary-ink' : 'font-medium text-text-muted'}`}>
              {grade.name}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
