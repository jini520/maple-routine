/**
 * 번들 에셋 참조에서 어느 파일로 해석됐는가 를 꺼내는 도우미.
 *
 * 앱이 보는 값은 Metro 의 **에셋 id(숫자)** 이고(`types/image-asset.native.ts`), jest 에서는 RN 이
 * 일부러 넣어 둔 대역 `{ testUri: '<상대 경로>' }` 가 온다. 숫자든 대역이든 테스트가 물어야 하는
 * 것은 같다. *"이 슬러그가 그 파일로 갔는가"*.
 *
 * vitest 시절에는 이 함수가 필요 없었다. Vite 가 같은 import 를 **URL 문자열**로 줘서
 * `expect(url).toEqual(expect.stringContaining('lucid'))` 가 그대로 성립했다. 러너를 jest 하나로
 * 모으면서 그 전제가 사라졌고, 이 저장소의 RN 테스트들이 이미 쓰던 방식
 * (`{ testUri }` 를 본다. `ContentCards.test.tsx`·`BossPortrait.test.tsx`)으로 통일한다.
 */
export function assetUri(ref: unknown): string {
  if (ref === null || ref === undefined) return ''
  if (typeof ref === 'string') return ref
  const testUri = (ref as { testUri?: unknown }).testUri
  return typeof testUri === 'string' ? testUri : String(ref)
}
