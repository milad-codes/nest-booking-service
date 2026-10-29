import { BadRequestException, ConflictException, HttpStatus } from '@nestjs/common';
import { DriverException, NotFoundError, OptimisticLockError } from '@mikro-orm/postgresql';
import { ProblemDetailsFilter } from '../../src/common/problem-details.filter.js';

describe('ProblemDetailsFilter.toProblem', () => {
  const filter = new ProblemDetailsFilter();

  it('keeps validation messages as an errors list', () => {
    const problem = filter.toProblem(new BadRequestException(['email must be an email']));
    expect(problem).toMatchObject({ status: 400, title: 'Bad request', errors: ['email must be an email'] });
  });

  it('uses the exception message as detail', () => {
    expect(filter.toProblem(new ConflictException('Email is already registered'))).toMatchObject({
      status: 409,
      detail: 'Email is already registered',
    });
  });

  it('maps an exclusion-constraint violation (23P01) to 409', () => {
    const error = Object.assign(new DriverException(new Error('conflicting key value')), { code: '23P01' });
    expect(filter.toProblem(error)).toMatchObject({ status: HttpStatus.CONFLICT, code: '23P01' });
  });

  it('maps a lost optimistic-lock race to 409 instead of 500', () => {
    expect(filter.toProblem(OptimisticLockError.lockFailed('Booking'))).toMatchObject({ status: 409 });
  });

  it('maps ORM not-found to 404', () => {
    expect(filter.toProblem(new NotFoundError('User not found')).status).toBe(404);
  });

  it('hides unexpected errors behind a generic 500', () => {
    const problem = filter.toProblem(new Error('connection string with password'));
    expect(problem).toEqual({ type: 'about:blank', title: 'Internal server error', status: 500 });
  });
});
