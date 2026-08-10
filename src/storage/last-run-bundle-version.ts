import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './keys'

// 마지막으로 **실행된** OTA 번들 버전(ADR-126 결정 4). 적용 성공 경로에는 상태 전환 코드가 없으므로
// (`set()` 이 그 자리에서 JS 컨텍스트를 파괴한다 — ADR-117 결정 1) *"방금 업데이트했다"* 는 재시작
// 뒤에 알아내야 한다. 부팅 때 이 값과 지금 도는 번들 버전을 비교하는 것이 그 방법이다.
//
// **`sessionStorage`(pendingNotice 방식)를 쓰지 않는 이유**: 그쪽은 같은 번들의 `reload()` 를 넘기는
// 장치이고(ADR-065 결정 3), 여기는 번들이 통째로 갈리는 리로드라 세션이 살아남는지가 플랫폼 구현에
// 달린다. 영속 키는 그 질문 자체를 없앤다.
//
// 저장된 적이 없으면 `null` 이고, 그것은 "모른다"이지 "업데이트했다"가 아니다 — 호출부가 그때는
// 안내를 띄우지 않는다.

export async function getLastRunBundleVersion(): Promise<string | null> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.lastRunBundleVersion })
  return value ?? null
}

export async function setLastRunBundleVersion(version: string): Promise<void> {
  await Preferences.set({ key: STORAGE_KEYS.lastRunBundleVersion, value: version })
}
