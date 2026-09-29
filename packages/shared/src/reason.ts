import { BadRequestError } from './errors/core';

const EDITOR_REASON_REPOST = 'net.nusno.gyoka.feed.defs#skeletonReasonRepost';
const EDITOR_REASON_PIN = 'net.nusno.gyoka.feed.defs#skeletonReasonPin';
const GENERATOR_REASON_REPOST = 'app.bsky.feed.defs#skeletonReasonRepost';
const GENERATOR_REASON_PIN = 'app.bsky.feed.defs#skeletonReasonPin';

export type EditorReason = {
  $type: string;
  repost?: string;
};

export type GeneratorReason =
  | {
      $type: typeof GENERATOR_REASON_REPOST;
      repost: string;
    }
  | {
      $type: typeof GENERATOR_REASON_PIN;
    };

export function toGeneratorReason(reason: EditorReason): GeneratorReason {
  switch (reason.$type) {
    case EDITOR_REASON_REPOST:
      if (!reason.repost) {
        throw new BadRequestError(`Reason type ${EDITOR_REASON_REPOST} needs repost field`);
      }
      return {
        $type: GENERATOR_REASON_REPOST,
        repost: reason.repost,
      };
    case EDITOR_REASON_PIN:
      return {
        $type: GENERATOR_REASON_PIN,
      };
    default:
      throw new BadRequestError(`Unsupported reason type: ${reason.$type}`);
  }
}

export function toEditorReason(reason: EditorReason): EditorReason | undefined {
  switch (reason.$type) {
    case GENERATOR_REASON_REPOST:
      return {
        $type: EDITOR_REASON_REPOST,
        repost: reason.repost,
      };
    case GENERATOR_REASON_PIN:
      return {
        $type: EDITOR_REASON_PIN,
      };
    default:
      return undefined;
  }
}
