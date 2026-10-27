import { keepWords } from '../keep-words'

const WORD_JOINER = '⁠'

describe('keepWords', () => {
  // RN 은 한글을 글자 사이에서도 줄을 바꿔 `만들어요` 가 `만 / 들어요` 로 나뉘었다. 단어 안의 글자 사이를 묶어
  // 줄바꿈이 띄어쓰기에서만 일어나게 한다.
  it('단어 안의 글자 사이에만 단어 결합자를 넣고, 띄어쓰기는 그대로 둔다', () => {
    expect(keepWords('기준으로 만들어요.')).toBe(
      ['기', '준', '으', '로'].join(WORD_JOINER) + ' ' + ['만', '들', '어', '요', '.'].join(WORD_JOINER),
    )
  })

  it('결합자를 걷으면 원래 문장과 같다', () => {
    const 문장 = '앞으로 나오는 기능도 넥슨 로그인을 기준으로 만들어요.'

    expect(keepWords(문장).split(WORD_JOINER).join('')).toBe(문장)
  })

  it('한 글자 단어와 빈 문자열은 그대로다', () => {
    expect(keepWords('이 키')).toBe('이 키')
    expect(keepWords('')).toBe('')
  })
})
