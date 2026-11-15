import { InvalidOrderRankError, OrderRankSpaceExhaustedError } from './errors/core';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);
const MAX_ORDER_RANK_BYTES = 256;
const WARN_ORDER_RANK_BYTES = 200;

export type OrderRank = string & { readonly __brand: 'OrderRank' };

export type RankBounds = {
  lower?: OrderRank;
  upper?: OrderRank;
};

type ParsedRank = {
  integer: bigint;
  integerPart: string;
  fraction: string;
};

function digitValue(character: string): number {
  return ALPHABET.indexOf(character);
}

function encodeDigits(value: bigint, length: number): string {
  let remainder = value;
  let encoded = '';
  for (let index = 0; index < length; index += 1) {
    encoded = ALPHABET[Number(remainder % BASE)] + encoded;
    remainder /= BASE;
  }
  return encoded;
}

function pow(base: bigint, exponent: number): bigint {
  return base ** BigInt(exponent);
}

function decodeInteger(head: string, body: string): bigint {
  let bodyValue = 0n;
  for (const character of body) {
    bodyValue = bodyValue * BASE + BigInt(digitValue(character));
  }

  const length = body.length;
  let offset = 0n;
  for (let index = 1; index < length; index += 1) {
    offset += pow(BASE, index);
  }

  if (head >= 'a' && head <= 'z') {
    return offset + bodyValue;
  }
  return -(offset + pow(BASE, length) - bodyValue);
}

function encodeInteger(value: bigint): string {
  if (value >= 0n) {
    let length = 1;
    let offset = 0n;
    while (value >= offset + pow(BASE, length)) {
      offset += pow(BASE, length);
      length += 1;
    }
    if (length > 26) {
      throw new OrderRankSpaceExhaustedError(
        'Order rank integer portion exceeds GyokaRank/1 limits.'
      );
    }
    return (
      String.fromCharCode('a'.charCodeAt(0) + length - 1) + encodeDigits(value - offset, length)
    );
  }

  const magnitude = -value;
  let length = 1;
  let offset = 0n;
  while (magnitude > offset + pow(BASE, length)) {
    offset += pow(BASE, length);
    length += 1;
  }
  if (length > 26) {
    throw new OrderRankSpaceExhaustedError(
      'Order rank integer portion exceeds GyokaRank/1 limits.'
    );
  }
  const bodyValue = offset + pow(BASE, length) - magnitude;
  return String.fromCharCode('Z'.charCodeAt(0) - length + 1) + encodeDigits(bodyValue, length);
}

function parseRank(value: string): ParsedRank {
  if (value.length === 0 || value.length > MAX_ORDER_RANK_BYTES) {
    throw new InvalidOrderRankError('Order rank must be a non-empty canonical GyokaRank/1 value.');
  }

  const head = value[0]!;
  const isPositive = head >= 'a' && head <= 'z';
  const isNegative = head >= 'A' && head <= 'Z';
  if (!isPositive && !isNegative) {
    throw new InvalidOrderRankError('Order rank has an invalid integer head.');
  }

  const length = isPositive
    ? head.charCodeAt(0) - 'a'.charCodeAt(0) + 1
    : 'Z'.charCodeAt(0) - head.charCodeAt(0) + 1;
  if (value.length < length + 1) {
    throw new InvalidOrderRankError('Order rank integer body is incomplete.');
  }

  const integerPart = value.slice(0, length + 1);
  const fraction = value.slice(length + 1);
  if (
    [...value].some((character) => digitValue(character) < 0 && character !== head) ||
    (fraction.length > 0 && fraction.endsWith('0'))
  ) {
    throw new InvalidOrderRankError('Order rank is not canonical.');
  }

  const body = integerPart.slice(1);
  if (body.length !== length || [...body].some((character) => digitValue(character) < 0)) {
    throw new InvalidOrderRankError('Order rank integer body is invalid.');
  }

  return { integer: decodeInteger(head, body), integerPart, fraction };
}

export function validateOrderRank(value: string): OrderRank {
  parseRank(value);
  return value as OrderRank;
}

function assertWithinLimit(value: string, warnOnLongRank?: (value: string) => void): OrderRank {
  warnOnLongRank?.(value);
  if (value.length > MAX_ORDER_RANK_BYTES) {
    throw new OrderRankSpaceExhaustedError(
      'No GyokaRank/1 value remains within the 256-byte limit.'
    );
  }
  return validateOrderRank(value);
}

function suffixAfter(value: string): string {
  return `${value}U`;
}

