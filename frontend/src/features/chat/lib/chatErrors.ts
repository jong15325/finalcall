import { hasErrorCode, isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

export function chatLoadErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.CHAT_001)) {
        return '대화를 찾을 수 없습니다. 대화 목록을 새로고침해 주세요.'
    }
    return '채팅을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'
}

export function chatCreateRoomErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.CHAT_002)) {
        return '해당 닉네임의 활성 회원을 찾을 수 없습니다.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_003)) {
        return '자기 자신과는 새 대화를 시작할 수 없습니다.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_005)) {
        return '현재 이 회원과 새 대화를 시작할 수 없습니다.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_009)) {
        return '새 대화를 너무 자주 만들고 있습니다. 잠시 후 다시 시도해 주세요.'
    }
    return '새 대화를 시작하지 못했습니다. 닉네임을 확인하고 다시 시도해 주세요.'
}

export function chatSendErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.CHAT_004)) {
        return '이 메시지는 안전하게 재전송할 수 없습니다. 새 메시지로 다시 작성해 주세요.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_005)) {
        return '현재 이 대화에서는 새 메시지를 보낼 수 없습니다.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_009)) {
        const waitSeconds = isApiError(error)
            ? Math.ceil((error.retryAfterMs ?? 0) / 1_000)
            : 0
        return waitSeconds > 0
            ? `${waitSeconds}초 후 메시지를 다시 보내 주세요.`
            : '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.'
    }
    if (isApiError(error) && error.status === 400) {
        return '메시지 형식을 확인해 주세요.'
    }
    return '메시지를 보내지 못했습니다. 같은 메시지를 다시 전송할 수 있습니다.'
}

export function chatBlockErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.CHAT_001)) {
        return '대화를 찾을 수 없습니다. 목록을 새로고침해 주세요.'
    }
    return '차단 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export function chatReportErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.CHAT_007)) {
        return '이 대화에서 상대가 보낸 메시지만 신고할 수 있습니다.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_008)) {
        return '이미 신고한 메시지입니다.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_009)) {
        return '오늘 신고 가능한 횟수를 모두 사용했습니다.'
    }
    if (hasErrorCode(error, ERROR_CODES.CHAT_001)) {
        return '신고할 메시지를 찾을 수 없습니다.'
    }
    return '신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
