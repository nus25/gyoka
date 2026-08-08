import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.document.updateDocument",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * Optional inline content for the document.
					 * @maxLength 32768
					 */
					"content": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.nullable(/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.string(),
						[/*#__PURE__*/ v.stringLength(0, 32768)]
					))),
					/**
					 * Document type to update.
					 */
					"type": /*#__PURE__*/ v.string<"privacy_policy" | "tos" | (string & {})>(),
					/**
					 * Optional source URL for the document.
					 * @maxLength 2048
					 */
					"url": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.nullable(/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.genericUriString(),
						[/*#__PURE__*/ v.stringLength(0, 2048)]
					))),
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * @maxLength 32768
					 */
					"content": /*#__PURE__*/ v.nullable(/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.string(),
						[/*#__PURE__*/ v.stringLength(0, 32768)]
					)),
					"type": /*#__PURE__*/ v.string<"privacy_policy" | "tos" | (string & {})>(),
					/**
					 * @maxLength 2048
					 */
					"url": /*#__PURE__*/ v.nullable(/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.genericUriString(),
						[/*#__PURE__*/ v.stringLength(0, 2048)]
					)),
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
		"net.nusno.gyoka.document.updateDocument": mainSchema;
	}
}
