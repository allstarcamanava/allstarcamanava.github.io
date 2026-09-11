export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Only protect the Members area
  if (!url.pathname.startsWith("/members")) {
    return context.next();
  }

  const auth = context.request.headers.get("Authorization");

  if (!auth || !auth.startsWith("Basic ")) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Members Area"',
      },
    });
  }

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

  return context.next();
}
