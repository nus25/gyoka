import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.procedure(
  "net.nusno.gyoka.document.updateDocument",
  {
    params: null,
    input: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        content: /*#__PURE__*/ v.optional(
          /*#__PURE__*/ v.nullable(
            /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
              /*#__PURE__*/ v.stringLength(0, 32768),
            ]),
          ),
        ),
        type: /*#__PURE__*/ v.string<
          "privacy_policy" | "tos" | (string & {})
        >(),
        url: /*#__PURE__*/ v.optional(
          /*#__PURE__*/ v.nullable(
            /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.genericUriString(), [
              /*#__PURE__*/ v.stringLength(0, 2048),
            ]),
          ),
        ),
      }),
    },
    output: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        content: /*#__PURE__*/ v.nullable(
          /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
            /*#__PURE__*/ v.stringLength(0, 32768),
          ]),
        ),
        type: /*#__PURE__*/ v.string<
          "privacy_policy" | "tos" | (string & {})
        >(),
        url: /*#__PURE__*/ v.nullable(
          /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.genericUriString(), [
            /*#__PURE__*/ v.stringLength(0, 2048),
          ]),
        ),
      }),
    },
  },
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

declare module "@atcute/lexicons/ambient" {
  interface XRPCProcedures {
    "net.nusno.gyoka.document.updateDocument": mainSchema;
  }
}
