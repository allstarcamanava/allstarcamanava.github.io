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
        member.folder_id
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
   * Determine Assigned Member Folder
   *
   * The user's Google access token is tested
   * against each configured member folder.
   *
   * No Google email is stored or exposed here.
   * ========================================
   */

  const assignedMembers = [];

  for (const member of activeMembers) {
    const folderResult =
      await getDriveFile(
        member.folder_id,
        accessToken
      );

    if (
      folderResult.ok &&
      folderResult.file &&
      folderResult.file.mimeType ===
        "application/vnd.google-apps.folder"
    ) {
      assignedMembers.push({
        member,
        folder: folderResult.file,
      });
    }
  }

  /*
   * The intended setup is one Google account
   * assigned to one member folder.
   */

  if (assignedMembers.length === 0) {
    return htmlResponse(
      "Drive Access Not Found",
      `
        <h1>Google Drive</h1>

        <p>
          Your Google account does not currently have access
          to a member Drive folder.
        </p>

        <p>
          Please make sure the Google account you used to sign in
          has been granted access to your assigned folder.
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

  if (assignedMembers.length > 1) {
    return htmlResponse(
      "Multiple Drive Folders Found",
      `
        <h1>Google Drive</h1>

        <p>
          Your Google account currently has access to more than
          one configured member folder.
        </p>

        <p>
          Please contact the club administrator so the member
          Drive assignments can be checked.
        </p>
      `,
      403
    );
  }

  const assignedMember =
    assignedMembers[0].member;

  const assignedRootFolder =
    assignedMembers[0].folder;

  const assignedRootFolderId =
    assignedMember.folder_id;

  const requestedFolderId =
    url.searchParams.get("folder");

  /*
   * ========================================
   * Members Drive Landing Page
   * ========================================
   */

  if (!requestedFolderId) {
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
                ${escapeHtml(assignedRootFolder.name)}
              </h2>

              <p>
                Your assigned member documents and resources.
              </p>

            </div>

          </div>

          <div class="drive-list">

            <a
              class="drive-item folder"
              href="/members/google/drive?folder=${encodeURIComponent(assignedRootFolderId)}"
            >
              <span class="icon">
                📁
              </span>

              <span class="item-name">
                ${escapeHtml(assignedRootFolder.name)}
              </span>

              <span class="arrow">
                ›
              </span>
            </a>

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
   * Verify Requested Folder
   *
   * Only folders inside this member's
   * assigned root are allowed.
   * ========================================
   */

  const allowed =
    await isFolderInsideRoot(
      requestedFolderId,
      assignedRootFolderId,
      accessToken
    );

  if (!allowed) {
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
    assignedRootFolderId;

  const parentFolder =
    isDesignatedRoot
      ? null
      : await getParentFolder(
          requestedFolderId,
          assignedRootFolderId,
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
            This folder is empty.
          </div>
        `;

  /*
   * ========================================
   * Back Navigation
   * ========================================
   */

  const backLink =
    isDesignatedRoot
      ? `
          <a
            class="back-link"
            href="/members/google/drive"
          >
            ← Members Drive
          </a>
        `
      : parentFolder
        ? `
            <a
              class="back-link"
              href="/members/google/drive?folder=${encodeURIComponent(parentFolder.id)}"
            >
              ← ${escapeHtml(parentFolder.name)}
            </a>
          `
        : `
            <a
              class="back-link"
              href="/members/google/drive"
            >
              ← Members Drive
            </a>
          `;

  /*
   * ========================================
   * Folder Page
   * ========================================
   */

  return htmlResponse(
    folder.name,
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

        ${backLink}

        <div class="folder-heading">

          <span class="folder-icon">
            📁
          </span>

          <div>

            <h2>
              ${escapeHtml(folder.name)}
            </h2>

            <p>
              ${files.length}
              item${files.length === 1 ? "" : "s"}
            </p>

          </div>

        </div>

        <div class="drive-list">
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
 * Load Member Configuration
 * ========================================
 */

async function loadMembers(
  request,
  env
) {
  try {
    if (
      !env.ASSETS ||
      typeof env.ASSETS.fetch !== "function"
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
        new Request(dataUrl.toString())
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    if (
      !data ||
      !Array.isArray(data.members)
    ) {
      return null;
    }

    return data.members;
  } catch {
    return null;
  }
}


/*
 * ========================================
 * Folder Security
 * ========================================
 */

async function isFolderInsideRoot(
  folderId,
  rootFolderId,
  accessToken
) {
  if (
    folderId === rootFolderId
  ) {
    return true;
  }

  let currentId =
    folderId;

  for (
    let i = 0;
    i < 50;
    i++
  ) {
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
      result.file.parents || [];

    if (!parents.length) {
      return false;
    }

    if (
      parents.includes(
        rootFolderId
      )
    ) {
      return true;
    }

    currentId =
      parents[0];
  }

  return false;
}


/*
 * ========================================
 * Parent Folder
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
    !result.file ||
    !result.file.parents
  ) {
    return null;
  }

  const parentId =
    result.file.parents.find(
      (id) =>
        id === rootFolderId
    ) ||
    result.file.parents[0];

  if (!parentId) {
    return null;
  }

  const parentResult =
    await getDriveFile(
      parentId,
      accessToken
    );

  if (
    !parentResult.ok
  ) {
    return null;
  }

  return parentResult.file;
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
  try {
    const driveUrl =
      new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
      );

    driveUrl.searchParams.set(
      "fields",
      "id,name,mimeType,parents,trashed,webViewLink"
    );

    const response =
      await fetch(
        driveUrl.toString(),
        {
          headers: {
            Authorization:
              `Bearer ${decodeURIComponent(accessToken)}`,
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

    const file =
      await response.json();

    if (file.trashed) {
      return {
        ok: false,
        status: 404,
        file: null,
      };
    }

    return {
      ok: true,
      status: 200,
      file,
    };
  } catch {
    return {
      ok: false,
      status: 500,
      file: null,
    };
  }
}


/*
 * ========================================
 * List Drive Folder Contents
 * ========================================
 */

async function listFolderContents(
  folderId,
  accessToken
) {
  try {
    const driveUrl =
      new URL(
        "https://www.googleapis.com/drive/v3/files"
      );

    driveUrl.searchParams.set(
      "q",
      `'${folderId}' in parents and trashed = false`
    );

    driveUrl.searchParams.set(
      "fields",
      "files(id,name,mimeType,webViewLink,parents)"
    );

    driveUrl.searchParams.set(
      "orderBy",
      "folder,name"
    );

    driveUrl.searchParams.set(
      "pageSize",
      "1000"
    );

    driveUrl.searchParams.set(
      "includeItemsFromAllDrives",
      "true"
    );

    driveUrl.searchParams.set(
      "supportsAllDrives",
      "true"
    );

    const response =
      await fetch(
        driveUrl.toString(),
        {
          headers: {
            Authorization:
              `Bearer ${decodeURIComponent(accessToken)}`,
          },
        }
      );

    if (
      response.status === 401
    ) {
      return {
        error: true,
        status: 401,
      };
    }

    if (!response.ok) {
      return {
        error: true,
        status: response.status,
      };
    }

    const data =
      await response.json();

    return {
      error: false,
      files:
        data.files || [],
    };
  } catch {
    return {
      error: true,
      status: 500,
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
    "application/vnd.google-apps.document"
  ) {
    return "📄";
  }

  if (
    mimeType ===
    "application/vnd.google-apps.spreadsheet"
  ) {
    return "📊";
  }

  if (
    mimeType ===
    "application/vnd.google-apps.presentation"
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

  return "📄";
}


/*
 * ========================================
 * Cookies
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
      ...value
    ] =
      cookie
        .trim()
        .split("=");

    if (key === name) {
      return value.join("=");
    }
  }

  return null;
}


/*
 * ========================================
 * HTML Helpers
 * ========================================
 */

function escapeHtml(
  value
) {
  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


function htmlResponse(
  title,
  content,
  status = 200
) {
  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>${escapeHtml(title)}</title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #f6fbfb;
      color: #0b2b2e;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    .drive-page {
      width: min(
        1160px,
        calc(100% - 40px)
      );

      margin: 48px auto;
    }

    .drive-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 24px;
    }

    .eyebrow {
      margin: 0 0 4px;
      color: #049393;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: 34px;
    }

    h2 {
      margin: 0;
      font-size: 22px;
    }

    .members-link,
    .back-link {
      color: #049393;
      text-decoration: none;
      font-weight: 600;
    }

    .members-link:hover,
    .back-link:hover {
      text-decoration: underline;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 20px;
    }

    .folder-heading {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px;
      margin-bottom: 16px;
      background: white;
      border: 1px solid #cfeaea;
      border-radius: 14px;
    }

    .folder-icon {
      font-size: 30px;
    }

    .folder-heading p {
      margin: 4px 0 0;
      color: #607577;
      font-size: 14px;
    }

    .drive-list {
      overflow: hidden;
      background: white;
      border: 1px solid #cfeaea;
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
      border-bottom: 1px solid #eaf6f6;
    }

    .drive-item:last-child {
      border-bottom: 0;
    }

    .drive-item:hover {
      background: #f6fbfb;
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
      color: #049393;
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
      background: #049393;
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