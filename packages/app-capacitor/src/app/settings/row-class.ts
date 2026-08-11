// 설정 행의 공유 골격 — `design-system.md` 「설정 리스트 행」절의 규정을 코드로 옮긴 것.
//
// **컴포넌트 파일이 아니라 별도 파일인 이유**: 외부 URL로 나가는 행은 `<button>` 이 아니라
// `<a>` 여야 하므로(링크 시맨틱·`target`/`rel` — ADR-118 결정 7) `SettingsRow` 와
// `SettingsLinkRow` 가 같은 골격을 나눠 써야 하는데, 컴포넌트 파일이 컴포넌트 아닌 값을
// 함께 export 하면 fast refresh 가 깨진다(`react-refresh/only-export-components`).
// `Button/variants.ts` 가 별도 파일인 것과 같은 이유이고, 그 판단을 그대로 따른다.
//
// 구분선은 부모 카드가 `divide-y divide-border` 로 형제 사이에 주므로 여기에 테두리가 없다.
export const SETTINGS_ROW_CLASS = 'flex w-full items-center justify-between py-4 text-left'
