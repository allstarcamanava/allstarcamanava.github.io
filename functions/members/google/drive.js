export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const accessToken = getCookie(
    request,
    "google_access_token"
  );

  if (!accessToken) {
    return htmlResponse(
      "Google Drive Not Connected",
      `
        <h1>Google Drive</h1>

        <p>
          Your Google Drive connection has expired or has not been connected yet.
        </p>

        <p>
          <a class="button" href="/members/google/login">
            Connect Google Drive
          </a>
        </p>
      `,
      401
    );
  }

  /*
   * ========================================
   * Load Member Configuration
   * ========================================
   */

  const members = await loadMembers(
    request,
    env
  );

  if (!members) {
    return htmlResponse(
      "Configuration Error",
      `
        <h1>Configuration Error</h1>

        <p>
          The member access configuration could not be loaded.
        </p>
      `,
      500
    );
  }

  const activeMembers =
    members.filter(
      (member) =>
        member &&
        member.active !== false &&
        member.id &&
        Array.isArray(member.folders) &&
        member.folders.some(
          (folder) =>
            folder &&
            folder.id
        )
    );

  if (!activeMembers.length) {
    return htmlResponse(
      "No Member Access Configured",
      `
        <h1>Google Drive</h1>

        <p>
          No active member Drive folders have been configured yet.
        </p>
      `,
      500
    );
  }

  /*
   * ========================================
   * Identify Member From Google Account
   *
   * The authenticated Google email is stored
   * inside the signed member_session created
   * by callback.js.
   *
   * GOOGLE_MEMBER_MAP privately maps:
   *
   *   Google email → Member ID
   *
   * Folder IDs are authorization assignments,
   * not member identities.
   *
   * Therefore, the same Drive folder may
   * legitimately be assigned to multiple members.
   * ========================================
   */

  const memberSession =
    getCookie(
      request,
      "member_session"
    );

  const session =
    await verifyMemberSession(
      memberSession,
      env
    );

  if (!session || !session.google_email) {
    return htmlResponse(
      "Member Session Invalid",
      `
        <h1>Member Session Invalid</h1>

        <p>
          Your member session could not be verified.
        </p>

        <p>
          <a
            class="button"
            href="/members/google/login"
          >
            Sign in with Google
          </a>
        </p>
      `,
      401
    );
  }

  const googleEmail =
    session.google_email
      .trim()
      .toLowerCase();

  const memberMap =
    parseGoogleMemberMap(
      env.GOOGLE_MEMBER_MAP
    );

  const memberId =
    memberMap[googleEmail];

  if (!memberId) {
    return htmlResponse(
      "Member Assignment Not Found",
      `
        <h1>Member Assignment Not Found</h1>

        <p>
          Your Google account is authorized, but it has
          not been assigned to a member profile yet.
        </p>

        <p>
          Please contact the club administrator.
        </p>

        <p>
          <a href="/members/">
            Back to Members Area
          </a>
        </p>
      `,
      403
    );
  }

  const assignedMember =
    activeMembers.find(
      (member) =>
        String(member.id) ===
        String(memberId)
    );

  if (!assignedMember) {
    return htmlResponse(
      "Member Configuration Not Found",
      `
        <h1>Member Configuration Not Found</h1>

        <p>
          Your member account could not be matched
          to an active member configuration.
        </p>

        <p>
          Please contact the club administrator.
        </p>

        <p>
          <a href="/members/">
            Back to Members Area
          </a>
        </p>
      `,
      403
    );
  }

  /*
   * ========================================
   * Verify Drive Access
   *
   * Only folders assigned to this specific
   * member are considered.
   *
   * A shared folder may appear under multiple
   * members without creating a conflict.
   * ========================================
   */

  const assignedFolders = [];

  for (
    const configuredFolder of assignedMember.folders
  ) {
    if (
      !configuredFolder ||
      !configuredFolder.id
    ) {
      continue;
    }

    const folderResult =
      await getDriveFile(
        configuredFolder.id,
        accessToken
      );

    if (
      folderResult.ok &&
      folderResult.file &&
      folderResult.file.mimeType ===
        "application/vnd.google-apps.folder"
    ) {
      assignedFolders.push({
        configured: configuredFolder,
        folder: folderResult.file,
      });
    }
  }

  if (!assignedFolders.length) {
    return htmlResponse(
      "Drive Access Not Found",
      `
        <h1>Drive Access Not Found</h1>

        <p>
          Your Google account does not currently have
          access to any of your assigned member folders.
        </p>

        <p>
          Please make sure your Google account has been
          granted access to your assigned folders.
        </p>

        <p>
          <a href="/members/">
            Back to Members Area
          </a>
        </p>
      `,
      403
    );
  }

  const assignedRootFolderIds =
    assignedFolders.map(
      (item) => item.configured.id
    );

  const requestedFolderId =
    url.searchParams.get("folder");

  /*
   * ========================================
   * Members Drive Landing Page
   * ========================================
   */

  if (!requestedFolderId) {
    const folderRows =
      assignedFolders
        .map(
          (item) => `
            <a
              class="drive-item folder"
              href="/members/google/drive?folder=${encodeURIComponent(item.configured.id)}"
            >
              <span class="icon">
                📁
              </span>

              <span class="item-name">
                ${escapeHtml(
                  item.configured.name ||
                  item.folder.name
                )}
              </span>

              <span class="arrow">
                ›
              </span>
            </a>
          `
        )
        .join("");

    return htmlResponse(
      "Google Drive",
      `
        <div class="drive-page">

          <div class="drive-header">

            <div>
              <p class="eyebrow">
                Members Area
              </p>

              <h1>
                Google Drive
              </h1>
            </div>

            <a
              class="members-link"
              href="/members/"
            >
              Members Area
            </a>

          </div>

          <p class="drive-welcome">
            Welcome, ${escapeHtml(
              assignedMember.first_name || "Member"
            )}.
          </p>

          <a
            class="back-link"
            href="/members/"
          >
            ← Members Area
          </a>

          <div class="folder-heading">

            <span class="folder-icon">
              📁
            </span>

            <div>

              <h2>
                Your Member Folders
              </h2>

              <p>
                Access your assigned member documents and resources.
              </p>

            </div>

          </div>

          <div class="drive-list">

            ${folderRows}

          </div>

          <p class="drive-note">
            Files open in Google Drive using your authorized Google account.
          </p>

        </div>
      `
    );
  }

  /*
   * ========================================
   * Determine Which Assigned Root Contains
   * The Requested Folder
   * ========================================
   */

  let matchedRootFolderId = null;

  for (
    const rootFolderId of assignedRootFolderIds
  ) {
    const allowed =
      await isFolderInsideRoot(
        requestedFolderId,
        rootFolderId,
        accessToken
      );

    if (allowed) {
      matchedRootFolderId =
        rootFolderId;

      break;
    }
  }

  if (!matchedRootFolderId) {
    return htmlResponse(
      "Folder Not Available",
      `
        <h1>Folder Not Available</h1>

        <p>
          This folder is not part of your assigned
          members' Google Drive area.
        </p>

        <p>
          <a href="/members/google/drive">
            Back to Members Drive
          </a>
        </p>
      `,
      403
    );
  }

  /*
   * ========================================
   * Get Current Folder
   * ========================================
   */

  const folderResult =
    await getDriveFile(
      requestedFolderId,
      accessToken
    );

  if (
    !folderResult.ok ||
    !folderResult.file ||
    folderResult.file.mimeType !==
      "application/vnd.google-apps.folder"
  ) {
    if (
      folderResult.status === 401
    ) {
      return htmlResponse(
        "Google Drive Connection Expired",
        `
          <h1>Google Drive Connection Expired</h1>

          <p>
            Your Google Drive connection has expired.
          </p>

          <p>
            <a
              class="button"
              href="/members/google/login"
            >
              Reconnect Google Drive
            </a>
          </p>
        `,
        401
      );
    }

    return htmlResponse(
      "Folder Not Found",
      `
        <h1>Folder Not Found</h1>

        <p>
          The requested folder could not be found
          or is no longer available.
        </p>

        <p>
          <a href="/members/google/drive">
            Back to Members Drive
          </a>
        </p>
      `,
      404
    );
  }

  const folder =
    folderResult.file;

  /*
   * ========================================
   * List Folder Contents
   * ========================================
   */

  const filesResult =
    await listFolderContents(
      requestedFolderId,
      accessToken
    );

  if (filesResult.error) {
    if (
      filesResult.status === 401
    ) {
      return htmlResponse(
        "Google Drive Connection Expired",
        `
          <h1>Google Drive Connection Expired</h1>

          <p>
            Your Google Drive connection has expired.
          </p>

          <p>
            <a
              class="button"
              href="/members/google/login"
            >
              Reconnect Google Drive
            </a>
          </p>
        `,
        401
      );
    }

    return htmlResponse(
      "Google Drive Error",
      `
        <h1>Google Drive Error</h1>

        <p>
          Google Drive could not be accessed right now.
        </p>

        <p>
          <a href="/members/google/drive">
            Try Again
          </a>
        </p>
      `,
      502
    );
  }

  const files =
    filesResult.files || [];

  /*
   * ========================================
   * Sort Folders Before Files
   * ========================================
   */

  files.sort(
    (a, b) => {
      const aFolder =
        a.mimeType ===
        "application/vnd.google-apps.folder";

      const bFolder =
        b.mimeType ===
        "application/vnd.google-apps.folder";

      if (aFolder !== bFolder) {
        return aFolder ? -1 : 1;
      }

      return a.name.localeCompare(
        b.name,
        undefined,
        {
          sensitivity: "base",
        }
      );
    }
  );

  /*
   * ========================================
   * Determine Parent
   * ========================================
   */

  const isDesignatedRoot =
    requestedFolderId ===
    matchedRootFolderId;

  const parentFolder =
    isDesignatedRoot
      ? null
      : await getParentFolder(
          requestedFolderId,
          matchedRootFolderId,
          accessToken
        );

  /*
   * ========================================
   * Build File / Folder Rows
   * ========================================
   */

  const fileRows =
    files.length
      ? files
          .map(
            (file) => {
              const isFolder =
                file.mimeType ===
                "application/vnd.google-apps.folder";

              if (isFolder) {
                return `
                  <a
                    class="drive-item folder"
                    href="/members/google/drive?folder=${encodeURIComponent(file.id)}"
                  >
                    <span class="icon">
                      📁
                    </span>

                    <span class="item-name">
                      ${escapeHtml(file.name)}
                    </span>

                    <span class="arrow">
                      ›
                    </span>
                  </a>
                `;
              }

              return `
                <a
                  class="drive-item file"
                  href="${escapeHtml(file.webViewLink || "#")}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="icon">
                    ${getFileIcon(file.mimeType)}
                  </span>

                  <span class="item-name">
                    ${escapeHtml(file.name)}
                  </span>

                  <span class="external">
                    ↗
                  </span>
                </a>
              `;
            }
          )
          .join("")
      : `
          <div class="empty">
            This folder is currently empty.
          </div>
        `;

  /*
   * ========================================
   * Render Folder
   * ========================================
   */

  return htmlResponse(
    "Google Drive",
    `
      <div class="drive-page">

        <div class="drive-header">

          <div>
            <p class="eyebrow">
              Members Area
            </p>

            <h1>
              Google Drive
            </h1>
          </div>

          <a
            class="members-link"
            href="/members/"
          >
            Members Area
          </a>

        </div>

        <p class="drive-welcome">
          Welcome, ${escapeHtml(
            assignedMember.first_name || "Member"
          )}.
        </p>

        <a
          class="back-link"
          href="/members/google/drive"
        >
          ← My Member Folders
        </a>

        <div class="folder-heading">

          <span class="folder-icon">
            📁
          </span>

          <div>

            <h2>
              ${escapeHtml(folder.name)}
            </h2>

            <p>
              Member documents and resources.
            </p>

          </div>

        </div>

        <div class="drive-list">

          ${
            parentFolder
              ? `
                <a
                  class="drive-item folder"
                  href="/members/google/drive?folder=${encodeURIComponent(parentFolder.id)}"
                >
                  <span class="icon">
                    ↩️
                  </span>

                  <span class="item-name">
                    Back to parent folder
                  </span>

                  <span class="arrow">
                    ›
                  </span>
                </a>
              `
              : ""
          }

          ${fileRows}

        </div>

        <p class="drive-note">
          Files open in Google Drive using your authorized Google account.
        </p>

      </div>
    `
  );
}

