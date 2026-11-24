import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

let keys: JWTVerifyGetKey | undefined;

/** Tests swap in a local key set. */
export const setKeys = (k: JWTVerifyGetKey) => (keys = k);

/** Checks a Supabase access token against the project's published signing keys. Returns the user id. */
export async function verifyToken(token: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  keys ??= createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, keys, { issuer: `${url}/auth/v1`, audience: "authenticated" });
  if (!payload.sub) throw new Error("token has no user");
  return payload.sub;
}
