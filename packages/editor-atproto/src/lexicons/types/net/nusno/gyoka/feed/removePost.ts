import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.removePost",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"feed": /*#__PURE__*/ v.resourceUriString(),
					get "post"() {
						return postRefSchema
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
						return postResultSchema
					},
				}
			),
		}
	}
);
const _postRefSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.removePost#postRef")),
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
	"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.removePost#postResult")),
	"indexedAt": /*#__PURE__*/ v.datetimeString(),
	"uri": /*#__PURE__*/ v.resourceUriString(),
});
type main$schematype = typeof _mainSchema;
type postRef$schematype = typeof _postRefSchema;
type postResult$schematype = typeof _postResultSchema;

export interface mainSchema extends main$schematype {}

export interface postRefSchema extends postRef$schematype {}

export interface postResultSchema extends postResult$schematype {}
export const mainSchema = _mainSchema as mainSchema;
export const postRefSchema = _postRefSchema as postRefSchema;
export const postResultSchema = _postResultSchema as postResultSchema;

export interface PostRef extends v.InferInput<typeof postRefSchema> {}

export interface PostResult extends v.InferInput<typeof postResultSchema> {}

export interface $params {}

export interface $input extends v.InferXRPCBodyInput<mainSchema['input']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		"net.nusno.gyoka.feed.removePost": mainSchema;
	}
}