/*
 * ========================================
 * Load Members
 * ========================================
 */

async function loadMembers(
  request,
  env
) {
  if (
    !env.ASSETS ||
    typeof env.ASSETS.fetch !==
      "function"
  ) {
    return null;
  }

  const dataUrl =
    new URL(
      "/members-data.json",
      request.url
    );

  const response =
    await env.ASSETS.fetch(
      new Request(
        dataUrl.toString()
      )
    );

  if (!response.ok) {
    return null;
  }

  try {
    const data =
      await response.json();

    return Array.isArray(
      data.members
    )
      ? data.members
      : null;
  } catch {
    return null;
  }
}

/*
 * ========================================
 * Get Drive File
 * ========================================
 */

async function getDriveFile(
  fileId,
  accessToken
) {
  const fields =
    [
      "id",
      "name",
      "mimeType",
      "webViewLink",
      "parents",
    ].join(",");

  const response =
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      file: null,
    };
  }

  try {
    const file =
      await response.json();

    return {
      ok: true,
      status: response.status,
      file,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      file: null,
    };
  }
}

/*
 * ========================================
 * Check Folder Access
 *
 * A folder is allowed when it is the
 * configured root itself OR a descendant
 * of that root.
 * ========================================
 */

async function isFolderInsideRoot(
  folderId,
  rootFolderId,
  accessToken
) {
  if (
    folderId ===
    rootFolderId
  ) {
    return true;
  }

  let currentId =
    folderId;

  const visited =
    new Set();

  for (
    let depth = 0;
    depth < 50;
    depth++
  ) {
    if (
      visited.has(currentId)
    ) {
      return false;
    }

    visited.add(currentId);

    const result =
      await getDriveFile(
        currentId,
        accessToken
      );

    if (
      !result.ok ||
      !result.file
    ) {
      return false;
    }

    const parents =
      Array.isArray(
        result.file.parents
      )
        ? result.file.parents
        : [];

    if (
      parents.includes(
        rootFolderId
      )
    ) {
      return true;
    }

    if (!parents.length) {
      return false;
    }

    currentId =
      parents[0];

    if (
      currentId ===
      rootFolderId
    ) {
      return true;
    }
  }

  return false;
}

