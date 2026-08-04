import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.addPost",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * AT-URI of the feed generator record receiving the post.
					 */
					"feed": /*#__PURE__*/ v.resourceUriString(),
					get "post"() {
						return postInputSchema
					},
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"feed": /*#__PURE__*/ v.resourceUriString(),
					"message": /*#__PURE__*/ v.string(),
					get "post"() {
						return postViewSchema
					},
				}
			),
		}
	}
);
const _postInputSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.addPost#postInput")),
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
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.addPost#postView")),
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
	"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.addPost#skeletonReasonPin")),
});
const _skeletonReasonRepostSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.addPost#skeletonReasonRepost")),
		/**
		 * AT-URI of the app.bsky.feed.repost record associated with this reason.
		 */
		"repost": /*#__PURE__*/ v.resourceUriString(),
	}
);
type main$schematype = typeof _mainSchema;
type postInput$schematype = typeof _postInputSchema;
type postView$schematype = typeof _postViewSchema;
type skeletonReasonPin$schematype = typeof _skeletonReasonPinSchema;
type skeletonReasonRepost$schematype = typeof _skeletonReasonRepostSchema;

export interface mainSchema extends main$schematype {}

export interface postInputSchema extends postInput$schematype {}

export interface postViewSchema extends postView$schematype {}

export interface skeletonReasonPinSchema extends skeletonReasonPin$schematype {}

export interface skeletonReasonRepostSchema extends skeletonReasonRepost$schematype {}
export const mainSchema = _mainSchema as mainSchema;
export const postInputSchema = _postInputSchema as postInputSchema;
export const postViewSchema = _postViewSchema as postViewSchema;
export const skeletonReasonPinSchema = _skeletonReasonPinSchema as skeletonReasonPinSchema;
export const skeletonReasonRepostSchema = _skeletonReasonRepostSchema as skeletonReasonRepostSchema;

export interface PostInput extends v.InferInput<typeof postInputSchema> {}

export interface PostView extends v.InferInput<typeof postViewSchema> {}

export interface SkeletonReasonPin extends v.InferInput<typeof skeletonReasonPinSchema> {}

export interface SkeletonReasonRepost extends v.InferInput<typeof skeletonReasonRepostSchema> {}

export interface $params {}

export interface $input extends v.InferXRPCBodyInput<mainSchema['input']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		"net.nusno.gyoka.feed.addPost": mainSchema;
	}
}
