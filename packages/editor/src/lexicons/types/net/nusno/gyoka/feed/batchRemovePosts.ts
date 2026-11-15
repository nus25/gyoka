import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _entryInputSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.batchRemovePosts#entryInput")),
		"feed": /*#__PURE__*/ v.resourceUriString(),
		/**
		 * @minLength 1
		 */
		get "posts"() {
			return /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.array(postInputSchema),
				[/*#__PURE__*/ v.arrayLength(1)]
			)
		},
	}
);
const _entryResultSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.batchRemovePosts#entryResult")),
		"feed": /*#__PURE__*/ v.resourceUriString(),
		get "results"() {
			return /*#__PURE__*/ v.array(postResultSchema)
		},
	}
);
const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.batchRemovePosts",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "entries"() {
						return /*#__PURE__*/ v.array(entryInputSchema)
					},
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "results"() {
						return /*#__PURE__*/ v.array(entryResultSchema)
					},
				}
			),
		}
	}
);
const _postInputSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.batchRemovePosts#postInput")),
		/**
		 * If provided, only the matching post instance at this timestamp is removed.
		 */
		"indexedAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
		/**
		 * AT-URI of the app.bsky.feed.post record to remove.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _postResultSchema = /*#__PURE__*/ v.object({
	"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.batchRemovePosts#postResult")),
	"error": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
	"status": /*#__PURE__*/ v.literalEnum(["error", "removed"]),
	"uri": /*#__PURE__*/ v.resourceUriString(),
});
type entryInput$schematype = typeof _entryInputSchema;
type entryResult$schematype = typeof _entryResultSchema;
type main$schematype = typeof _mainSchema;
type postInput$schematype = typeof _postInputSchema;
type postResult$schematype = typeof _postResultSchema;

export interface entryInputSchema extends entryInput$schematype {}

export interface entryResultSchema extends entryResult$schematype {}

export interface mainSchema extends main$schematype {}

export interface postInputSchema extends postInput$schematype {}

export interface postResultSchema extends postResult$schematype {}
export const entryInputSchema = _entryInputSchema as entryInputSchema;
export const entryResultSchema = _entryResultSchema as entryResultSchema;
export const mainSchema = _mainSchema as mainSchema;
export const postInputSchema = _postInputSchema as postInputSchema;
export const postResultSchema = _postResultSchema as postResultSchema;

export interface EntryInput extends v.InferInput<typeof entryInputSchema> {}

export interface EntryResult extends v.InferInput<typeof entryResultSchema> {}

export interface PostInput extends v.InferInput<typeof postInputSchema> {}

export interface PostResult extends v.InferInput<typeof postResultSchema> {}

export interface $params {}

export interface $input extends v.InferXRPCBodyInput<mainSchema['input']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		"net.nusno.gyoka.feed.batchRemovePosts": mainSchema;
	}
}
