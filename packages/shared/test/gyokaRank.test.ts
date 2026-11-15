import { describe, expect, it, vi } from 'vitest';

import { OrderRankSpaceExhaustedError, InvalidOrderRankError } from '../src/errors/core';
import { rankBetween, rankBetweenN, validateOrderRank, type OrderRank } from '../src/gyokaRank';

function compareRanks(left: OrderRank, right: OrderRank): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

describe('GyokaRank/1', () => {
  it('Given valid input when validated then it should validate correctly', () => {
    expect(validateOrderRank('a0')).toBe('a0');
    expect(validateOrderRank('Zz')).toBe('Zz');
    expect(validateOrderRank('b00z')).toBe('b00z');

    for (const rank of ['', 'a', 'a00', 'a0!', 'A0', 'b0', 'a0U0']) {
      expect(() => validateOrderRank(rank)).toThrow(InvalidOrderRankError);
    }
  });

  it('Given various bounds when generating ranks then it should produce correct intermediate ranks', () => {
    expect(rankBetween({})).toBe('a0');
    expect(rankBetween({ lower: validateOrderRank('a0') })).toBe('a1');
    expect(rankBetween({ upper: validateOrderRank('a0') })).toBe('Zz');
    expect(rankBetween({ lower: validateOrderRank('a0'), upper: validateOrderRank('a2') })).toBe(
      'a1'
    );

    const lower = validateOrderRank('a0');
    const upper = validateOrderRank('a0U');
    const first = rankBetween({ lower, upper });
    expect(first).toBe(rankBetween({ lower, upper }));
    expect(compareRanks(lower, first)).toBeLessThan(0);
    expect(compareRanks(first, upper)).toBeLessThan(0);
  });

  it('Given invalid bounds or exhausted storage when generating ranks then it should throw errors', () => {
    const rank = validateOrderRank('a0');
    expect(() => rankBetween({ lower: rank, upper: rank })).toThrow(InvalidOrderRankError);
    expect(() => rankBetween({ lower: validateOrderRank('a1'), upper: rank })).toThrow(
      InvalidOrderRankError
    );

    const lower = validateOrderRank(`a0${'z'.repeat(254)}`);
    expect(() => rankBetween({ lower, upper: validateOrderRank('a1') })).toThrow(
      OrderRankSpaceExhaustedError
    );
  });

  it('Given a range and a count when generating multiple ranks then it should produce deterministic, strictly increasing batches compatible with BINARY ordering', () => {
    const ranks = rankBetweenN(
      { lower: validateOrderRank('a0'), upper: validateOrderRank('a1') },
      25
    );
    expect(ranks).toHaveLength(25);
    expect(ranks).toEqual(
      rankBetweenN({ lower: validateOrderRank('a0'), upper: validateOrderRank('a1') }, 25)
    );
    expect([...ranks].sort()).toEqual(ranks);
    for (let index = 1; index < ranks.length; index += 1) {
      expect(compareRanks(ranks[index - 1]!, ranks[index]!)).toBeLessThan(0);
    }
  });

  it('Given a batch rank above the warning threshold when generating ranks then it should warn before the storage limit', () => {
    const consoleObject = globalThis as unknown as {
      console: { warn: (...args: unknown[]) => void };
    };
    const warn = vi.spyOn(consoleObject.console, 'warn').mockImplementation(() => {});
    const lower = validateOrderRank(`a0${'z'.repeat(198)}`);

    try {
      const ranks = rankBetweenN({ lower, upper: validateOrderRank('a1') }, 2);

      expect(ranks.every((rank) => rank.length > 200 && rank.length < 256)).toBe(true);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('Given a batch rank beyond the storage limit when generating ranks then it should warn before throwing', () => {
    const consoleObject = globalThis as unknown as {
      console: { warn: (...args: unknown[]) => void };
    };
    const warn = vi.spyOn(consoleObject.console, 'warn').mockImplementation(() => {});
    const lower = validateOrderRank(`a0${'z'.repeat(254)}`);

    try {
      expect(() => rankBetweenN({ lower, upper: validateOrderRank('a1') }, 1)).toThrow(
        OrderRankSpaceExhaustedError
      );
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('Given repeated append, prepend, and random insertions when generating ranks then it should keep ranks below the storage limit', () => {
    let append = validateOrderRank('a0');
    let prepend = validateOrderRank('a0');
    const randomRanks: OrderRank[] = [validateOrderRank('a0')];

    for (let index = 0; index < 10_000; index += 1) {
      append = rankBetween({ lower: append });
      prepend = rankBetween({ upper: prepend });

      const insertionIndex = (index * 7919) % (randomRanks.length + 1);
      randomRanks.splice(
        insertionIndex,
        0,
        rankBetween({
          lower: randomRanks[insertionIndex - 1],
          upper: randomRanks[insertionIndex],
        })
      );
    }

    expect(
      Math.max(append.length, prepend.length, ...randomRanks.map((rank) => rank.length))
    ).toBeLessThan(256);
    expect([...randomRanks].sort()).toEqual(randomRanks);
  });

  it('Given one thousand repeated insertions in the same interval when generating ranks then it should maintain order and stay below the storage limit', () => {
    const lower = validateOrderRank('a0');
    let upper = validateOrderRank('a1');

    for (let index = 0; index < 1_000; index += 1) {
      upper = rankBetween({ lower, upper });
      expect(compareRanks(lower, upper)).toBeLessThan(0);
    }

    expect(upper.length).toBeLessThan(256);
  });
});
