import { HttpException, HttpStatus } from '@nestjs/common';
import { JsonWebTokenError } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';

// See /node_modules/jsonwebtoken/verify.js for these error messages
const JWT_MESSAGES: Record<string, string> = {
  'jwt expired': 'jwt 토큰이 만료되었습니다.',
  'invalid token': '유효하지 않은 jwt 토큰입니다.',
  'jwt malformed': 'jwt 토큰의 형식이 올바르지 않습니다.',
  'jwt must be provided': 'jwt 토큰이 존재하지 않습니다.',
  'invalid signature': 'jwt 토큰의 서명이 유효하지 않습니다.',
};

const UNEXPECTED_MESSAGE = '서버 오류가 발생했습니다.';

interface ExceptionResponse {
  status: number;
  message: unknown;
}

/**
 * What a client may see for an exception<br/>
 * Details of anything unexpected stay in the logs
 */
export function describeException(exception: unknown): ExceptionResponse {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const message =
      typeof response === 'object' && response !== null && 'message' in response
        ? response.message
        : exception.message;

    return {
      status,
      message:
        status >= 500 && !isPublicMessage(response)
          ? UNEXPECTED_MESSAGE
          : message,
    };
  }

  if (exception instanceof JsonWebTokenError) {
    return {
      status: HttpStatus.UNAUTHORIZED,
      message:
        JWT_MESSAGES[exception.message] ?? '유효하지 않은 jwt 토큰입니다.',
    };
  }

  if (exception instanceof QueryFailedError) {
    return exception.driverError?.code === 'ER_DUP_ENTRY'
      ? { status: HttpStatus.CONFLICT, message: '이미 존재하는 값입니다.' }
      : {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: UNEXPECTED_MESSAGE,
        };
  }

  // Errors raised by Express middleware, such as a malformed JSON body
  const status = (exception as { status?: unknown })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return { status, message: '요청 형식이 올바르지 않습니다.' };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: UNEXPECTED_MESSAGE,
  };
}

/**
 * Services opt in to showing a 5xx message by throwing with { public: true }
 */
function isPublicMessage(response: unknown): boolean {
  return (response as { public?: boolean })?.public === true;
}
