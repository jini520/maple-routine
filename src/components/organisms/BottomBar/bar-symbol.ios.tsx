/**
 * iOS 하단바 일곱 칸의 SF Symbols 그림. 맥에서 래스터로 뽑은 @3x PNG 에 색을 입힌다.
 *
 * SF Symbols 는 라이선스가 Apple 플랫폼 밖에서 쓰는 것을 막는다. 그래서 그림은 이 iOS 전용 파일만 가져오고, 안드로이드는
 * `bar-symbol.android.tsx` 를 쓴다.
 */
import { Image, View, type ImageSourcePropType } from 'react-native'

import calendar from '../../../assets/bar-sf/calendar.png'
import wonsignCircle from '../../../assets/bar-sf/wonsign_circle.png'
import ellipsisCircle from '../../../assets/bar-sf/ellipsis_circle.png'
import person3 from '../../../assets/bar-sf/person_3.png'
import checklist from '../../../assets/bar-sf/checklist.png'
import bookClosed from '../../../assets/bar-sf/book_closed.png'
import chartBar from '../../../assets/bar-sf/chart_bar.png'

import type { GroupId } from '../../../navigation/bar-groups'
import type { TabRouteName } from '../../../navigation/routes'

/** 그림의 픽셀 크기(@3x). 포인트는 3 으로 나눈다. */
const SYMBOLS: Readonly<Record<string, { src: ImageSourcePropType; w: number; h: number }>> = {
  calendar: { src: calendar, w: 81, h: 69 },
  'wonsign.circle': { src: wonsignCircle, w: 78, h: 75 },
  'ellipsis.circle': { src: ellipsisCircle, w: 78, h: 75 },
  'person.3': { src: person3, w: 140, h: 74 },
  checklist: { src: checklist, w: 89, h: 75 },
  'book.closed': { src: bookClosed, w: 71, h: 79 },
  'chart.bar': { src: chartBar, w: 98, h: 70 },
}

/** SF Symbols 로 그리는 칸. 없는 칸(today · 유틸리티 · 보스 · 보스 수입 · 인벤토리)은 앱의 아이콘이다. */
const ICON_OF: Readonly<Partial<Record<GroupId | TabRouteName, string>>> = {
  schedule: 'calendar',
  ledger: 'wonsign.circle',
  settings: 'ellipsis.circle',
  Settings: 'ellipsis.circle',
  Appointments: 'person.3',
  Content: 'checklist',
  Cashbook: 'book.closed',
  Stats: 'chart.bar',
}

/** 그 칸의 SF 그림. 앱의 아이콘을 쓰는 칸이면 null. */
export function barSymbol(id: GroupId | TabRouteName, color: string): React.JSX.Element | null {
  const name = ICON_OF[id]
  if (name === undefined) return null
  const symbol = SYMBOLS[name]
  return (
    <View style={{ height: 25, justifyContent: 'center', alignItems: 'center' }}>
      <Image source={symbol.src} style={{ width: symbol.w / 3, height: symbol.h / 3, tintColor: color }} />
    </View>
  )
}
