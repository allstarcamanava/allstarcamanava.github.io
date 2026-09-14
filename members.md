---
layout: default
title: Members Area
permalink: /members/
---

<section class="block">
  <div class="container">

    <div class="members-header">
    <h1>Members Area</h1>

    <a href="/members/logout" class="members-logout">
        Logout
    </a>
    </div>    

    <p>
      Welcome to the Rotary E-Club of All Star CAMANAVA members area.
    </p>

    <div class="members-drive-card">

      <h2>Google Drive</h2>

      <p>
        Access the members' shared documents, folders, and resources.
      </p>

      <p>
        <a href="/members/google/drive">
          Browse Members Drive
        </a>
      </p>

    </div>

  </div>
</section>

<style>
  /* ========================================
     Members Header
     ======================================== */

  .members-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .members-header h1 {
    margin-bottom: 0;
  }

  /* ========================================
     Logout Button
     ======================================== */

  .members-logout {
    padding: 8px 14px;
    border: 1px solid #cfeaea;
    border-radius: 8px;
    color: #049393;
    text-decoration: none;
    font-weight: 600;
    white-space: nowrap;
  }

  .members-logout:hover {
    background: #eaf6f6;
  }

  /* ========================================
     Google Drive Card
     ======================================== */

  .members-drive-card {
    max-width: 700px;
    margin-top: 30px;
    padding: 24px;
    background: #ffffff;
    border: 1px solid #cfeaea;
    border-radius: 14px;
  }

  .members-drive-card h2 {
    margin-top: 0;
  }

  .members-drive-card a {
    display: inline-block;
    padding: 11px 18px;
    background: #049393;
    color: #ffffff;
    border-radius: 9px;
    text-decoration: none;
    font-weight: 600;
  }

  .members-drive-card a:hover {
    opacity: 0.9;
  }

  /* ========================================
     Mobile
     ======================================== */

  @media (max-width: 600px) {
    .members-header {
      align-items: flex-start;
    }
  }
</style>