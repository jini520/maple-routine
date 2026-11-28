/**
 * 안드로이드 하단바 일곱 칸의 그림. iOS 의 SF Symbols 자리에 그 모양에 가까운 아이콘을 그린다. SF Symbols 는 라이선스가
 * Apple 플랫폼 밖에서 쓰는 것을 막는다.
 *
 * 출처는 lucide(ISC)의 calendar-days · circle-ellipsis · book · list-checks 좌표이고, 나머지 셋(원 안 ₩ · 세 사람 · 막대 셋)은
 * 24 격자에 직접 그렸다.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import type { GroupId } from '../../../navigation/bar-groups'
import type { TabRouteName } from '../../../navigation/routes'

/** SF 22pt regular 의 선 굵기에 맞춘 값(24 격자). */
const STROKE = 1.7

type Draw = (color: string) => React.JSX.Element

const DRAW: Readonly<Record<string, Draw>> = {
  calendar: (c) => (
    <>
      <Path d="M8 2v4M16 2v4M3 10h18" stroke={c} />
      <Rect x={3} y={4} width={18} height={18} rx={2} stroke={c} />
      <Path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" stroke={c} strokeWidth={2.4} />
    </>
  ),
  won: (c) => (
    <>
      <Circle cx={12} cy={12} r={10} stroke={c} />
      <Path d="M7 7.5l2.4 9 2.6-7 2.6 7 2.4-9M6 11h12M6.5 13.5h11" stroke={c} />
    </>
  ),
  ellipsis: (c) => (
    <>
      <Circle cx={12} cy={12} r={10} stroke={c} />
      <Path d="M7 12h.01M12 12h.01M17 12h.01" stroke={c} strokeWidth={2.6} />
    </>
  ),
  people: (c) => (
    <>
      <Circle cx={12} cy={7.5} r={3.2} stroke={c} />
      <Path d="M6.5 20v-1a5.5 5.5 0 0 1 11 0v1" stroke={c} />
      <Circle cx={4.8} cy={9.5} r={2.3} stroke={c} />
      <Path d="M1.2 19v-.6a3.6 3.6 0 0 1 4.6-3.45" stroke={c} />
      <Circle cx={19.2} cy={9.5} r={2.3} stroke={c} />
      <Path d="M22.8 19v-.6a3.6 3.6 0 0 0-4.6-3.45" stroke={c} />
    </>
  ),
  checklist: (c) => <Path d="M13 5h8M13 12h8M13 19h8m-18-2 2 2 4-4M3 7l2 2 4-4" stroke={c} />,
  book: (c) => (
    <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" stroke={c} />
  ),
  bars: (c) => (
    <>
      <Rect x={3} y={12} width={4.6} height={9} rx={1.2} stroke={c} />
      <Rect x={9.7} y={7} width={4.6} height={14} rx={1.2} stroke={c} />
      <Rect x={16.4} y={3} width={4.6} height={18} rx={1.2} stroke={c} />
    </>
  ),
}

/** iOS 에서 SF Symbols 를 쓰는 칸과 그 자리에 그릴 그림. */
const ICON_OF: Readonly<Partial<Record<GroupId | TabRouteName, string>>> = {
  schedule: 'calendar',
  ledger: 'won',
  settings: 'ellipsis',
  Settings: 'ellipsis',
  Appointments: 'people',
  Content: 'checklist',
  Cashbook: 'book',
  Stats: 'bars',
}

/** 그 칸의 그림. 앱의 아이콘을 쓰는 칸이면 null. */
export function barSymbol(id: GroupId | TabRouteName, color: string): React.JSX.Element | null {
  const name = ICON_OF[id]
  if (name === undefined) return null
  return (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      {DRAW[name](color)}
    </Svg>
  )
}
