import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetNusnoGyokaFeedDefs from "./defs.js";

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
						return NetNusnoGyokaFeedDefs.postInputSchema
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
						return NetNusnoGyokaFeedDefs.postViewSchema
					},
				}
			),
		}
	}
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface $params {}

export interface $input extends v.InferXRPCBodyInput<mainSchema['input']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		"net.nusno.gyoka.feed.addPost": mainSchema;
	}
}
