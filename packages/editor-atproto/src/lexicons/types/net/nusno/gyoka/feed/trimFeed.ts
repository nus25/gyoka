import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.trimFeed",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"feed": /*#__PURE__*/ v.resourceUriString(),
					/**
					 * Number of posts to keep in the feed after trimming.
					 * @minimum 0
					 */
					"remain": /*#__PURE__*/ v.integer(),
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * @minimum 0
					 */
					"deletedCount": /*#__PURE__*/ v.integer(),
					"feed": /*#__PURE__*/ v.resourceUriString(),
					"message": /*#__PURE__*/ v.string(),
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
		"net.nusno.gyoka.feed.trimFeed": mainSchema;
	}
}
