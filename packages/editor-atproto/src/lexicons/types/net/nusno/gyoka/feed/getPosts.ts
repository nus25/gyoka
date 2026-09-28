import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetNusnoGyokaFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"net.nusno.gyoka.feed.getPosts",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Opaque pagination cursor encoded as <epochMs>::<cid>.
				 */
				"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * AT-URI of the feed generator record to read.
				 */
				"feed": /*#__PURE__*/ v.resourceUriString(),
				/**
				 * Maximum number of posts to return.
				 * @minimum 1
				 * @maximum 3000
				 * @default 1000
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 3000)]
					),
					1000
				),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
					"feed": /*#__PURE__*/ v.resourceUriString(),
					get "posts"() {
						return /*#__PURE__*/ v.array(NetNusnoGyokaFeedDefs.postViewSchema)
					},
				}
			),
		}
	}
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"net.nusno.gyoka.feed.getPosts": mainSchema;
	}
}
