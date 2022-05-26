import { Semaphore } from './semaphore';
import { sleep } from './sleep';

describe('Semaphore', () => {
  let semaphore: Semaphore;

  beforeAll(() => {
    semaphore = new Semaphore(5);
  });

  test('is created', () => {
    expect(semaphore).toBeDefined();
  });

  test('has 5 maximum slots', () => {
    expect(semaphore.max).toBe(5);
  });

  test('has 5 available slots', () => {
    expect(semaphore.available).toBe(5);
  });

  test('resizing semaphore to 6', () => {
    semaphore.resize(6);
    expect(semaphore.max).toBe(6);
    expect(semaphore.available).toBe(6);
  });

  test('it should acquire and hold the lock during execution, and then release it', () => {
    const result = semaphore.fire(() => sleep(5000));
    expect(semaphore.max).toBe(6);
    expect(semaphore.available).toBe(5);
    result.then(() => {
      expect(semaphore.available).toBe(6);
    });
  });
});
