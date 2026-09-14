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
        <p>Your Google Drive connection has expired or has not been connected yet.</p>
        <p>
          <a class="button" href="/members/google/login">
            Connect Google Drive
          </a>
        </p>
      `,
      401
    );
  }

  const rootFolderId =
    env.MEMBER_DRIVE_FOLDER_ID;

  const secondFolderId =
    env.MEMBER_DRIVE_FOLDER_ID_2;

  if (!rootFolderId) {
    return htmlResponse(
      "Configuration Error",
      "<h1>Configuration Error</h1><p>The members Drive folder has not been configured.</p>",
      500
    );
  }

  const requestedFolderId =
    url.searchParams.get("folder");

  /*
   * ========================================
   * Members Drive Landing Page
   * ========================================
   *
   * When no folder is selected, show both
   * designated folders as top-level choices.
   */

  if (!requestedFolderId) {
    const folders = [];

    const rootFolder = await getDriveFile(
      rootFolderId,
      accessToken
    );

    if (
      rootFolder &&
      rootFolder.mimeType ===
        "application/vnd.google-apps.folder"
    ) {
      folders.push(rootFolder);
    }

    if (secondFolderId) {
      const secondFolder = await getDriveFile(
        secondFolderId,
        accessToken
      );

      if (
        secondFolder &&
        secondFolder.mimeType ===
          "application/vnd.google-apps.folder"
      ) {
        folders.push(secondFolder);
      }
    }

    const folderRows = folders.length
      ? folders.map((folder) => `
          <a
            class="drive-item folder"
            href="/members/google/drive?folder=${encodeURIComponent(folder.id)}"
          >
            <span class="icon">📁</span>
            <span class="item-name">${escapeHtml(folder.name)}</span>
            <span class="arrow">›</span>
          </a>
        `).join("")
      : `
          <div class="empty">
            No Google Drive folders are available.
          </div>
        `;

    return htmlResponse(
      "Google Drive",
      `
        <div class="drive-page">

          <div class="drive-header">
            <div>
              <p class="eyebrow">Members Area</p>
              <h1>Google Drive</h1>
            </div>

            <a class="members-link" href="/members/">
              Members Area
            </a>
          </div>

          <a class="back-link" href="/members/">
            ← Members Area
          </a>

          <div class="folder-heading">
            <span class="folder-icon">📁</span>
            <div>
              <h2>Members Documents</h2>
              <p>Select a folder to browse its contents.</p>
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
   * Selected Folder
   * ========================================
   */

  const allowed =
    await isFolderInsideAnyRoot(
      requestedFolderId,
      [
        rootFolderId,
        secondFolderId,
      ],
      accessToken
    );

  if (!allowed) {
    return htmlResponse(
      "Folder Not Available",
      `
        <h1>Folder Not Available</h1>
        <p>This folder is not part of the members' Google Drive area.</p>
        <p>
          <a href="/members/google/drive">
            Back to Members Drive
          </a>
        </p>
      `,
      403
    );
  }

  const folder = await getDriveFile(
    requestedFolderId,
    accessToken
  );

  if (
    !folder ||
    folder.mimeType !==
      "application/vnd.google-apps.folder"
  ) {
    return htmlResponse(
      "Folder Not Found",
      `
        <h1>Folder Not Found</h1>
        <p>The requested folder could not be found or is no longer available.</p>
        <p>
          <a href="/members/google/drive">
            Back to Members Drive
          </a>
        </p>
      `,
      404
    );
  }

  const filesResult =
    await listFolderContents(
      requestedFolderId,
      accessToken
    );

  if (filesResult.error) {
    if (filesResult.status === 401) {
      return htmlResponse(
        "Google Drive Connection Expired",
        `
          <h1>Google Drive Connection Expired</h1>
          <p>Your Google Drive connection has expired.</p>
          <p>
            <a class="button" href="/members/google/login">
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
        <p>Google Drive could not be accessed right now.</p>
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

    console.log(
    "Google Drive folder listing diagnostic:",
    JSON.stringify(
        filesResult.diagnostic
    )
    );    

  files.sort((a, b) => {
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
  });

  const isDesignatedRoot =
    requestedFolderId === rootFolderId ||
    requestedFolderId === secondFolderId;

  const parentFolder =
    isDesignatedRoot
      ? null
      : await getParentFolder(
          requestedFolderId,
          [
            rootFolderId,
            secondFolderId,
          ],
          accessToken
        );

  const fileRows = files.length
    ? files.map((file) => {
        const isFolder =
          file.mimeType ===
          "application/vnd.google-apps.folder";

        if (isFolder) {
          return `
            <a
              class="drive-item folder"
              href="/members/google/drive?folder=${encodeURIComponent(file.id)}"
            >
              <span class="icon">📁</span>
              <span class="item-name">${escapeHtml(file.name)}</span>
              <span class="arrow">›</span>
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
            <span class="icon">${getFileIcon(file.mimeType)}</span>
            <span class="item-name">${escapeHtml(file.name)}</span>
            <span class="external">↗</span>
          </a>
        `;
      }).join("")
    : `
        <div class="empty">
          This folder is empty.
        </div>
      `;

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

  return htmlResponse(
    folder.name,
    `
      <div class="drive-page">

        <div class="drive-header">
          <div>
            <p class="eyebrow">Members Area</p>
            <h1>Google Drive</h1>
          </div>

          <a class="members-link" href="/members/">
            Members Area
          </a>
        </div>

        ${backLink}

        <div class="folder-heading">
          <span class="folder-icon">📁</span>
          <div>
            <h2>${escapeHtml(folder.name)}</h2>
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
 * Folder Security
 * ========================================
 *
 * A requested folder must be:
 *
 * 1. One of the two designated root folders, or
 * 2. A descendant of either designated root folder.
 */

async function isFolderInsideAnyRoot(
  folderId,
  rootFolderIds,
  accessToken
) {
  const validRootIds =
    rootFolderIds.filter(Boolean);

  if (
    validRootIds.includes(folderId)
  ) {
    return true;
  }

  let currentId = folderId;

  for (let i = 0; i < 50; i++) {
    const file =
      await getDriveFile(
        currentId,
        accessToken
      );

    if (!file) {
      return false;
    }

    const parents =
      file.parents || [];

    if (!parents.length) {
      return false;
    }

    if (
      parents.some((parentId) =>
        validRootIds.includes(parentId)
      )
    ) {
      return true;
    }

    currentId =
      parents[0];

    if (
      validRootIds.includes(
        currentId
      )
    ) {
      return true;
    }
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
  rootFolderIds,
  accessToken
) {
  const file =
    await getDriveFile(
      folderId,
      accessToken
    );

  if (
    !file ||
    !file.parents
  ) {
    return null;
  }

  const parentId =
    file.parents.find((id) =>
      rootFolderIds.includes(id)
    ) ||
    file.parents[0];

  if (!parentId) {
    return null;
  }

  return getDriveFile(
    parentId,
    accessToken
  );
}


/*
 * ========================================
 * Google Drive File
 * ========================================
 */

async function getDriveFile(
  fileId,
  accessToken
) {
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
    return null;
  }

  const file =
    await response.json();

  if (file.trashed) {
    return null;
  }

  return file;
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

  /*
   * Support folders/files that may be exposed
   * through shared Drive structures.
   */

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
    const errorText =
        await response.text();

    console.log(
        "Google Drive API error:",
        response.status,
        errorText
    );

    return {
        error: true,
        status: response.status,
    };
    }

const data =
  await response.json();

return {
  error: false,
  files: data.files || [],
  diagnostic: data,
};


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
    mimeType.startsWith("image/")
  ) {
    return "🖼️";
  }

  if (
    mimeType.startsWith("video/")
  ) {
    return "🎬";
  }

  if (
    mimeType.startsWith("audio/")
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

          /* ========================================
             Main Page Container
             ======================================== */

          .drive-page {
            width: min(1160px, calc(100% - 40px));
            margin: 48px auto;
          }

          /* ========================================
             Header
             ======================================== */

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

          /* ========================================
             Navigation Links
             ======================================== */

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

          /* ========================================
             Folder Heading
             ======================================== */

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

          /* ========================================
             Drive List
             ======================================== */

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

          /* ========================================
             Empty State
             ======================================== */

          .empty {
            padding: 40px 20px;
            text-align: center;
            color: #607577;
          }

          /* ========================================
             Note
             ======================================== */

          .drive-note {
            margin-top: 16px;
            color: #607577;
            font-size: 13px;
          }

          /* ========================================
             Button
             ======================================== */

          .button {
            display: inline-block;
            padding: 11px 18px;
            background: #049393;
            color: white;
            border-radius: 9px;
            text-decoration: none;
            font-weight: 600;
          }

          /* ========================================
             Mobile
             ======================================== */

          @media (max-width: 600px) {
            .drive-page {
              width: min(100% - 24px, 1160px);
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