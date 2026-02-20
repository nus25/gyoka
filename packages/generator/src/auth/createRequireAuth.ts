import { type Nsid } from '@atcute/lexicons';
import { normalizeWebDid } from '@atcute/identity';
import { AuthRequiredError } from '@atcute/xrpc-server';
import { ServiceJwtVerifier, type VerifiedJwt } from '@atcute/xrpc-server/auth';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';

import { createDidResolverFetch } from './didResolverCache';
import { createLogger } from 'shared/src/logger';

const logger = createLogger({ service: 'generator' });

export function createRequireAuth(env: Env, ctx: ExecutionContext) {
  const serviceDid = normalizeWebDid(`did:web:${env.FEEDGEN_HOST}`);
  const didResolverFetch = createDidResolverFetch(env, ctx, logger);
  const didDocResolver = new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver({
        fetch: didResolverFetch,
      }),
      web: new WebDidDocumentResolver({
        fetch: didResolverFetch,
      }),
    },
  });

  const jwtVerifier = new ServiceJwtVerifier({
    serviceDid,
    resolver: didDocResolver,
  });

  return async (request: Request, lxm: Nsid): Promise<VerifiedJwt | null> => {
    if (env.FEEDGEN_AUTH_REQUIRED !== 'enabled') {
      return null;
    }

    const auth = request.headers.get('authorization');
    if (auth === null) {
      throw new AuthRequiredError({ description: 'missing authorization header' });
    }
    if (!auth.startsWith('Bearer ')) {
      throw new AuthRequiredError({ description: 'invalid authorization scheme' });
    }

    const jwtString = auth.slice('Bearer '.length).trim();

    const result = await jwtVerifier.verify(jwtString, { lxm });
    if (!result.ok) {
      if ('error' in result) {
        throw new AuthRequiredError(result.error);
      }
      throw new AuthRequiredError({ description: 'invalid authorization token' });
    }

    return result.value;
  };
}
