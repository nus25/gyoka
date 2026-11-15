import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetNusnoGyokaFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.movePosts",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * @minimum 0
					 */
					"expectedRevision": /*#__PURE__*/ v.integer(),
					"feed": /*#__PURE__*/ v.resourceUriString(),
					get "placement"() {
						return NetNusnoGyokaFeedDefs.placementSchema
					},
					/**
					 * @minLength 1
					 * @maxLength 25
					 */
					"posts": /*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.array(/*#__PURE__*/ v.resourceUriString()),
						[/*#__PURE__*/ v.arrayLength(1, 25)]
					),
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"feed": /*#__PURE__*/ v.resourceUriString(),
					/**
					 * @minimum 1
					 */
					"movedCount": /*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1)]
					),
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
		"net.nusno.gyoka.feed.movePosts": mainSchema;
	}
}
