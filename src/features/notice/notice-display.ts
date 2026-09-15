/**
 * 소식 화면이 공지를 적는 말. 제목 · 기간 · 빈 문구.
 *
 * 더보기의 배너 칸과 목록 화면의 카드가 같은 말을 쓴다. 각자 적으면 같은 공지가 화면마다 다르게 보인다.
 */
import type { Notice, NoticeKind } from '../../types/notice'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 배너 칸의 가로 ÷ 세로. 넥슨 썸네일은 분류마다 크기가 하나다(이벤트 285×120 · 캐시샵 443×130 실측).
 *
 * 그림을 받은 뒤 비율을 재면 목록이 그림마다 한 번씩 흔들려 미리 정한다.
 */
export function noticeBannerRatio(kind: NoticeKind): number {
  return kind === 'cashshop' ? 443 / 130 : 285 / 120
}

/** 넥슨 캐시샵 제목의 날짜 머리. 날짜는 기간 줄이 말하므로 칸에서는 뗀다. */
const CASHSHOP_TITLE_HEAD = /^\d{1,2}월 \d{1,2}일 캐시아이템 업데이트 - /

/** 화면에 적는 제목. 캐시샵만 날짜 머리를 떼고, 떼고 나서 빈 글자면 원래 제목이다. */
export function noticeDisplayTitle(notice: Notice): string {
  if (notice.kind !== 'cashshop') return notice.title
  const trimmed = notice.title.replace(CASHSHOP_TITLE_HEAD, '')
  return trimmed === '' ? notice.title : trimmed
}

/** 한국 시간 날짜. 넥슨이 끝을 23:59+09:00 으로 줘서 기기 시간대로 적으면 끝 날짜가 밀린다. */
function kstDate(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + KST_OFFSET_MS)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${kst.getUTCFullYear()}.${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())}`
}

/**
 * 카드의 기간 줄. 없으면 `null` 이라 그 줄을 그리지 않는다.
 *
 * 캐시샵 상시 판매는 넥슨이 기간을 주지 않아 `상시 판매` 로 적는다.
 */
export function noticePeriodLabel(notice: Notice): string | null {
  if (notice.startsAt !== undefined && notice.endsAt !== undefined) {
    return `${kstDate(notice.startsAt)} ~ ${kstDate(notice.endsAt)}`
  }
  return notice.kind === 'cashshop' ? '상시 판매' : null
}

/**
 * 주격 조사. 끝 글자가 한글이면 받침으로 고른다.
 *
 * 영문으로 끝나면 받침이 없어 끝 글자가 모음 글자면 `가` 다(`NOTICE` 노티스). 그 밖은 `이` 다.
 */
function subjectParticle(word: string): '이' | '가' {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? '가' : '이'
  return /[aeiou]/i.test(last) ? '가' : '이'
}

/** 글이 없는 갈래 · 목록의 문구. 갈래 이름이 곧 목록 화면 제목이라 같은 이름을 넣는다. */
export function emptyNoticeText(label: string): string {
  return `아직 받은 ${label}${subjectParticle(label)} 없습니다`
}