/*
 * ========================================
 * Get Parent Folder
 * ========================================
 */

async function getParentFolder(
  folderId,
  rootFolderId,
  accessToken
) {
  const result =
    await getDriveFile(
      folderId,
      accessToken
    );

  if (
    !result.ok ||
    !result.file
  ) {
    return null;
  }

  const parents =
    Array.isArray(
      result.file.parents
    )
      ? result.file.parents
      : [];

  for (
    const parentId of parents
  ) {
    if (
      parentId ===
      rootFolderId
    ) {
      const parentResult =
        await getDriveFile(
          parentId,
          accessToken
        );

      return parentResult.ok
        ? parentResult.file
        : null;
    }

    const inside =
      await isFolderInsideRoot(
        parentId,
        rootFolderId,
        accessToken
      );

    if (inside) {
      const parentResult =
        await getDriveFile(
          parentId,
          accessToken
        );

      return parentResult.ok
        ? parentResult.file
        : null;
    }
  }

  return null;
}

/*
 * ========================================
 * List Folder Contents
 * ========================================
 */

async function listFolderContents(
  folderId,
  accessToken
) {
  const query =
    `'${folderId}' in parents and trashed = false`;

  const params =
    new URLSearchParams({
      q: query,
      fields:
        "files(id,name,mimeType,webViewLink,modifiedTime,size,parents)",
      orderBy:
        "folder,name",
      pageSize:
        "1000",
      includeItemsFromAllDrives:
        "true",
      supportsAllDrives:
        "true",
    });

  const response =
    await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

  if (!response.ok) {
    return {
      error: true,
      status: response.status,
      files: [],
    };
  }

  try {
    const data =
      await response.json();

    return {
      error: false,
      status: response.status,
      files:
        Array.isArray(
          data.files
        )
          ? data.files
          : [],
    };
  } catch {
    return {
      error: true,
      status: 502,
      files: [],
    };
  }
}

