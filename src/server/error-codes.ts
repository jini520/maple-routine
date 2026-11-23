/**
 * 서버가 요청을 받아들이지 않을 때 HTTP 상태와 함께 주는 `code` 전부. 서버 `src/common/error-codes.ts` 와 같은 목록이다. 앱은
 * 문구가 아니라 이 글자로 거절을 가른다. 서버에 새 거절이 생기면 여기에도 같은 글자를 더한다. 글자가 어긋나면 그 거절을 모르는
 * 실패로 읽는다.
 */
export const ERROR_CODES = {
  /** 403. 넥슨 로그인 세션으로만 부를 수 있는 경로 */
  loginRequired: 'login_required',
  /** 403. 계정 삭제를 예약한 사람 */
  accountDeletionPending: 'account_deletion_pending',
  /** 올리기의 기록마다. 기록의 메이플 ID 가 보낸 신원의 것이 아님 */
  mapleIdNotRegistered: 'maple_id_not_registered',
  /** 409. 자기 넥슨 ID 를 부계정으로 등록하려 함 */
  sameAccount: 'same_account',
  /** 409. 다른 넥슨 ID 에 등록된 부계정 */
  registeredElsewhere: 'registered_elsewhere',
  /** 409. 부계정을 가진 계정을 부계정으로 등록하려 함 */
  hasSubAccounts: 'has_sub_accounts',
  /** 409. 부계정인 로그인이 부계정을 등록하려 함 */
  loginIsSubAccount: 'login_is_sub_account',
  /** 올리기의 기록마다. 유일 기준이 같은데 내용이 다른 기록이 다른 기록 id 로 이미 있음 */
  duplicateRecord: 'duplicate_record',
  /** 올리기의 기록마다. 삭제 표식이 선 기록을 고치려 함 */
  recordDeleted: 'record_deleted',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** 부계정 등록을 거절하는 코드 넷 */
export type SubAccountRejection =
  | typeof ERROR_CODES.sameAccount
  | typeof ERROR_CODES.registeredElsewhere
  | typeof ERROR_CODES.hasSubAccounts
  | typeof ERROR_CODES.loginIsSubAccount
