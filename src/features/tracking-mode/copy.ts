import type { TrackingMode } from '../../storage/tracking-mode'

export interface TrackingModeOptionCopy {
  mode: TrackingMode
  title: string
  description: string
  /**
   * 그 모드의 한계 한 문장. 설명과 분리한 것은 서식이 아니라 성격의 문제다 —
   * 사용자가 고칠 수 없는 알려진 제약이라 실패가 아니라 고지이고, 그래서 화면에서도 정보 톤
   * 박스에 따로 놓인다. 수동 쪽 문장은 전에 어디에도 없던 사실이다.
   */
  caution: string
}

// 온보딩(TrackingModeStep)과 설정(TrackingModeSelector) 두 곳이 같은 문구를 쓴다. 한쪽만
// 고치면 어긋나므로 카피를 여기 한 곳에 모아 둔다. 어느 쪽도 '추천'으로
// 표기하지 않고, 표기는 화면 이름과 맞춰 '컨텐츠'로 통일한다.
// 제목에서 "· 게임 등록을 그대로 따라가기" 꼬리를 뗀 것은 description 이 같은 말을 하기
// 때문이다(결정 22). 세 필드가 각각 무엇/어떻게/한계를 하나씩 맡는다.
export const TRACKING_MODE_OPTIONS: TrackingModeOptionCopy[] = [
  {
    mode: 'auto',
    title: '자동',
    description: '게임 내 스케줄러에 등록한 컨텐츠가 그대로 반영돼요.',
    caution: 'API 응답에 따라 컨텐츠가 표시되지 않을 수 있어요.',
  },
  {
    mode: 'manual',
    title: '수동',
    description: '직접 컨텐츠를 선택하고 관리해요.',
    caution: '게임 내에 스케줄러를 추가하더라도 앱에는 자동으로 추가되지 않아요.',
  },
]

// 설정 리스트 행 배지처럼 짧은 라벨이 필요한 곳에서 쓴다.
export const TRACKING_MODE_LABELS: Record<TrackingMode, string> = {
  auto: '자동',
  manual: '수동',
}
