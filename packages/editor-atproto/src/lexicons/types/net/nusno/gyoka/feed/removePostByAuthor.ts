import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.procedure(
  "net.nusno.gyoka.feed.removePostByAuthor",
  {
    params: null,
    input: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        author: /*#__PURE__*/ v.didString(),
        feed: /*#__PURE__*/ v.resourceUriString(),
      }),
    },
    output: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        author: /*#__PURE__*/ v.didString(),
        deletedCount: /*#__PURE__*/ v.integer(),
        feed: /*#__PURE__*/ v.resourceUriString(),
        message: /*#__PURE__*/ v.string(),
      }),
    },
  },
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

declare module "@atcute/lexicons/ambient" {
  interface XRPCProcedures {
    "net.nusno.gyoka.feed.removePostByAuthor": mainSchema;
  }
}