function fractionBetween(lower: string, upper: string): string {
  let prefix = '';
  let index = 0;

  while (true) {
    const lowerDigit = index < lower.length ? digitValue(lower[index]!) : -1;
    const upperDigit = index < upper.length ? digitValue(upper[index]!) : -1;
    if (lowerDigit === upperDigit) {
      prefix += lower[index]!;
      index += 1;
      continue;
    }

    if (lowerDigit === -1) {
      if (upperDigit > 0) {
        const midpoint = Math.floor(upperDigit / 2);
        return midpoint === 0 ? `${prefix}0U` : `${prefix}${ALPHABET[midpoint]}`;
      }
      prefix += '0';
      index += 1;
      continue;
    }

    if (upperDigit === -1) {
      throw new InvalidOrderRankError('Order rank bounds must be strictly increasing.');
    }

    if (upperDigit - lowerDigit > 1) {
      return `${prefix}${ALPHABET[Math.floor((lowerDigit + upperDigit) / 2)]}`;
    }

    return `${prefix}${ALPHABET[lowerDigit]}${suffixAfter(lower.slice(index + 1))}`;
  }
}

function rankBetweenInternal(
  bounds: RankBounds,
  warnOnLongRank?: (value: string) => void
): OrderRank {
  const lower = bounds.lower ? parseRank(bounds.lower) : undefined;
  const upper = bounds.upper ? parseRank(bounds.upper) : undefined;

  if (lower && upper && bounds.lower! >= bounds.upper!) {
    throw new InvalidOrderRankError('Order rank bounds must be strictly increasing.');
  }
  if (!lower && !upper) {
    return validateOrderRank('a0');
  }
  if (!lower) {
    return assertWithinLimit(encodeInteger(upper!.integer - 1n), warnOnLongRank);
  }
  if (!upper) {
    return assertWithinLimit(encodeInteger(lower.integer + 1n), warnOnLongRank);
  }
  if (upper.integer - lower.integer > 1n) {
    return assertWithinLimit(encodeInteger((lower.integer + upper.integer) / 2n), warnOnLongRank);
  }
  if (upper.integer === lower.integer) {
    return assertWithinLimit(
      `${lower.integerPart}${fractionBetween(lower.fraction, upper.fraction)}`,
      warnOnLongRank
    );
  }
  return assertWithinLimit(`${lower.integerPart}${suffixAfter(lower.fraction)}`, warnOnLongRank);
}

export function rankBetween(bounds: RankBounds): OrderRank {
  return rankBetweenInternal(bounds);
}

export function rankBetweenN(bounds: RankBounds, count: number): OrderRank[] {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new InvalidOrderRankError('Order rank batch count must be a positive integer.');
  }

  const lower = bounds.lower ? parseRank(bounds.lower) : undefined;
  const upper = bounds.upper ? parseRank(bounds.upper) : undefined;
  if (lower && upper && bounds.lower! >= bounds.upper!) {
    throw new InvalidOrderRankError('Order rank bounds must be strictly increasing.');
  }

  let hasWarned = false;
  const warnOnLongRank = (value: string) => {
    if (hasWarned || value.length <= WARN_ORDER_RANK_BYTES) {
      return;
    }
    console.warn(
      `Generated order rank is ${value.length} bytes; warning threshold is ${WARN_ORDER_RANK_BYTES}.`
    );
    hasWarned = true;
  };

  if (!lower && !upper) {
    return Array.from({ length: count }, (_, index) =>
      assertWithinLimit(encodeInteger(BigInt(index)), warnOnLongRank)
    );
  }
  if (lower && !upper) {
    return Array.from({ length: count }, (_, index) =>
      assertWithinLimit(encodeInteger(lower.integer + BigInt(index + 1)), warnOnLongRank)
    );
  }
  if (!lower && upper) {
    return Array.from({ length: count }, (_, index) =>
      assertWithinLimit(encodeInteger(upper!.integer - BigInt(count - index)), warnOnLongRank)
    );
  }

  const ranks: OrderRank[] = [];
  const fill = (left: OrderRank, right: OrderRank, remaining: number) => {
    if (remaining === 0) {
      return;
    }
    const before = Math.floor((remaining - 1) / 2);
    const middle = rankBetweenInternal({ lower: left, upper: right }, warnOnLongRank);
    fill(left, middle, before);
    ranks.push(middle);
    fill(middle, right, remaining - before - 1);
  };
  fill(bounds.lower!, bounds.upper!, count);
  return ranks;
}
