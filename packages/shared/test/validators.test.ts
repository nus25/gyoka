import { describe, it, expect } from 'vitest';

import { feedUri, postUri, repostUri, did } from '../src/validators';

describe('Success cases', () => {
  it('Given valid feedUri inputs When parsing Then it succeeds', () => {
    const validCharUri = 'at://did:plc:1234abcd/app.bsky.feed.generator/A-Za-z0-9._~:-';
    expect(() => feedUri.parse(validCharUri)).not.toThrow();

    const validMaxLengthUri =
      'at://did:plc:1234abcd/app.bsky.feed.generator/' + '12345678'.repeat(64);
    expect(() => feedUri.parse(validMaxLengthUri)).not.toThrow();
  });

  it('Given valid postUri When parsing Then it succeeds', () => {
    const validUri = 'at://did:plc:1234abcd/app.bsky.feed.post/xyz123';
    expect(() => postUri.parse(validUri)).not.toThrow();
  });

  it('Given valid repostUri When parsing Then it succeeds', () => {
    const validUri = 'at://did:plc:1234abcd/app.bsky.feed.repost/repost123';
    expect(() => repostUri.parse(validUri)).not.toThrow();
  });

  it('Given valid DID When parsing Then it succeeds', () => {
    const validDid = 'did:plc:user.example.com';
    expect(() => did.parse(validDid)).not.toThrow();
  });
});

describe('Error cases', () => {
  it('Given invalid feedUri format When safeParse is called Then it returns invalid result', () => {
    const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.generator/';
    const result = feedUri.safeParse(invalidUri);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe(
      'Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.generator/{record-key}'
    );
  });

  it('Given feedUri with invalid collection When safeParse is called Then it returns invalid result', () => {
    const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.invalid/feedrkey';
    const result = feedUri.safeParse(invalidUri);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe(
      'Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.generator/{record-key}'
    );
  });

  it('Given invalid postUri format When safeParse is called Then it returns invalid result', () => {
    const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.post/';
    const result = postUri.safeParse(invalidUri);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe(
      'Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.post/{record-key}'
    );
  });

  it('Given postUri with invalid collection When safeParse is called Then it returns invalid result', () => {
    const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.invalid/xyz123';
    const result = postUri.safeParse(invalidUri);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe(
      'Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.post/{record-key}'
    );
  });

  it('Given invalid repostUri format When parse is called Then it throws expected error', () => {
    const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.repost/';
    expect(() => repostUri.parse(invalidUri)).toThrow(
      'Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.repost/{record-key}'
    );
  });

  it('Given repostUri with invalid collection When parse is called Then it throws expected error', () => {
    const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.invalid/repost123';
    expect(() => repostUri.parse(invalidUri)).toThrow(
      'Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.repost/{record-key}'
    );
  });

  it('Given invalid DID prefix When parse is called Then it throws expected error', () => {
    const invalidDid = 'invalid:plc:user.example.com';
    expect(() => did.parse(invalidDid)).toThrow(
      'Invalid DID format. Expected format: did:{method}:{identifier}'
    );
  });
});

describe('Boundary cases', () => {
  it('Given feedUri with invalid record-key edge patterns When safeParse is called Then it returns invalid result', () => {
    const invalidUri1 = 'at://did:plc:1234abcd/app.bsky.feed.generator/..';
    const result1 = feedUri.safeParse(invalidUri1);

    const invalidUri2 = 'at://did:plc:1234abcd/app.bsky.feed.generator/./';
    const result2 = feedUri.safeParse(invalidUri2);

    const invalidUri3 =
      'at://did:plc:1234abcd/app.bsky.feed.generator/too_long-' + '12345678'.repeat(63);
    const result3 = feedUri.safeParse(invalidUri3);

    const results = [result1, result2, result3];
    results.forEach((result) => {
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe(
        'Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.generator/{record-key}'
      );
    });
  });

  it('Given DID without method When parse is called Then it throws expected error', () => {
    const invalidDid = 'did::user.example.com';
    expect(() => did.parse(invalidDid)).toThrow(
      'Invalid DID format. Expected format: did:{method}:{identifier}'
    );
  });
});
