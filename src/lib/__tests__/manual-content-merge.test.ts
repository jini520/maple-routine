import { describe, expect, it } from 'vitest'
import { mergeManualContentList, type SchedulerContentTemplateEntry } from '../manual-content-merge'
import type { DailyContent } from '../../types'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'

function contentItem(contentName: string): ManualTrackedItem {
  return { contentName, kind: 'daily' }
}

function synced(overrides: Partial<DailyContent> & { name: string }): DailyContent {
  return {
    kind: 'contents',
    isRegistered: false,
    nowCount: 0,
    maxCount: 0,
    questState: null,
    ...overrides,
  }
}

function templateEntry(
  overrides: Partial<SchedulerContentTemplateEntry> & { content_name: string },
): SchedulerContentTemplateEntry {
  return {
    type: 'contents',
    registration_flag: 'false',
    now_count: 0,
    max_count: 0,
    quest_state: null,
    ...overrides,
  }
}

describe('mergeManualContentList', () => {
  it('synced에 있는 항목은 등록 여부(isRegistered)와 무관하게 synced 값을 그대로 쓴다', () => {
    const tracked = [contentItem('몬스터파크')]
    const syncedList = [
      synced({ name: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 9, maxCount: 14, questState: null }),
    ]
    const template = [templateEntry({ content_name: '몬스터파크', now_count: 0, max_count: 14 })]

    const result = mergeManualContentList(tracked, syncedList, template)

    expect(result).toEqual([
      { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 9, maxCount: 14, questState: null },
    ])
  })

  it('synced에 quest 항목이면 kind/questState까지 synced 값을 그대로 쓴다', () => {
    const tracked = [contentItem('[일일 퀘스트] 레헬른의 평온한 밤')]
    const syncedList = [
      synced({
        name: '[일일 퀘스트] 레헬른의 평온한 밤',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 100,
        questState: 1,
      }),
    ]

    const result = mergeManualContentList(tracked, syncedList, [])

    expect(result).toEqual([
      {
        name: '[일일 퀘스트] 레헬른의 평온한 밤',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 100,
        questState: 1,
      },
    ])
  })

  it('synced에 없고 template에만 있으면 template 기본값을 쓰고 quest_state 문자열을 숫자로 변환한다', () => {
    const tracked = [contentItem('[일일 퀘스트] 소멸의 여로 조사')]
    const template = [
      templateEntry({
        content_name: '[일일 퀘스트] 소멸의 여로 조사',
        type: 'quest',
        now_count: 0,
        max_count: 100,
        quest_state: '0',
      }),
    ]

    const result = mergeManualContentList(tracked, [], template)

    expect(result).toEqual([
      {
        name: '[일일 퀘스트] 소멸의 여로 조사',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 100,
        questState: 0,
      },
    ])
  })

  it('synced에도 template에도 없으면 크래시 없이 안전한 기본값을 반환한다(항목을 버리지 않음)', () => {
    const tracked = [contentItem('알 수 없는 콘텐츠')]

    const result = mergeManualContentList(tracked, [], [])

    expect(result).toEqual([
      { name: '알 수 없는 콘텐츠', kind: 'contents', isRegistered: true, nowCount: 0, maxCount: 0, questState: null },
    ])
  })

  it('반환 순서는 tracked 배열 순서를 그대로 따른다', () => {
    const tracked = [contentItem('세번째'), contentItem('첫번째'), contentItem('두번째')]
    const template = [
      templateEntry({ content_name: '첫번째' }),
      templateEntry({ content_name: '두번째' }),
      templateEntry({ content_name: '세번째' }),
    ]

    const result = mergeManualContentList(tracked, [], template)

    expect(result.map((c) => c.name)).toEqual(['세번째', '첫번째', '두번째'])
  })
})
