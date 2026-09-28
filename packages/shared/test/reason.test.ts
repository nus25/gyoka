import { describe, expect, it } from 'vitest';

import { toEditorReason, toGeneratorReason } from '../src/reason';

describe('reason conversion', () => {
  it('converts an editor repost reason to the generator representation', () => {
    expect(
      toGeneratorReason({
        $type: 'net.nusno.gyoka.feed.defs#skeletonReasonRepost',
        repost: 'at://did:plc:testuser/app.bsky.feed.repost/repost1',
      })
    ).toEqual({
      $type: 'app.bsky.feed.defs#skeletonReasonRepost',
      repost: 'at://did:plc:testuser/app.bsky.feed.repost/repost1',
    });
  });

  it('converts an editor pin reason to the generator representation', () => {
    expect(
      toGeneratorReason({
        $type: 'net.nusno.gyoka.feed.defs#skeletonReasonPin',
      })
    ).toEqual({
      $type: 'app.bsky.feed.defs#skeletonReasonPin',
    });
  });

  it('converts a generator repost reason to the editor representation', () => {
    expect(
      toEditorReason({
        $type: 'app.bsky.feed.defs#skeletonReasonRepost',
        repost: 'at://did:plc:testuser/app.bsky.feed.repost/repost1',
      })
    ).toEqual({
      $type: 'net.nusno.gyoka.feed.defs#skeletonReasonRepost',
      repost: 'at://did:plc:testuser/app.bsky.feed.repost/repost1',
    });
  });

  it('returns undefined for a generator reason unsupported by the editor API', () => {
    expect(toEditorReason({ $type: 'app.bsky.feed.defs#unknown' })).toBeUndefined();
  });
});
