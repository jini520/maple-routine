// 배포 노트 가드([[ADR-119]] 결정 6 · [[ADR-126]] 결정 8).
//
// **이 파일이 없어서 아홉 날 동안 발행 스크립트가 죽어 있는 줄 몰랐다.** 가드가 살던
// `publish-live-update.mjs` 를 [[ADR-155]] 가 지웠고, 그것을 import 하던 `publish-rn-ota.mjs` 는
// 첫 줄에서 `ERR_MODULE_NOT_FOUND` 로 죽었다. 그 사이 유일한 발행이 ADR-155 이전 커밋의
// 워크트리에서 돌아 아무도 안 밟았다.
import { RELEASE_NOTES } from '../../src/data/release-notes.ts'
import { describeReleaseNoteGap } from '../release-note-gap.mjs'

const 온전한노트 = {
  version: '1.0.7',
  date: '2026-08-30',
  items: [{ category: 'fix', text: '무언가 고침' }],
  highlights: ['무언가 고침'],
}

describe('describeReleaseNoteGap', () => {
  it('items 와 highlights 가 둘 다 있으면 통과다', () => {
    expect(describeReleaseNoteGap(온전한노트)).toBeNull()
  })

  it('노트가 아예 없으면 막는다', () => {
    expect(describeReleaseNoteGap(undefined)).toContain('노트가 없습니다')
  })

  it('항목이 비어 있으면 막는다 — 빈 노트는 노트가 아니다', () => {
    expect(describeReleaseNoteGap({ ...온전한노트, items: [] })).toContain('노트가 없습니다')
  })

  it('핵심 목록이 없거나 비어 있으면 막는다 — 모달이 받기 전에 보여줄 유일한 재료다', () => {
    expect(describeReleaseNoteGap({ ...온전한노트, highlights: undefined })).toContain('highlights')
    expect(describeReleaseNoteGap({ ...온전한노트, highlights: [] })).toContain('highlights')
  })

  // 가드는 «다음에 나갈 버전» 을 겨눈다 — 맨 앞이 통과하지 못하면 그 배포는 시작도 못 한다.
  it('지금 맨 앞에 있는 노트가 이 가드를 통과한다', () => {
    expect(describeReleaseNoteGap(RELEASE_NOTES[0])).toBeNull()
  })
})
