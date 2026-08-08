import type { ReleaseNote } from '../types'

// 릴리스 노트의 진실 원천 한 벌(ADR-119 결정 1) — 개발노트 화면과 `latest.json` 의 `notes` 가
// 여기서 갈라져 나간다. 노트를 두 곳에 쓰면 언젠가 반드시 갈라지고, 갈라진 순간 어느 쪽이
// 사실인지 알 방법이 없다.
//
// **최신이 먼저 오도록 버전 내림차순으로 손으로 유지한다.** 화면은 이 배열을 그대로 그리고
// 정렬하지 않는다 — 런타임 정렬은 잘못 쓴 파일을 조용히 통과시키므로 순서·중복·형식은
// 테스트가 강제한다(`__tests__/release-notes.test.ts`).
//
// 1.0.2 이전은 **비워 둔다**(ADR-119 결정 4, 사용자 결정 2026-08-09). 릴리스 노트는 사실
// 기록이라 커밋·ADR 을 뒤져 사후에 사용자용 문장으로 재구성하면 "그 버전에 그렇게 적혀
// 있었다"가 아니라 "지금 그렇게 지어낸 것"이 된다. 1.0.3 이후로는 배포 스크립트가 노트 없는
// 배포를 막으므로(결정 6) 빈 버전이 생길 수 없다.
//
// 이 파일은 순수 데이터다 — `features/`·`storage/`·`native/` 를 import 하지 않는다.
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.3',
    date: '2026-08-09',
    items: [
      { text: '설정 화면을 항목별로 나눠 정리했어요.' },
      { text: '버전마다 무엇이 바뀌었는지 볼 수 있는 개발노트가 생겼어요.' },
    ],
  },
]

/**
 * 그 버전의 노트를 찾는다. 없으면 **던지지 않고 `undefined`** 다 —
 * "노트가 없다"의 판정은 호출부가 한다(배포 가드는 중단하고, 화면은 그냥 안 그린다).
 */
export function findReleaseNote(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find((note) => note.version === version)
}
