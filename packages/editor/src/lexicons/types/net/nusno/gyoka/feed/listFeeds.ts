import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetNusnoGyokaFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"net.nusno.gyoka.feed.listFeeds",
	{
		"params": null,
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "feeds"() {
						return /*#__PURE__*/ v.array(NetNusnoGyokaFeedDefs.feedViewSchema)
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

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"net.nusno.gyoka.feed.listFeeds": mainSchema;
	}
}
