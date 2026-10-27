/**
 * 에셋 목록 생성의 명세 한 벌.
 *
 * `src/assets/generated/*.ts` 가 이 표를 읽어 만들어지고(`scripts/generate-asset-manifest.mjs`),
 * 생성물이 지금 디렉터리와 맞는지 보는 테스트도 같은 표를 읽는다. 표가 두 벌이면 검사는
 * 통과하는데 목록이 틀린 상태가 생긴다.
 *
 * 여기에는 값과 타입만 둔다. `.mjs` 스크립트가 Node 의 타입 스트리핑으로 이 `.ts` 를 그대로
 * import 하므로 런타임 의존이 있으면 그 경로가 깨진다.
 *
 * `dirs` 의 경로는 `src/assets/` 기준이고 하위 디렉터리를 훑지 않는다.
 *
 * 번들에 남은 그림은 테마 배경뿐이다. 게임 데이터 그림은 서버에서 받는다(`lib/assets/asset-files.ts`).
 */

/** 키를 파일 이름에서 뽑는 방법. */
export type AssetKeyRule =
  /** 확장자를 뗀 이름. 데이터가 슬러그로 가리키는 에셋(보스·지역·테마·월드) */
  | 'slug'
  /** 확장자까지 포함한 파일 이름. 참조표의 `iconFile` 이 그렇게 적혀 있다 */
  | 'fileName'

export interface AssetGroup {
  /** 생성물 파일 이름(`generated/<file>.ts`) */
  file: string
  /** 생성물이 export 하는 이름 */
  exportName: string
  /**
   * `record`. 키 하나에 에셋 하나.
   * `frames`. 디렉터리 하나가 키이고 값은 그 안의 프레임 배열(숫자 순 정렬).
   */
  kind: 'record' | 'frames'
  key: AssetKeyRule
  /** `src/assets/` 기준 디렉터리. 둘 이상이면 하나로 합친다(뒤가 이긴다). */
  dirs: string[]
  /** 받아들일 확장자(점 없이). 목록에 없는 파일은 무시한다. */
  extensions: string[]
  /** 생성물 머리에 적히는 한 줄. 이 목록이 무엇에 쓰이는지 */
  purpose: string
}

export const ASSET_GROUPS: AssetGroup[] = [
  {
    file: 'themes',
    exportName: 'THEME_BACKGROUND_ASSETS',
    kind: 'record',
    key: 'slug',
    dirs: ['themes'],
    extensions: ['webp', 'jpg', 'png'],
    purpose: '테마 배경 이미지. `lib/theme-backgrounds.ts`',
  },
]
