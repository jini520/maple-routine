/**
 * 탭 스토어 선하이드레이션을 부르는 **한 자리**. 동적 `import()` 를 여기
 * 가둔다.
 *
 * 셸이 직접 `void import('../features/prehydrate').then(...)` 를 쓰던 것을 이 한 줄로 바꾼 것이고,
 * **런타임 동작은 같다**(같은 시점에 같은 모듈을 받아 같은 함수를 부른다). 가둔 이유가 둘이다.
 *
 * ## ① 동적 import 를 왜 그대로 두는가
 *
 * 웹이 그 형태를 고른 이유(번들 스플리팅)는 RN 에서 사라진다. Metro 는 단일 번들이고
 * `React.lazy` 도 안 쓴다. 그래도 정적 import 로 되돌리지 않는 것은 **모듈 평가 시점**이 달라지기
 * 때문이다: 이 패키지의 Metro 설정은 `inlineRequires: false` 라(실측 — `@expo/metro-config`
 * 기본값), 정적 import 면 세 탭 스토어와 그들이 끌고 오는 `data/*.json` 이 **셸을 require 하는
 * 순간**, 즉 첫 렌더 전에 평가된다. 그 평가가 무해하다는 근거가 아직 없고, 지금 형태는 이미 도는
 * 형태다. 이 전환의 첫 문장이 *"전환 후 앱은 전환 전과 구별할 수 없어야 한다"* 라 근거 없는 시점
 * 변경을 하지 않는다.
 *
 * ## ② 그런데 그 형태는 셸 안에 있으면 **관측할 수 없다**
 *
 * jest 에서 `import()` 는 `--experimental-vm-modules` 없이는 **동기적으로 던진다**(실측
 * 2026-08-12 — `TypeError: A dynamic import callback was invoked without …`). 셸 이펙트 안에서
 * 그러면 마운트가 통째로 죽어 결정 6(*"온보딩이 완료됐을 때만 돈다"*. 아니면
 * `syncSchedules` 가 던져 스토어가 error 로 시작하고 토스트까지 울린다)을 **어떤 테스트로도 못
 * 붙든다.** 이 파일이 정적 import 로 대체 가능한 경계가 되어 `src/__tests__/boot-order.test.tsx` 가
 * 그 게이트를 본다.
 *
 * 덤으로 그 동기 throw 가 여기서는 **거부(rejection)로 바뀐다**. `async` 함수 안이라서다. 웹의
 * `import()` 가 원래 주는 것이 거부이므로 이쪽이 오히려 웹과 같은 모양이고, 셸의 마운트가 이
 * 한 줄 때문에 죽는 경로가 없어진다.
 */
export async function prehydrateTabStores(): Promise<void> {
  const module = await import('../features/prehydrate')
  await module.prehydrateTabStores()
}
