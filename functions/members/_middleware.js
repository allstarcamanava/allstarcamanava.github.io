export async function onRequest(context) {
  const auth = context.request.headers.get("Authorization");

  // Ask for credentials if none were supplied
  if (!auth || !auth.startsWith("Basic ")) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Members Area"',
      },
    });
  }

  // Decode username and password
  let decoded;

  try {
    decoded = atob(auth.slice(6));
  } catch {
    return new Response("Unauthorized.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Members Area"',
      },
    });
  }

  const separator = decoded.indexOf(":");

  if (separator === -1) {
    return new Response("Unauthorized.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Members Area"',
      },
    });
  }

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  // Compare against Cloudflare secrets
  if (
    username !== context.env.MEMBER_USERNAME ||
    password !== context.env.MEMBER_PASSWORD
  ) {
    return new Response("Incorrect username or password.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Members Area"',
      },
    });
  }

  // Correct credentials — allow the normal page to load
  return context.next();
}
