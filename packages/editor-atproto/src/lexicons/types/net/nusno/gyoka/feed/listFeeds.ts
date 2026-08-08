import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _feedViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.nusno.gyoka.feed.listFeeds#feedView")),
		/**
		 * Whether the feed is currently active.
		 */
		"isActive": /*#__PURE__*/ v.boolean(),
		/**
		 * Whether language filtering is enabled for the feed.
		 */
		"langFilter": /*#__PURE__*/ v.boolean(),
		/**
		 * AT-URI of the feed generator record.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _mainSchema = /*#__PURE__*/ v.query(
	"net.nusno.gyoka.feed.listFeeds",
	{
		"params": null,
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "feeds"() {
						return /*#__PURE__*/ v.array(feedViewSchema)
					},
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

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"net.nusno.gyoka.feed.listFeeds": mainSchema;
	}
}
