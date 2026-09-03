/**
 * 얼굴 아래를 도는 곡선 글자. 레벨과 이름이 호 하나를 같은 글자로 나눠 쓴다.
 *
 * @see. 호가 하나가 된 경위와 둘을 가르는 기준.
 */
import { Defs, Path, TextPath, Text as SvgText } from 'react-native-svg'

import { portraitTextArcPath, portraitTextOffsetPercent } from './portrait-arc'
import { PORTRAIT_RAIL } from './portrait-metrics'

/** 레벨과 이름은 자리만 다르고 글자는 같다. 한 상수로 묶어야 한쪽만 바뀌지 않는다. */
const FONT_PROPS = { fontSize: PORTRAIT_RAIL.textFontSize, fontWeight: '600' } as const

export interface PortraitCaptionProps {
  /** 호의 id. 레일에 여러 벌이 떠서 화면 안에서 유일해야 한다. */
  readonly pathId: string
  /** `null` 이면 레벨 글자를 비운다. 모르는 것을 아는 척하지 않는다. */
  readonly level: number | null
  readonly characterName: string
  readonly color: string
}

export function PortraitCaption(props: PortraitCaptionProps): React.JSX.Element {
  return (
    <>
      <Defs>
        <Path id={props.pathId} d={portraitTextArcPath()} />
      </Defs>

      {props.level !== null && (
        <SvgText
          testID="portrait-level-text"
          {...FONT_PROPS}
          fill={props.color}
          // `textAnchor` 는 `TextPath` 가 아니라 `Text` 에 붙는다. 자식에 주면 `react-native-svg` 가
          // 조용히 버린다.
          textAnchor="end"
        >
          <TextPath href={`#${props.pathId}`} startOffset={portraitTextOffsetPercent('left')}>
            {`Lv.${props.level}`}
          </TextPath>
        </SvgText>
      )}

      <SvgText
        testID="portrait-name-text"
        {...FONT_PROPS}
        fill={props.color}
        // 레벨을 모르면 이름 혼자라 치우칠 상대가 없다. 줄을 가운데에 앉힌다.
        textAnchor={props.level === null ? 'middle' : 'start'}
      >
        <TextPath
          href={`#${props.pathId}`}
          startOffset={props.level === null ? '50%' : portraitTextOffsetPercent('right')}
        >
          {props.characterName}
        </TextPath>
      </SvgText>
    </>
  )
}
