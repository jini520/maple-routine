/**
 * 탭 스토어 선하이드레이션을 부르는 한 자리. 동적 `import()` 를 여기 가둔 모듈.
 *
 * **정적 import 로 되돌리지 말 것.** 이 패키지의 Metro 설정이 `inlineRequires: false` 라(실측),
 * 정적이면 세 탭 스토어와 그들이 끌고 오는 `data/*.json` 이 첫 렌더 **전**에 평가된다. 그 평가가
 * 무해하다는 근거가 없다.
 *
 * 셸 안에 두지 않고 파일로 뺀 것은 **관측하기 위해서**다. jest 에서 `import()` 는
 * `--experimental-vm-modules` 없이 동기적으로 던져서, 셸 이펙트 안에 있으면 마운트가 통째로 죽는다.
 * 여기 있으면 테스트가 이 모듈만 목으로 갈아 끼운다.
 */
export async function prehydrateTabStores(): Promise<void> {
  const module = await import('../features/prehydrate')
  await module.prehydrateTabStores()
}
