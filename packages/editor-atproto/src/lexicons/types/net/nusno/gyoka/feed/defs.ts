import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';

const _feedViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#feedView")),
		/**
		 * Whether the feed is currently active.
		 */
		"isActive": /*#__PURE__*/ v.boolean(),
		/**
		 * Whether language filtering is enabled for the feed.
		 */
		"langFilter": /*#__PURE__*/ v.boolean(),
		/**
		 * AT-URI of the feed generator record.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _postInputSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#postInput")),
		/**
		 * CID of the post record.
		 */
		"cid": /*#__PURE__*/ v.cidString(),
		/**
		 * Context passed through to the client and feed generator.
		 * @maxLength 2000
		 */
		"feedContext": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[/*#__PURE__*/ v.stringLength(0, 2000)]
		)),
		/**
		 * Timestamp used for feed ordering. Defaults to the current time when omitted.
		 */
		"indexedAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
		/**
		 * Optional language tags for the post. The wildcard '*' is accepted, and non-wildcard values are normalized to primary language subtags.
		 */
		"languages": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(/*#__PURE__*/ v.string())),
		/**
		 * Reason for including the post in the feed skeleton.
		 */
		get "reason"() {
			return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.variant(
				[skeletonReasonPinSchema, skeletonReasonRepostSchema],
				true
			))
		},
		/**
		 * AT-URI of the app.bsky.feed.post record to add.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _postViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#postView")),
		"cid": /*#__PURE__*/ v.cidString(),
		/**
		 * @maxLength 2000
		 */
		"feedContext": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[/*#__PURE__*/ v.stringLength(0, 2000)]
		)),
		"indexedAt": /*#__PURE__*/ v.datetimeString(),
		"languages": /*#__PURE__*/ v.array(/*#__PURE__*/ v.string()),
		get "reason"() {
			return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.variant(
				[skeletonReasonPinSchema, skeletonReasonRepostSchema],
				true
			))
		},
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _skeletonReasonPinSchema = /*#__PURE__*/ v.object({
	"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#skeletonReasonPin")),
});
const _skeletonReasonRepostSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#skeletonReasonRepost")),
		/**
		 * AT-URI of the app.bsky.feed.repost record associated with this reason.
		 */
		"repost": /*#__PURE__*/ v.resourceUriString(),
	}
);
type feedView$schematype = typeof _feedViewSchema;
type postInput$schematype = typeof _postInputSchema;
type postView$schematype = typeof _postViewSchema;
type skeletonReasonPin$schematype = typeof _skeletonReasonPinSchema;
type skeletonReasonRepost$schematype = typeof _skeletonReasonRepostSchema;

export interface feedViewSchema extends feedView$schematype {}

export interface postInputSchema extends postInput$schematype {}

export interface postViewSchema extends postView$schematype {}

export interface skeletonReasonPinSchema extends skeletonReasonPin$schematype {}

export interface skeletonReasonRepostSchema extends skeletonReasonRepost$schematype {}
export const feedViewSchema = _feedViewSchema as feedViewSchema;
export const postInputSchema = _postInputSchema as postInputSchema;
export const postViewSchema = _postViewSchema as postViewSchema;
export const skeletonReasonPinSchema = _skeletonReasonPinSchema as skeletonReasonPinSchema;
export const skeletonReasonRepostSchema = _skeletonReasonRepostSchema as skeletonReasonRepostSchema;

export interface FeedView extends v.InferInput<typeof feedViewSchema> {}

export interface PostInput extends v.InferInput<typeof postInputSchema> {}

export interface PostView extends v.InferInput<typeof postViewSchema> {}

export interface SkeletonReasonPin extends v.InferInput<typeof skeletonReasonPinSchema> {}

export interface SkeletonReasonRepost extends v.InferInput<typeof skeletonReasonRepostSchema> {}