/*
 * ========================================
 * File Icons
 * ========================================
 */

function getFileIcon(
  mimeType
) {
  if (
    mimeType ===
    "application/pdf"
  ) {
    return "📕";
  }

  if (
    mimeType ===
      "application/vnd.google-apps.document" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "📄";
  }

  if (
    mimeType ===
      "application/vnd.google-apps.spreadsheet" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "📊";
  }

  if (
    mimeType ===
      "application/vnd.google-apps.presentation" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "📽️";
  }

  if (
    mimeType.startsWith(
      "image/"
    )
  ) {
    return "🖼️";
  }

  if (
    mimeType.startsWith(
      "video/"
    )
  ) {
    return "🎬";
  }

  if (
    mimeType.startsWith(
      "audio/"
    )
  ) {
    return "🎵";
  }

  if (
    mimeType ===
    "application/zip"
  ) {
    return "🗜️";
  }

  return "📄";
}

/*
 * ========================================
 * Cookie Helper
 * ========================================
 */

function getCookie(
  request,
  name
) {
  const cookieHeader =
    request.headers.get(
      "Cookie"
    );

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader.split(";");

  for (
    const cookie of cookies
  ) {
    const [
      key,
      ...valueParts
    ] =
      cookie.trim().split("=");

    if (
      key === name
    ) {
      return decodeURIComponent(
        valueParts.join("=")
      );
    }
  }

  return null;
}

