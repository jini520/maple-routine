// 고가 아이템 드롭 연출 프레임(ADR-038). 검은배경 최적화본(`packages/core/src/assets/drop-effect/*`)을
// import.meta.glob로 모아 숫자 순으로 정렬한다(파일명 렉시코 정렬 함정 방지: 10 < 2).
//
// 확장자를 둘 다 받는다 — 프레임은 JPEG 였다가 WebP 로 바꿨고([[ADR-093]] 결정 2 정정),
// 정렬은 `parseInt` 가 앞의 숫자만 읽어 확장자와 무관하다.

function loadFrames(modules: Record<string, string>): string[] {
  return Object.entries(modules)
    .map(([path, url]) => {
      const file = path.slice(path.lastIndexOf('/') + 1)
      return { index: Number.parseInt(file, 10), url }
    })
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.url)
}

// import.meta.glob의 두 번째 인자는 Vite가 정적 파싱하므로 반드시 인라인 객체 리터럴이어야 한다
// (변수로 빼면 "Expected the second argument to be an object literal" 에러).
export const DROP_EFFECT_FRAMES = {
  screen: loadFrames(
    import.meta.glob('../assets/drop-effect/screen/*.{jpg,webp}', { eager: true, import: 'default' }) as Record<
      string,
      string
    >,
  ),
  pre: loadFrames(
    import.meta.glob('../assets/drop-effect/pre/*.{jpg,webp}', { eager: true, import: 'default' }) as Record<
      string,
      string
    >,
  ),
  loop: loadFrames(
    import.meta.glob('../assets/drop-effect/loop/*.{jpg,webp}', { eager: true, import: 'default' }) as Record<
      string,
      string
    >,
  ),
  end: loadFrames(
    import.meta.glob('../assets/drop-effect/end/*.{jpg,webp}', { eager: true, import: 'default' }) as Record<
      string,
      string
    >,
  ),
}
