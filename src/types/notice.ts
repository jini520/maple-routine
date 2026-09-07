/**
 * 운영자 공지 한 건.
 *
 * **푸시 페이로드의 `data` 와 서버 응답이 같은 모양이다.** 그래야 상세 화면이 출처를 안 가린다.
 * 한쪽만 바꾸면 다른 쪽 타입 검사가 못 잡으므로 필드를 더할 때는 서버 저장소도 함께 볼 것.
 */
export interface Notice {
  /** 중복 억제와 탭 이동의 열쇠. 서버가 정한다. */
  id: string
  title: string
  body: string
  /** ISO 8601. 정렬 기준이다. */
  publishedAt: string
  /** 밖으로 나가는 주소. 없을 수 있다. */
  link?: string
}