/*
 * ========================================
 * Verify Member Session
 *
 * The session is created and signed by
 * members/google/callback.js.
 * ========================================
 */

async function verifyMemberSession(
  sessionCookie,
  env
) {
  if (
    !sessionCookie ||
    !env.MEMBER_PASSWORD
  ) {
    return null;
  }

  const parts =
    sessionCookie.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [
    payload,
    signature,
  ] = parts;

  const valid =
    await verifySignature(
      payload,
      signature,
      env.MEMBER_PASSWORD
    );

  if (!valid) {
    return null;
  }

  try {
    const decoded =
      new TextDecoder().decode(
        base64UrlDecode(
          payload
        )
      );

    const session =
      JSON.parse(decoded);

    if (
      !session ||
      !session.exp ||
      Date.now() >=
        Number(session.exp)
    ) {
      return null;
    }

    if (
      session.username !==
      env.MEMBER_USERNAME
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/*
 * ========================================
 * Parse Private Google Member Map
 *
 * Format:
 *
 * email@example.com=member-id
 *
 * Multiple entries may be separated
 * by commas.
 * ========================================
 */

function parseGoogleMemberMap(
  value
) {
  const map = {};

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return map;
  }

  for (
    const line of value.split(",")
  ) {
    const separator =
      line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const email =
      line
        .slice(
          0,
          separator
        )
        .trim()
        .toLowerCase();

    const memberId =
      line
        .slice(
          separator + 1
        )
        .trim();

    if (
      email &&
      memberId
    ) {
      map[email] =
        memberId;
    }
  }

  return map;
}

/*
 * ========================================
 * Verify HMAC Signature
 * ========================================
 */

async function verifySignature(
  value,
  signature,
  secret
) {
  if (
    !value ||
    !signature ||
    !secret
  ) {
    return false;
  }

  try {
    const key =
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(
          secret
        ),
        {
          name: "HMAC",
          hash: "SHA-256",
        },
        false,
        [
          "verify",
        ]
      );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(
        signature
      ),
      new TextEncoder().encode(
        value
      )
    );
  } catch {
    return false;
  }
}

