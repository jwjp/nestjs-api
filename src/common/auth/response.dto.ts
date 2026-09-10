import { OmitType } from '@nestjs/swagger';

export class ResponseDto {
  /**
   * Response result
   * @example true
   */
  result: boolean;

  /**
   * Response status code
   * @example 201
   */
  statusCode: number;

  /**
   * Request method and URL
   * @example 'POST /member'
   */
  request: string;

  /**
   * Response timestamp
   * @example 'Wed Jan 01 2024 13:00:00 GMT+0900 (Korean Standard Time)'
   */
  timestamp: string;

  /**
   * Response message
   */
  message: object;
}

export class ResponseErrorDto extends OmitType(ResponseDto, ['message']) {
  /**
   * Response result
   * @example false
   */
  result: boolean;

  /**
   * Response status code
   * @example 400
   */
  statusCode: number;

  /**
   * Request method and URL
   * @example 'POST /member'
   */
  request: string;

  /**
   * Response timestamp
   * @example 'Wed Jan 01 2024 13:00:00 GMT+0900 (Korean Standard Time)'
   */
  timestamp: string;

  /**
   * Error message
   */
  message: {
    error: string;
  };
}
