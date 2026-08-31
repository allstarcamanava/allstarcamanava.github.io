document.addEventListener("DOMContentLoaded", function () {

  const form = document.getElementById("site-search-form");
  const input = document.getElementById("site-search-input");
  const resultsContainer = document.getElementById("site-search-results");
  const status = document.getElementById("site-search-status");

  if (!form || !input || !resultsContainer) {
    return;
  }

  let searchIndex = [];

  fetch("/search.json")
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Unable to load search index.");
      }

      return response.json();
    })
    .then(function (data) {
      searchIndex = data;
    })
    .catch(function (error) {
      console.error("Search error:", error);

      status.textContent =
        "Search is temporarily unavailable.";
    });


  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }


  function search(query) {

    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return [];
    }

    const terms = normalizedQuery
      .split(/\s+/)
      .filter(Boolean);

    return searchIndex
      .map(function (item) {

        const searchableText = normalize(
          [
            item.title,
            item.content,
            item.excerpt,
            item.type
          ].join(" ")
        );

        let score = 0;

        terms.forEach(function (term) {

          if (normalize(item.title).includes(term)) {
            score += 10;
          }

          if (normalize(item.excerpt).includes(term)) {
            score += 5;
          }

          if (searchableText.includes(term)) {
            score += 2;
          }

        });

        return {
          item: item,
          score: score
        };

      })
      .filter(function (result) {
        return result.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (result) {
        return result.item;
      });
  }


  function createResult(item, query) {

    const article = document.createElement("article");
    article.className = "site-search-result";

    const title = document.createElement("h3");

    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.title;

    title.appendChild(link);


    const meta = document.createElement("div");
    meta.className = "site-search-result-meta";

    let metaText = item.type || "Page";

    if (item.date) {
      metaText += " · " + item.date;
    }

    meta.textContent = metaText;


    const excerpt = document.createElement("p");

    const sourceText =
      item.excerpt ||
      item.content ||
      "";

    const normalizedSource = normalize(sourceText);
    const normalizedQuery = normalize(query);

    let start = normalizedSource.indexOf(normalizedQuery);

    if (start < 0) {
      start = 0;
    }

    const originalStart =
      Math.max(0, start);

    let text =
      sourceText.substring(
        originalStart,
        originalStart + 180
      ).trim();

    if (originalStart > 0) {
      text = "…" + text;
    }

    if (originalStart + 180 < sourceText.length) {
      text += "…";
    }

    excerpt.textContent = text;


    article.appendChild(title);
    article.appendChild(meta);

    if (text) {
      article.appendChild(excerpt);
    }

    return article;
  }


  function displayResults(results, query) {

    resultsContainer.innerHTML = "";

    if (!query) {

      status.textContent = "";

      return;
    }


    if (results.length === 0) {

      status.textContent =
        'No results found for "' + query + '".';

      return;
    }


    status.textContent =
      results.length +
      (results.length === 1 ? " result" : " results") +
      ' found for "' +
      query +
      '".';


    const fragment =
      document.createDocumentFragment();

    results.forEach(function (item) {

      fragment.appendChild(
        createResult(item, query)
      );

    });

    resultsContainer.appendChild(fragment);
  }


  form.addEventListener("submit", function (event) {

    event.preventDefault();

    const query = input.value.trim();

    const results = search(query);

    displayResults(results, query);

  });


  input.addEventListener("input", function () {

    const query = input.value.trim();

    if (!query) {
      resultsContainer.innerHTML = "";
      status.textContent = "";
      return;
    }

    const results = search(query);

    displayResults(results, query);

  });

});