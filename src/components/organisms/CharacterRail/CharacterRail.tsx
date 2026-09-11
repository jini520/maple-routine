/**
 * 추적 캐릭터를 한 줄로 늘어놓는 초상화 레일. 드롭다운을 대신한다.
 *
 * 레일에는 열고 닫을 것이 없어 항목이 곧 목록이다. 누르면 그 자리에서 바뀐다.
 *
 * 레일은 **콘텐츠의 직계 자식**이라 좌우 여백이 없는 자리에 선다. 안쪽 스크롤만 좌우 16 을
 * 들고 있어서, 첫 칸과 마지막 칸은 제자리에 서고 스크롤은 화면 끝까지 간다. 굴러 들어오는 칸이
 * 여백 앞에서 사라지지 않는 것이 요점이다.
 *
 * 좌우에 패딩을 가진 상자 안에 넣지 말 것. 그러면 스크롤이 그 여백 안쪽에서 잘려 더 있다 가
 * 안 보인다.
 */
import { ScrollView, View } from 'react-native'

import { CharacterPortrait } from '../CharacterPortrait/CharacterPortrait'
import { PORTRAIT_RAIL } from '../CharacterPortrait/portrait-metrics'
import type { PortraitRingProgress } from '../CharacterPortrait/PortraitRing'

export interface CharacterRailEntry {
  ocid: string
  characterName: string
  level: number | null
  imageUrl: string | null
  /** 0개면 링 없음(관리 화면), 1개면 온전한 원, 2개면 좌·우 반원. */
  rings: [] | [PortraitRingProgress] | [PortraitRingProgress, PortraitRingProgress]
  /**
   * 조회할 수 없게 된 캐릭터인가. 칸에 표식이 붙는다.
   *
   * 링은 그대로 둔다. 그 진행도는 **마지막으로 본 값**이라 지우면 아는 것까지 버리는 것이고,
   * 표식이 그 값을 지금의 사실로 읽지 말라고 말한다.
   */
  unavailable?: boolean
}

export interface CharacterRailProps {
  entries: CharacterRailEntry[]
  selectedOcid: string
  onSelect: (ocid: string) => void
}

/** 첫 칸과 마지막 칸이 서는 자리(px). 화면 좌우 여백과 같은 값이어야 옆 블록과 줄이 맞는다. */
const RAIL_EDGE_PADDING = 16

export function CharacterRail(props: CharacterRailProps): React.JSX.Element {
  return (
    <View testID="character-rail">
      <ScrollView
        testID="character-rail-scroll"
        horizontal
        // 스크롤바를 안 그린다. **더 있다** 는 잘린 초상화가 말한다(ADR 대가에 적힌 그 값이다).
        showsHorizontalScrollIndicator={false}
        // 간격은 칸이 아니라 레일이 준다. 값은 칸의 치수 표에서 온다. 숫자를 여기 적으면 표와
        // 레일이 서로 다른 값을 믿는다.
        contentContainerStyle={{ paddingHorizontal: RAIL_EDGE_PADDING, gap: PORTRAIT_RAIL.gap }}
      >
        {props.entries.map((entry) => (
          <CharacterPortrait
            key={entry.ocid}
            variant="rail"
            ocid={entry.ocid}
            characterName={entry.characterName}
            level={entry.level}
            imageUrl={entry.imageUrl}
            rings={entry.rings}
            unavailable={entry.unavailable}
            isSelected={entry.ocid === props.selectedOcid}
            onPress={() => props.onSelect(entry.ocid)}
          />
        ))}
      </ScrollView>
    </View>
  )
}
