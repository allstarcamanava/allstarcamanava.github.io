---
layout: default
title: "Search"
description: "Search the Rotary E-Club of All Star CAMANAVA website."
permalink: /search/
---

<section class="block search-page">

  <div class="container">

    <div class="block-head">

      <span class="eyebrow">
        Site Search
      </span>

      <h1>
        Search the site
      </h1>

      <p>
        Find bulletins, projects, announcements, history and more.
      </p>

    </div>

    <div class="site-search">

      <form
        class="site-search-form"
        id="site-search-form"
        role="search"
      >

        <label
          for="site-search-input"
          class="sr-only"
        >
          Search the site
        </label>

        <input
          type="search"
          id="site-search-input"
          class="site-search-input"
          placeholder="Search bulletins, projects, history..."
          autocomplete="off"
        >

        <button
          type="submit"
          class="btn btn-solid"
        >
          Search
        </button>

      </form>

      <div
        class="site-search-status"
        id="site-search-status"
        aria-live="polite"
      ></div>

      <div
        class="site-search-results"
        id="site-search-results"
      ></div>

    </div>

  </div>

</section>

<script src="{{ '/assets/js/search.js' | relative_url }}"></script>