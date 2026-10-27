/** 줄바꿈을 막는 보이지 않는 글자. 유니코드 줄바꿈 규칙(UAX #14)에서 앞뒤 어디서도 줄을 안 바꾼다. */
const WORD_JOINER = '⁠'

/**
 * 한글 문장이 단어 가운데서 줄이 바뀌지 않게, 단어 안의 글자 사이를 단어 결합자로 묶은 문자열.
 *
 * RN 은 한글을 글자 사이에서도 줄을 바꾼다. iOS 의 `lineBreakStrategyIOS="hangul-word"` 에 해당하는 옵션이
 * 안드로이드에는 없어, 두 플랫폼이 함께 지키는 이 글자를 쓴다. 한 단어가 한 줄보다 길면 그 단어는 칸을 넘친다.
 *
 * @example <Text>{keepWords('앞으로 나오는 기능도 넥슨 로그인을 기준으로 만들어요.')}</Text>
 */
export function keepWords(text: string): string {
  return text
    .split(' ')
    .map((word) => Array.from(word).join(WORD_JOINER))
    .join(' ')
}
