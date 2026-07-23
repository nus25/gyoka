import type {} from '@atcute/lexicons';
import type {} from '@atcute/lexicons/ambient';

import * as v from '@atcute/lexicons/validations';

const _feedViewSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal('net.nusno.gyoka.feed.listFeeds#feedView')
  ),
  isActive: /*#__PURE__*/ v.boolean(),
  langFilter: /*#__PURE__*/ v.boolean(),
  uri: /*#__PURE__*/ v.resourceUriString(),
});
const _mainSchema = /*#__PURE__*/ v.query('net.nusno.gyoka.feed.listFeeds', {
  params: null,
  output: {
    type: 'lex',
    schema: /*#__PURE__*/ v.object({
      get feeds() {
        return /*#__PURE__*/ v.array(feedViewSchema);
      },
    }),
  },
});

type feedView$schematype = typeof _feedViewSchema;
type main$schematype = typeof _mainSchema;

export type feedViewSchema = feedView$schematype;
export type mainSchema = main$schematype;

export const feedViewSchema = _feedViewSchema as feedViewSchema;
export const mainSchema = _mainSchema as mainSchema;

export type FeedView = v.InferInput<typeof feedViewSchema>;

declare module '@atcute/lexicons/ambient' {
  interface XRPCQueries {
    'net.nusno.gyoka.feed.listFeeds': mainSchema;
  }
}
