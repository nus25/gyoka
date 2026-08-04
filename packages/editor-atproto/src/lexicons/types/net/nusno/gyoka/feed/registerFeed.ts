import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _feedViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.registerFeed#feedView")),
		"isActive": /*#__PURE__*/ v.boolean(),
		"langFilter": /*#__PURE__*/ v.boolean(),
		/**
		 * AT-URI of the app.bsky.feed.generator record.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _mainSchema = /*#__PURE__*/ v.procedure(
	"net.nusno.gyoka.feed.registerFeed",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * Whether the feed is active.
					 * @default true
					 */
					"isActive": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean(), true),
					/**
					 * Whether language filtering is enabled for this feed.
					 * @default true
					 */
					"langFilter": /*#__PURE__*/ v.optional(
						/*#__PURE__*/ v.boolean(),
						true
					),
					/**
					 * AT-URI of the feed generator record to register.
					 */
					"uri": /*#__PURE__*/ v.resourceUriString(),
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "feed"() {
						return feedViewSchema
					},
					"message": /*#__PURE__*/ v.string(),
				}
			),
		}
	}
);
type feedView$schematype = typeof _feedViewSchema;
type main$schematype = typeof _mainSchema;

export interface feedViewSchema extends feedView$schematype {}

export interface mainSchema extends main$schematype {}
export const feedViewSchema = _feedViewSchema as feedViewSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface FeedView extends v.InferInput<typeof feedViewSchema> {}

export interface $params {}

export interface $input extends v.InferXRPCBodyInput<mainSchema['input']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		"net.nusno.gyoka.feed.registerFeed": mainSchema;
	}
}
