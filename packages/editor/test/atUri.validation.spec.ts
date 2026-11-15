import { BadRequestError } from 'shared/src/errors/core';
import { describe, expect, it } from 'vitest';

import { assertAtUriCollection } from '../src/validation/atUri';

describe('assertAtUriCollection', () => {
  it('Given valid AT URI and expected collection When assert is called Then it does not throw', () => {
    expect(() => {
      assertAtUriCollection(
        'at://did:plc:testuser/app.bsky.feed.generator/feed-1',
        'app.bsky.feed.generator',
        'feed URI'
      );
    }).not.toThrow();
  });

  it('Given malformed AT URI When assert is called Then it throws BadRequestError', () => {
    expect(() => {
      assertAtUriCollection('invalid-uri', 'app.bsky.feed.generator', 'feed URI');
    }).toThrow(BadRequestError);

    expect(() => {
      assertAtUriCollection('invalid-uri', 'app.bsky.feed.generator', 'feed URI');
    }).toThrow('Invalid feed URI');
  });

  it('Given AT URI with different collection When assert is called Then it throws BadRequestError', () => {
    expect(() => {
      assertAtUriCollection(
        'at://did:plc:testuser/app.bsky.feed.post/post-1',
        'app.bsky.feed.generator',
        'feed URI'
      );
    }).toThrow(BadRequestError);

    expect(() => {
      assertAtUriCollection(
        'at://did:plc:testuser/app.bsky.feed.post/post-1',
        'app.bsky.feed.generator',
        'feed URI'
      );
    }).toThrow('Invalid feed URI collection');
  });
});
