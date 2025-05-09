// zod validator for AT Protocol formats
import { z } from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';

extendZodWithOpenApi(z);

//AT URI
//see https://atproto.com/specs/at-uri-scheme
type BskyCollection = 'app.bsky.feed.generator' | 'app.bsky.feed.post' | 'app.bsky.feed.repost';
const defineZodBskyUriSchema = (collection: BskyCollection) => {
  const regex = new RegExp(
    `^at://did:([a-z0-9]+):(([A-Za-z0-9._%-]+:)*[A-Za-z0-9._%-]+)/${collection}/(?!\\.{1,2}(?:$|/))[A-Za-z0-9._~:-]{1,512}$`
  );
  return z
    .string() //use refine to hide regex pattern from generated docs.
    .refine((val) => regex.test(val), {
      message: `Invalid AT Protocol URI format. Expected format: at://{DID}/${collection}/{record-key}`,
    })
    .openapi({
      format: `at-uri`,
      example: `at://did:plc:1234abcd/${collection}/record123`,
    });
};

export const feedUri = defineZodBskyUriSchema('app.bsky.feed.generator');
export const postUri = defineZodBskyUriSchema('app.bsky.feed.post');
export const repostUri = defineZodBskyUriSchema('app.bsky.feed.repost');

// DID
//see https://www.w3.org/TR/did-1.0/#did-syntax
// Todo:support handle authority
export const did = z
  .string()
  .refine((val) => /^did:([a-z0-9]+):(([A-Za-z0-9._%-]+:)*[A-Za-z0-9._%-]+)$/.test(val), {
    message: 'Invalid DID format. Expected format: did:{method}:{identifier}',
  })
  .openapi({
    format: 'did',
    example: 'did:plc:user.example.com',
  });

//CIDv1
//see https://github.com/multiformats/cid
export const cid = z
  .string()
  .min(8)
  .max(128)
  .refine((val) => /^[a-zA-Z0-9+=]{8,256}$/.test(val), {
    message: 'Invalid CIDv1 format.',
  })
  .openapi({
    format: 'cid',
    example: 'sampleiaajksfnn3if2crogjkz5c4bmb2lh2ufspcdf6hfc7mtg6e2bysva',
  });