/*
 * ========================================
 * Base64 URL Decode
 * ========================================
 */

function base64UrlDecode(
  value
) {
  const padded =
    value
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      )
      .padEnd(
        value.length +
          (
            (
              4 -
              (
                value.length %
                4
              )
            ) %
            4
          ),
        "="
      );

  const binary =
    atob(padded);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}

/*
 * ========================================
 * HTML Response
 * ========================================
 */

function htmlResponse(
  title,
  content,
  status = 200
) {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${escapeHtml(title)}
  </title>

  <style>

    :root {
      --tiffany: #00cccc;
      --dark: #049393;
      --ink: #0b2b2e;
      --paper: #f6fbfb;
      --paper-alt: #eaf6f6;
      --line: #cfeaea;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    a {
      color: inherit;
    }

    .drive-page {
      width: min(
        100% - 32px,
        1160px
      );

      margin: 40px auto;
    }

    .drive-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 24px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: var(--dark);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: 36px;
      line-height: 1.1;
    }

    .members-link {
      padding: 10px 15px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: white;
      color: var(--dark);
      text-decoration: none;
      font-weight: 600;
    }

    .members-link:hover {
      background: var(--paper-alt);
    }

    .drive-welcome {
      margin: -8px 0 20px;
      color: #607577;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      color: var(--dark);
      text-decoration: none;
      font-weight: 600;
    }

    .folder-heading {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;
    }

    .folder-icon {
      font-size: 36px;
    }

    .folder-heading h2 {
      margin: 0 0 4px;
      font-size: 24px;
    }

    .folder-heading p {
      margin: 0;
      color: #607577;
    }

    .drive-list {
      overflow: hidden;
      background: white;
      border: 1px solid var(--line);
      border-radius: 14px;
    }

    .drive-item {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 64px;
      padding: 12px 18px;
      color: inherit;
      text-decoration: none;
      border-bottom: 1px solid var(--paper-alt);
    }

    .drive-item:last-child {
      border-bottom: 0;
    }

    .drive-item:hover {
      background: var(--paper);
    }

    .icon {
      width: 28px;
      flex: 0 0 28px;
      text-align: center;
      font-size: 22px;
    }

    .item-name {
      flex: 1;
      overflow-wrap: anywhere;
    }

    .arrow,
    .external {
      color: var(--dark);
      font-size: 22px;
    }

    .empty {
      padding: 40px 20px;
      text-align: center;
      color: #607577;
    }

    .drive-note {
      margin-top: 16px;
      color: #607577;
      font-size: 13px;
    }

    .button {
      display: inline-block;
      padding: 11px 18px;
      background: var(--dark);
      color: white;
      border-radius: 9px;
      text-decoration: none;
      font-weight: 600;
    }

    @media (max-width: 600px) {

      .drive-page {
        width: min(
          100% - 24px,
          1160px
        );

        margin: 24px auto;
      }

      .drive-header {
        align-items: flex-start;
        flex-direction: column;
      }

      h1 {
        font-size: 28px;
      }

    }

  </style>

</head>

<body>

  ${content}

</body>

</html>`,
    {
      status,
      headers: {
        "Content-Type":
          "text/html; charset=UTF-8",

        "Cache-Control":
          "private, no-store",
      },
    }
  );
}

/*
 * ========================================
 * HTML Escape
 * ========================================
 */

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}