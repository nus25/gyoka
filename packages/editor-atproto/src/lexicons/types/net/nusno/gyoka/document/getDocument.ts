import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.query(
	"net.nusno.gyoka.document.getDocument",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Document type to fetch.
				 */
				"type": /*#__PURE__*/ v.string<"privacy_policy" | "tos" | (string & {})>(),
			}
		),
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

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"net.nusno.gyoka.document.getDocument": mainSchema;
	}
}
