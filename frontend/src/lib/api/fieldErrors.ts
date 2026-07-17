import { isApiError } from './errors';

/**
 * 검증 400 `errors[]`(계약 [1.4]) → { field: reason } 맵.
 * 폼이 field 명으로 해당 인풋 에러를 찾을 때 쓴다. ApiError 가 아니거나 errors[] 없으면 빈 맵.
 */
export function toFieldErrorMap(error: unknown): Record<string, string> {
  if (isApiError(error) && error.fieldErrors) {
    return Object.fromEntries(error.fieldErrors.map((e) => [e.field, e.reason]));
  }
  return {};
}
