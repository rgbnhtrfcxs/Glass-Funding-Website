import type { Context, Config } from "@netlify/edge-functions";

export const config: Config = {
  path: "/*",
};

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Protected"' },
  });
}

export default async (request: Request, context: Context) => {
  const USERNAME = Netlify.env.get("BASIC_USERNAME");
  const PASSWORD = Netlify.env.get("BASIC_PASSWORD");

  // If env vars aren't set, don't block (lets you enable only on certain deploy contexts)
  if (!USERNAME || !PASSWORD) return context.next();

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();

  try {
    const encoded = auth.slice("Basic ".length);
    const decoded = atob(encoded); // "user:pass"
    const i = decoded.indexOf(":");
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);

    if (user !== USERNAME || pass !== PASSWORD) return unauthorized();
  } catch {
    return unauthorized();
  }

  return context.next();
};
