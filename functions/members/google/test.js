export async function onRequest(context) {
  const { request, env } = context;

  const accessToken = getCookie(request, "google_access_token");

  if (!accessToken) {
    return new Response("No Google access token found.", {
      status: 401,
    });
  }

  const folderId = env.MEMBER_DRIVE_FOLDER_ID;

  if (!folderId) {
    return new Response("MEMBER_DRIVE_FOLDER_ID is not configured.", {
      status: 500,
    });
  }

  const driveUrl = new URL(
    "https://www.googleapis.com/drive/v3/files"
  );

  driveUrl.searchParams.set(
    "q",
    `'${folderId}' in parents and trashed = false`
  );

  driveUrl.searchParams.set(
    "fields",
    "files(id,name,mimeType,webViewLink)"
  );

  driveUrl.searchParams.set("pageSize", "100");

  const response = await fetch(driveUrl.toString(), {
    headers: {
      Authorization: `Bearer ${decodeURIComponent(accessToken)}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    return new Response(
      `<h1>Google Drive API Error</h1>
       <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`,
      {
        status: response.status,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
        },
      }
    );
  }

  const files = data.files || [];

  const rows = files
    .map(
      (file) => `
        <tr>
          <td>${escapeHtml(file.name)}</td>
          <td>${escapeHtml(file.mimeType)}</td>
          <td>
            ${
              file.webViewLink
                ? `<a href="${escapeHtml(file.webViewLink)}" target="_blank">Open</a>`
                : ""
            }
          </td>
        </tr>
      `
    )
    .join("");

  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Google Drive Test</title>
      </head>
      <body>
        <h1>Google Drive Test</h1>
        <p>Files visible to the currently authenticated Google account:</p>

        ${
          files.length
            ? `<table border="1" cellpadding="8">
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Link</th>
                </tr>
                ${rows}
              </table>`
            : "<p>No files found in the shared folder.</p>"
        }
      </body>
    </html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
    }
  );
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");

    if (key === name) {
      return value.join("=");
    }
  }

  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}