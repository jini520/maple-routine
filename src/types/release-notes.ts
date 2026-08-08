// 릴리스 노트(ADR-119). 진실 원천은 `src/data/release-notes.ts` 한 벌이고, 거기서 두 갈래로
// 나간다 — 앱 번들에 그대로 실려 개발 노트 화면이 과거 전체를 읽고, 배포 스크립트가 그 버전
// 하나만 뽑아 `latest.json` 의 `notes` 로 실어 업데이트 모달이 읽는다.
// 형식이 JSON 이 아니라 `.ts` 인 이유가 이 파일이다 — 항목 단위 표식이 오타로 조용히
// 무시되는 것을 컴파일이 막는다(ADR-119 결정 1).

/**
 * 항목의 성격. 축은 이 저장소가 이미 쓰는 이슈 접두사(`[기능]`·`[개선]`·`[버그]`)와 같다 —
 * 노트를 쓸 때 새로 분류할 필요가 없도록 그 이름을 그대로 승계한다.
 */
export type ReleaseNoteCategory = 'feature' | 'improvement' | 'fix'

export interface ReleaseNoteItem {
  /** 화면과 매니페스트 문자열 양쪽에 배지·머리표로 붙는다(ADR-119 결정 9). */
  category: ReleaseNoteCategory
  text: string
  /**
   * 이 항목이 OTA 로 나가지 않는 네이티브 변경인지 — 화면에 「스토어 업데이트 필요」 표식이 붙는다.
   *
   * **버전이 아니라 항목에 붙는다**(ADR-119 결정 3). 한 릴리스에 OTA 로 가는 변경과 스토어가
   * 필요한 변경이 섞이는 것이 정상인데, 버전 단위로 묶으면 "이 버전은 스토어 업데이트 필요"가
   * 되어 **OTA 로 이미 받을 수 있는 나머지 변경까지 못 받는 것처럼** 읽힌다.
   *
   * 매니페스트의 `minNativeVersion` 과는 다른 층이다 — 그쪽은 *"이 번들을 적용할 수 있는가"* 를
   * 판정하는 게이트이고, 이 표식은 *"이 항목이 지금 내 앱에 있는가"* 를 사람에게 설명하는 글이다.
   * 무엇이 네이티브 변경인지는 스크립트가 아니라 **사람이 판정해 붙인다**.
   */
  requiresStoreUpdate?: boolean
}

export interface ReleaseNote {
  /** `x.y.z` — 네이티브 빌드 번호가 아니라 OTA 번들 버전(`package.json` version)이다(ADR-119 결정 2) */
  version: string
  /** `YYYY-MM-DD` */
  date: string
  items: ReleaseNoteItem[]
}
