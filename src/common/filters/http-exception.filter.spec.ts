import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: { switchToHttp: () => { getResponse: () => typeof mockResponse } };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({ getResponse: () => mockResponse }),
    };
  });

  it('sets success:false and correct statusCode', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(404);
  });

  it('wraps string exception response into message field', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost as never);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.message).toBe('Forbidden');
  });

  it('spreads object exception response into output body', () => {
    const exception = new HttpException(
      { message: 'Validation failed', errors: ['field required'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost as never);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Validation failed');
    expect(body.errors).toEqual(['field required']);
  });

  it('includes an ISO timestamp in the response', () => {
    const exception = new HttpException('Error', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(exception, mockHost as never);

    const body = mockResponse.json.mock.calls[0][0];
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
  });
});
