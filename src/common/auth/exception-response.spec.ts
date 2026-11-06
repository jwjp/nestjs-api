import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { describeException } from './exception-response';

const queryError = (code: string) =>
  new QueryFailedError(
    'SELECT secret_column',
    [],
    Object.assign(new Error(code), { code }),
  );

describe('describeException', () => {
  it('passes client errors through', () => {
    expect(
      describeException(new BadRequestException({ message: '입력 오류' })),
    ).toEqual({
      status: 400,
      message: '입력 오류',
    });
  });

  it('keeps validation messages as a list', () => {
    const { message } = describeException(new BadRequestException(['a', 'b']));
    expect(message).toEqual(['a', 'b']);
  });

  it('hides 5xx messages unless they are marked public', () => {
    const hidden = describeException(
      new ServiceUnavailableException({ message: 'smtp password rejected' }),
    );
    expect(hidden.status).toBe(503);
    expect(hidden.message).not.toContain('smtp');

    const shown = describeException(
      new ServiceUnavailableException({ message: '점검 중', public: true }),
    );
    expect(shown.message).toBe('점검 중');
  });

  it('answers 401 for JWT errors', () => {
    expect(
      describeException(new JsonWebTokenError('invalid signature')).status,
    ).toBe(401);
    expect(
      describeException(new TokenExpiredError('jwt expired', new Date()))
        .status,
    ).toBe(401);
  });

  it('maps duplicate keys to a conflict without SQL details', () => {
    const { status, message } = describeException(queryError('ER_DUP_ENTRY'));
    expect(status).toBe(409);
    expect(JSON.stringify(message)).not.toContain('secret_column');
  });

  it('hides other query errors', () => {
    const { status, message } = describeException(
      queryError('ER_BAD_FIELD_ERROR'),
    );
    expect(status).toBe(500);
    expect(JSON.stringify(message)).not.toMatch(/secret_column|ER_BAD/);
  });

  it('hides unexpected errors', () => {
    const { status, message } = describeException(
      new TypeError('cannot read secret'),
    );
    expect(status).toBe(500);
    expect(JSON.stringify(message)).not.toContain('secret');
  });

  it('keeps the status of Express middleware errors', () => {
    const malformed = Object.assign(
      new SyntaxError('Unexpected token s in secret'),
      {
        status: 400,
      },
    );
    const { status, message } = describeException(malformed);
    expect(status).toBe(400);
    expect(JSON.stringify(message)).not.toContain('secret');
  });
});
