import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

let keys: JWTVerifyGetKey | undefined;

/** Tests swap in a local key set. */
export const setKeys = (k: JWTVerifyGetKey) => (keys = k);

export type Profile = { userId: string; name: string; avatar: string | null };

/** Checks a Supabase access token against the project's published signing keys. Name and photo come from the social login (F1). */
export async function verifyToken(token: string): Promise<Profile> {
  const url = process.env.SUPABASE_URL;
  keys ??= createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, keys, { issuer: `${url}/auth/v1`, audience: "authenticated" });
  if (!payload.sub) throw new Error("token has no user");
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === "string" && x ? x : null);
  return {
    userId: payload.sub,
    name: text(meta.full_name) ?? text(meta.name) ?? "",
    avatar: text(meta.avatar_url) ?? text(meta.picture),
  };
}
