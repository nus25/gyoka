import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.procedure(
  "net.nusno.gyoka.feed.unregisterFeed",
  {
    params: null,
    input: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        uri: /*#__PURE__*/ v.resourceUriString(),
      }),
    },
    output: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
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
    "net.nusno.gyoka.feed.unregisterFeed": mainSchema;
  }
}
