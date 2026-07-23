import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query("net.nusno.gyoka.ping", {
  params: null,
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      message: /*#__PURE__*/ v.string(),
    }),
  },
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "net.nusno.gyoka.ping": mainSchema;
  }
}
