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
  /**
   * 이 항목의 사용법 안내([[ADR-125]]). 값이 있으면 목록에서 그 항목만 눌리고 `›` 가 붙는다.
   *
   * **본문이 아니라 id 다.** 본문은 `src/data/release-note-guides.ts` 에 있고 여기는 문자열만
   * 둔다 — 배포 스크립트가 이 파일을 **Node 에서 직접 import** 하는데(ADR-119 결정 1,
   * `scripts/publish-live-update.mjs`), 안내가 들고 오는 `.webp` import 를 Node 가 해석하지
   * 못해 그 자리에서 배포가 죽기 때문이다.
   *
   * 그래서 이 참조는 **타입이 지켜 주지 못한다**(문자열일 뿐이다) — 미아 참조·고아 안내는
   * `src/data/__tests__/release-note-guides.test.ts` 가 막는다.
   */
  guideId?: string
}

/** 안내에 실리는 이미지. `alt` 를 `src` 와 한 덩이로 묶어 **빠뜨릴 수 없게** 한다([[ADR-125]] 결정 6). */
export interface ReleaseNoteGuideImage {
  /** `src/assets/guide/` 에서 import 한 번들 자산 URL */
  src: string
  /** 안내 화면에서 이미지는 장식이 아니라 정보를 나른다 — 비워 둘 수 없다 */
  alt: string
}

/**
 * 안내 본문의 한 덩이. **이미지만·문단만·둘 다** 를 모두 허용한다 — 사용법은 "그림 한 장에 설명
 * 한 줄"로 떨어지지 않고, 맥락 문단이 먼저 오거나 그림이 잇따르는 것이 자연스러운 경우가 있다.
 * 둘 다 없는 블록은 그릴 것이 없으므로 데이터 테스트가 막는다.
 */
export interface ReleaseNoteGuideBlock {
  image?: ReleaseNoteGuideImage
  text?: string
}

export interface ReleaseNoteGuide {
  /** 라우트 `/settings/release-notes/:guideId` 의 그 id — **버전이 아니라 항목** 식별자다 */
  id: string
  /** 화면 머리말. 노트 항목 텍스트(완료형 문장)는 화면 제목으로 읽히지 않아 따로 둔다 */
  title: string
  blocks: ReleaseNoteGuideBlock[]
}

export interface ReleaseNote {
  /** `x.y.z` — 네이티브 빌드 번호가 아니라 OTA 번들 버전(`package.json` version)이다(ADR-119 결정 2) */
  version: string
  /** `YYYY-MM-DD` */
  date: string
  items: ReleaseNoteItem[]
}
