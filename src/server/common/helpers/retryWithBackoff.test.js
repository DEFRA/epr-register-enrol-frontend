import { describe, test, expect, vi, afterEach } from 'vitest'
import { retryWithBackoff } from './retryWithBackoff.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('retryWithBackoff', () => {
  test('returns the result on first success without waiting', async () => {
    const fn = vi.fn().mockResolvedValue('ok')

    const result = await retryWithBackoff(fn)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('retries after a failure and returns the eventual success', async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValueOnce('ok')

    const promise = retryWithBackoff(fn)
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('waits 5s then 10s between three attempts', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    const promise = retryWithBackoff(fn)
    promise.catch(() => {})

    expect(fn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(10000)
    expect(fn).toHaveBeenCalledTimes(3)

    await expect(promise).rejects.toThrow('always fails')
  })

  test('throws the last error once retries are exhausted', async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('final failure'))

    const promise = retryWithBackoff(fn)
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(15000)

    await expect(promise).rejects.toThrow('final failure')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('respects a custom retries/delaysMs config', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    const promise = retryWithBackoff(fn, { retries: 2, delaysMs: [100] })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('falls back to the last configured delay once attempts exceed delaysMs length', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    const promise = retryWithBackoff(fn, { retries: 3, delaysMs: [100] })
    promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(3)

    await expect(promise).rejects.toThrow('fail')
  })

  test('stops after one attempt when isRetryable returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'))

    await expect(
      retryWithBackoff(fn, { isRetryable: () => false })
    ).rejects.toThrow('permanent')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('only stops early once isRetryable actually returns false, not before', async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok')

    const promise = retryWithBackoff(fn, { isRetryable: () => true })
    await vi.advanceTimersByTimeAsync(5000)

    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('throws immediately for retries < 1 instead of throwing undefined', async () => {
    const fn = vi.fn()

    await expect(retryWithBackoff(fn, { retries: 0 })).rejects.toThrow(
      'retryWithBackoff: retries must be >= 1'
    )
    expect(fn).not.toHaveBeenCalled()
  })
})
