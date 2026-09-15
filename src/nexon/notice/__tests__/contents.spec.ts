// 넥슨 공지 본문을 블록으로 바꾸는 규칙. 표본은 실제 응답에서 잘라 왔다.
//
// 이벤트 · 캐시샵 본문은 이미지 한 장이라 태그를 걷으면 빈 문자열만 남고, 공지 · 업데이트는
// 스마트에디터가 글자를 span 수백 개로 쪼개 놓아 경계를 안 살리면 문장이 서로 붙는다.
import { parseContents } from '../contents'

describe('parseContents', () => {
  it('이벤트·캐시샵 본문은 이미지 한 장이 된다', () => {
    // 실제 event/detail?notice_id=1374 의 contents 그대로.
    const html = `      \t<!-- 카피영역 --><div class="gen_container" style="position: relative; max-width: 876px; margin: 0 auto;overflow:hidden;">  <img src="https://lwi.nexon.com/maplestory/2026/0820_board/260820_78D81WM5IA5L3366.png" style="width: 100%; height: auto;"></div><!-- //카피영역 -->            `

    expect(parseContents(html)).toEqual([
      { type: 'image', src: 'https://lwi.nexon.com/maplestory/2026/0820_board/260820_78D81WM5IA5L3366.png' },
    ])
  })

  it('문단 경계가 살아 문장이 안 붙는다', () => {
    // 태그만 걷으면 '감사드리며,Tver.1.2.205' 가 된다.
    const html =
      '<p><span>감사드리며,</span></p><p><span lang="EN-US">Tver.1.2.205</span><span>&nbsp;우수테스터 안내 드립니다.</span></p>'

    expect(parseContents(html)).toEqual([
      { type: 'text', text: '감사드리며,' },
      { type: 'text', text: 'Tver.1.2.205 우수테스터 안내 드립니다.' },
    ])
  })

  it('한 문단 안의 span 조각은 사이에 공백을 안 넣고 붙인다', () => {
    // 스마트에디터가 한글과 영문을 다른 span 으로 가른다. 공백을 넣으면 'GM 소리' 가 된다.
    const html = '<p><span>GM</span><span>소리</span><span lang="EN-US">입니다.</span></p>'

    expect(parseContents(html)).toEqual([{ type: 'text', text: 'GM소리입니다.' }])
  })

  it('br 은 한 문단 안의 줄바꿈이다', () => {
    expect(parseContents('<p>첫 줄<br>둘째 줄</p>')).toEqual([{ type: 'text', text: '첫 줄\n둘째 줄' }])
  })

  it('빈 문단은 버린다', () => {
    // se-zws-run 이 줄 간격을 내려고 넣는 빈 span 이 실제 본문의 절반이다.
    const html = '<p><span class="se-zws-run"><br></span></p><p>본문</p><p>&nbsp;</p>'

    expect(parseContents(html)).toEqual([{ type: 'text', text: '본문' }])
  })

  it('h1 은 heading 이 된다', () => {
    const html = '<h1 id="toc_56d0"><span style="background-color: rgb(0, 255, 0);">신규 보스 : 벨로나</span></h1>'

    expect(parseContents(html)).toEqual([{ type: 'heading', text: '신규 보스 : 벨로나' }])
  })

  it('표는 행과 칸을 지킨다', () => {
    const html =
      '<table><tbody><tr><td><p>최우수 테스터</p></td><td><p>10만 메이플포인트</p></td></tr><tr><td>우수 테스터</td><td>5만 메이플포인트</td></tr></tbody></table>'

    expect(parseContents(html)).toEqual([
      {
        type: 'table',
        rows: [
          ['최우수 테스터', '10만 메이플포인트'],
          ['우수 테스터', '5만 메이플포인트'],
        ],
      },
    ])
  })

  it('링크는 문단에서 떼어 낸 블록이 된다', () => {
    // 앵커 글자를 문단에 남기고 주소를 또 블록으로 내면 같은 말이 두 번 보인다.
    const html = '<p>선발 기준은 <a href="https://maplestory.nexon.com/News/Notice/110655">[바로가기]</a></p>'

    expect(parseContents(html)).toEqual([
      { type: 'text', text: '선발 기준은' },
      { type: 'link', text: '[바로가기]', href: 'https://maplestory.nexon.com/News/Notice/110655' },
    ])
  })

  it('모르는 스킴과 빈 이미지는 버린다', () => {
    // 모르는 스킴이 화면까지 흘러가면 그것을 여는 코드가 앱에 필요해진다.
    const html =
      '<p><a href="javascript:alert(1)">눌러</a></p><img src="data:image/png;base64,AAAA"><img src="">'

    expect(parseContents(html)).toEqual([{ type: 'text', text: '눌러' }])
  })

  it('script 와 style 은 내용째 버린다', () => {
    const html = '<style>p{color:red}</style><p>본문</p><script>alert(1)</script>'

    expect(parseContents(html)).toEqual([{ type: 'text', text: '본문' }])
  })

  it('주석도 버린다', () => {
    expect(parseContents('<!-- 카피영역 --><p>본문</p>')).toEqual([{ type: 'text', text: '본문' }])
  })

  it('엔티티를 푼다', () => {
    expect(parseContents('<p>&lt;공지&gt; &amp; &quot;안내&quot;&nbsp;&#39;끝&#39;</p>')).toEqual([
      { type: 'text', text: '<공지> & "안내" \'끝\'' },
    ])
  })

  // 넥슨 본문에 평문 http 이미지가 섞여 온다(업데이트 811). iOS 는 ATS 가 그것을 막아 화면이 말없이 빈칸이 된다.
  it('http 는 https 로 올린다', () => {
    expect(parseContents('<img src="http://file.nexon.com/a.png">')).toEqual([
      { type: 'image', src: 'https://file.nexon.com/a.png' },
    ])
  })

  it('링크 주소도 올린다', () => {
    expect(parseContents('<p><a href="http://x.test/1">여기</a></p>')).toEqual([
      { type: 'link', text: '여기', href: 'https://x.test/1' },
    ])
  })

  it('프로토콜 없는 주소는 https 로 채운다', () => {
    expect(parseContents('<img src="//lwi.nexon.com/a.png">')).toEqual([
      { type: 'image', src: 'https://lwi.nexon.com/a.png' },
    ])
  })

  it('블록 수에 상한이 있다', () => {
    // 업데이트 한 건이 문단 1,200개다. 상한이 없으면 그 크기가 그대로 화면으로 간다.
    const html = '<p>줄</p>'.repeat(3000)

    expect(parseContents(html)).toHaveLength(2000)
  })
})
