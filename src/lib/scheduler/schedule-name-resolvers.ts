import type { ScheduleNameResolvers } from '../../nexon/schedule/normalize'
import { bossKeyOfApiName } from '../boss/bosses'
import { contentKeyOfApiName } from './contents'

/** 스케줄 응답의 API 이름을 key 로 맞추는 함수 둘. 응답을 받는 자리가 모두 이것을 넘긴다. */
export const SCHEDULE_NAME_RESOLVERS: ScheduleNameResolvers = {
  bossKey: bossKeyOfApiName,
  contentKey: contentKeyOfApiName,
}
