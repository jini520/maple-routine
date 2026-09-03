/**
 * 번들 에셋 참조에서 어느 파일로 해석됐는가 를 꺼내는 도우미.
 *
 * 앱이 보는 값은 Metro 의 **에셋 id(숫자)** 이고(`types/image-asset.native.ts`), jest 에서는 RN 이
 * 일부러 넣어 둔 대역 `{ testUri: '<상대 경로>' }` 가 온다. 숫자든 대역이든 테스트가 물어야 하는
 * 것은 같다. *"이 슬러그가 그 파일로 갔는가"*.
 *
 * 이 저장소의 RN 테스트들이 쓰는 방식(`{ testUri }` 를 본다. `ContentCards.test.tsx`·
 * `BossPortrait.test.tsx`)과 같은 것을 한 자리에 모은 것이다.
 */
export function assetUri(ref: unknown): string {
  if (ref === null || ref === undefined) return ''
  if (typeof ref === 'string') return ref
  const testUri = (ref as { testUri?: unknown }).testUri
  return typeof testUri === 'string' ? testUri : String(ref)
}
