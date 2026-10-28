/**
 * 설정 행의 공유 골격. `SettingsRow` 와 `SettingsLinkRow` 가 같이 쓴다.
 *
 * **컴포넌트 파일이 아니라 별도 파일인 이유**: 외부 URL로 나가는 행은 다른 시맨틱을 가져야 하므로
 *  `SettingsRow` 와 `SettingsLinkRow` 가 같은 골격을 나눠 써야 하는데, 컴포넌트
 * 파일이 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다. `Button/variants.ts` 가 별도
 * 파일인 것과 같은 이유이고, 그 판단을 그대로 따른다.
 */

/** 카드 안의 칸 하나. 칸 색이 행 사이 경계라 선을 긋지 않는다. */
export const SETTINGS_ROW_CLASS = 'w-full flex-row items-center justify-between rounded-[10px] bg-card-inset p-3.5'

/** 글 공지 한 줄(제목 · 날짜)의 칸. `NoticeLines` 와 그 스켈레톤이 같은 값을 써야 도착할 때 높이가 안 바뀐다. */
export const NOTICE_LINE_CLASS = 'gap-0.5 rounded-[10px] bg-card-inset px-3.5 py-2.5'

/** 스위치를 단 칸. 스위치(24)가 글자 줄(20)보다 높아 위아래 여백을 줄여 `SETTINGS_ROW_CLASS` 와 높이를 맞춘다. */
export const SETTINGS_SWITCH_ROW_CLASS = 'flex-row items-center rounded-[10px] bg-card-inset px-3.5 py-3'

/** 글 두 줄(제목 · 설명)을 담는 칸. 알림 설정의 실패 · 권한 안내가 쓴다. */
export const SETTINGS_NOTE_CELL_CLASS = 'rounded-[10px] bg-card-inset p-3.5'

/** 칸을 담는 카드의 안쪽 여백과 칸 사이 간격. `Card` 에 얹는다. */
export const SETTINGS_CARD_CLASS = 'gap-1 p-1.5'

/**
 * 형제 행 사이의 구분선. 아직 칸으로 바꾸지 않은 기능 설명 목록만 쓴다.
 *
 * NativeWind 에는 형제 선택자가 없어, 부모가 첫 행을 제외한 나머지에 이 클래스를 직접 얹는다.
 */
export const SETTINGS_ROW_DIVIDER_CLASS = 'border-t border-border'
