/**
 * 설정 행의 공유 골격. `design-system.md` `설정 리스트 행`절의 규정을 코드로 옮긴 것.
 *
 * **컴포넌트 파일이 아니라 별도 파일인 이유**: 외부 URL로 나가는 행은 다른 시맨틱을 가져야 하므로
 *  `SettingsRow` 와 `SettingsLinkRow` 가 같은 골격을 나눠 써야 하는데, 컴포넌트
 * 파일이 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다. `Button/variants.ts` 가 별도
 * 파일인 것과 같은 이유이고, 그 판단을 그대로 따른다.
 */
export const SETTINGS_ROW_CLASS = 'w-full flex-row items-center justify-between py-4'

/**
 * 형제 행 사이의 구분선.
 *
 * 선은 **형제 사이에만** 긋는다(첫 자식 제외).
 * NativeWind 에는 형제 선택자가 없어 그 유틸리티가 없으므로, 부모가 첫 행을 제외한 나머지에
 * 이 클래스를 직접 얹는다. `divide-y` 가 생성하던 규칙(`border-top`, 첫 자식 제외)과 **같은
 * 결과**이고, 다른 것은 그것을 CSS 가 아니라 호출부가 고른다는 점뿐이다.
 *
 * 카드가 아니라 행 쪽 파일에 있는 이유는 이 값이 `SETTINGS_ROW_CLASS` 와 짝이라서다. 행의
 * 세로 여백(`py-4`)과 선이 함께 설정 리스트 행 규격을 이룬다.
 */
export const SETTINGS_ROW_DIVIDER_CLASS = 'border-t border-border'
