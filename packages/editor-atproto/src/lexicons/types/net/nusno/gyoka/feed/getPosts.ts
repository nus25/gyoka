import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query("net.nusno.gyoka.feed.getPosts", {
  params: /*#__PURE__*/ v.object({
    cursor: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
    feed: /*#__PURE__*/ v.resourceUriString(),
    limit: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.integer(), [
        /*#__PURE__*/ v.integerRange(1, 3000),
      ]),
      1000,
    ),
  }),
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      cursor: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      feed: /*#__PURE__*/ v.resourceUriString(),
      get posts() {
        return /*#__PURE__*/ v.array(postViewSchema);
      },
    }),
  },
});
const _postViewSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("net.nusno.gyoka.feed.getPosts#postView"),
  ),
  cid: /*#__PURE__*/ v.cidString(),
  feedContext: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
  indexedAt: /*#__PURE__*/ v.datetimeString(),
  langs: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.array(/*#__PURE__*/ v.string()),
  ),
  languages: /*#__PURE__*/ v.array(/*#__PURE__*/ v.string()),
  get reason() {
    return /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.variant(
        [skeletonReasonPinSchema, skeletonReasonRepostSchema],
        true,
      ),
    );
  },
  uri: /*#__PURE__*/ v.resourceUriString(),
});
const _skeletonReasonPinSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("net.nusno.gyoka.feed.getPosts#skeletonReasonPin"),
  ),
});
const _skeletonReasonRepostSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal(
      "net.nusno.gyoka.feed.getPosts#skeletonReasonRepost",
    ),
  ),
  repost: /*#__PURE__*/ v.resourceUriString(),
});

type main$schematype = typeof _mainSchema;
type postView$schematype = typeof _postViewSchema;
type skeletonReasonPin$schematype = typeof _skeletonReasonPinSchema;
type skeletonReasonRepost$schematype = typeof _skeletonReasonRepostSchema;

export interface mainSchema extends main$schematype {}
export interface postViewSchema extends postView$schematype {}
export interface skeletonReasonPinSchema extends skeletonReasonPin$schematype {}
export interface skeletonReasonRepostSchema extends skeletonReasonRepost$schematype {}

export const mainSchema = _mainSchema as mainSchema;
export const postViewSchema = _postViewSchema as postViewSchema;
export const skeletonReasonPinSchema =
  _skeletonReasonPinSchema as skeletonReasonPinSchema;
export const skeletonReasonRepostSchema =
  _skeletonReasonRepostSchema as skeletonReasonRepostSchema;

export interface PostView extends v.InferInput<typeof postViewSchema> {}
export interface SkeletonReasonPin extends v.InferInput<
  typeof skeletonReasonPinSchema
> {}
export interface SkeletonReasonRepost extends v.InferInput<
  typeof skeletonReasonRepostSchema
> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "net.nusno.gyoka.feed.getPosts": mainSchema;
  }
}
