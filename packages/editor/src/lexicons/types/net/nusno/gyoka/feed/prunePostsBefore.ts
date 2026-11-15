import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.prunePostsBefore",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object({
				"before": /*#__PURE__*/ v.datetimeString(),
				"feed": /*#__PURE__*/ v.resourceUriString(),
			}),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					"before": /*#__PURE__*/ v.datetimeString(),
					/**
					 * @minimum 0
					 */
					"deletedCount": /*#__PURE__*/ v.integer(),
					"feed": /*#__PURE__*/ v.resourceUriString(),
					/**
					 * Current feed order revision after pruning.
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
		"net.nusno.gyoka.feed.prunePostsBefore": mainSchema;
	}
}
