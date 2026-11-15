import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetNusnoGyokaFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.putPosts",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"feed": /*#__PURE__*/ v.resourceUriString(),
					/**
					 * Placement for the submitted post URIs. Defaults to append.
					 */
					get "placement"() {
						return /*#__PURE__*/ v.optional(NetNusnoGyokaFeedDefs.placementSchema)
					},
					/**
					 * @minLength 1
					 * @maxLength 1000
					 */
					get "posts"() {
						return /*#__PURE__*/ v.constrain(
							/*#__PURE__*/ v.array(NetNusnoGyokaFeedDefs.postInputSchema),
							[/*#__PURE__*/ v.arrayLength(1, 1000)]
						)
					},
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"feed": /*#__PURE__*/ v.resourceUriString(),
					/**
					 * @minimum 0
					 */
					"orderRevision": /*#__PURE__*/ v.integer(),
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
		"net.nusno.gyoka.feed.putPosts": mainSchema;
	}
}
