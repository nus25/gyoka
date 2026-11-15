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
		 * Current feed order revision.
		 * @minimum 0
		 */
		"orderRevision": /*#__PURE__*/ v.integer(),
		/**
		 * AT-URI of the feed generator record.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _placementSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#placement")),
		/**
		 * AT-URI of the anchor post. Required by before and after placements.
		 */
		"anchor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
		"type": /*#__PURE__*/ v.literalEnum(["after", "append", "before", "prepend"]),
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
		 * Timestamp recorded when the post is added. Defaults to the current time when omitted.
		 */
		"indexedAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
		/**
		 * Optional language tags for the post. The wildcard '*' is accepted, and non-wildcard values are normalized to primary language subtags.
		 * @maxLength 5
		 */
		"languages": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.array(/*#__PURE__*/ v.string()),
			[/*#__PURE__*/ v.arrayLength(0, 5)]
		)),
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
const _postResultSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#postResult")),
		"action": /*#__PURE__*/ v.literalEnum([
			"created",
			"failed",
			"notFound",
			"removed",
			"unchanged",
			"updated"
		]),
		/**
		 * Error code for a failed item.
		 */
		"error": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _postViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.defs#postView")),
		"cid": /*#__PURE__*/ v.cidString(),
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
type placement$schematype = typeof _placementSchema;
type postInput$schematype = typeof _postInputSchema;
type postResult$schematype = typeof _postResultSchema;
type postView$schematype = typeof _postViewSchema;
type skeletonReasonPin$schematype = typeof _skeletonReasonPinSchema;
type skeletonReasonRepost$schematype = typeof _skeletonReasonRepostSchema;

export interface feedViewSchema extends feedView$schematype {}

export interface placementSchema extends placement$schematype {}

export interface postInputSchema extends postInput$schematype {}

export interface postResultSchema extends postResult$schematype {}

export interface postViewSchema extends postView$schematype {}

export interface skeletonReasonPinSchema extends skeletonReasonPin$schematype {}

export interface skeletonReasonRepostSchema extends skeletonReasonRepost$schematype {}
export const feedViewSchema = _feedViewSchema as feedViewSchema;
export const placementSchema = _placementSchema as placementSchema;
export const postInputSchema = _postInputSchema as postInputSchema;
export const postResultSchema = _postResultSchema as postResultSchema;
export const postViewSchema = _postViewSchema as postViewSchema;
export const skeletonReasonPinSchema = _skeletonReasonPinSchema as skeletonReasonPinSchema;
export const skeletonReasonRepostSchema = _skeletonReasonRepostSchema as skeletonReasonRepostSchema;

export interface FeedView extends v.InferInput<typeof feedViewSchema> {}

export interface Placement extends v.InferInput<typeof placementSchema> {}

export interface PostInput extends v.InferInput<typeof postInputSchema> {}

export interface PostResult extends v.InferInput<typeof postResultSchema> {}

export interface PostView extends v.InferInput<typeof postViewSchema> {}

export interface SkeletonReasonPin extends v.InferInput<typeof skeletonReasonPinSchema> {}

export interface SkeletonReasonRepost extends v.InferInput<typeof skeletonReasonRepostSchema> {}
