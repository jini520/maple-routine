/**
 * 공지 발행일 표기. 목록·상세·today 배너 셋이 같은 함수를 부른다.
 *
 * 세 곳이 각자 적으면 같은 공지가 화면마다 다른 날짜로 보일 수 있다. 그 어긋남은 셋을 나란히
 * 놓고 봐야 드러난다.
 */

/** 못 읽는 값은 빈 문자열. 날짜 자리에 `Invalid Date` 를 그리지 않는다. */
export function formatNoticeDate(publishedAt: string): string {
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
}
