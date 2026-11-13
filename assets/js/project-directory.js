/* Service Projects directory: search and filters.
   Works on the cards already on the page; if this script fails,
   every project stays visible. */
(function () {
  "use strict";

  var form = document.getElementById("projectFilters");
  if (!form) return;

  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-project-card]"));
  var groups = Array.prototype.slice.call(document.querySelectorAll("[data-project-group]"));
  var noMatch = document.getElementById("projectsNoMatch");
  var statusText = document.getElementById("pf-status-text");
  var fields = {
    q: form.elements.q,
    year: form.elements.year,
    category: form.elements.category,
    city: form.elements.city,
    status: form.elements.status,
    area: form.elements.area
  };

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Precompute each card's searchable text once.
  cards.forEach(function (card) {
    card._search = normalize(card.getAttribute("data-search"));
    card._areas = (card.getAttribute("data-areas") || "").split("|");
  });

  function hasValue(select, value) {
    return Array.prototype.some.call(select.options, function (o) { return o.value === value; });
  }

  // Pre-select filters from the address, e.g. /service-projects/?area=Maternal and Child Health
  var params = new URLSearchParams(window.location.search);
  Object.keys(fields).forEach(function (key) {
    var value = params.get(key);
    if (!value) return;
    if (key === "q") fields.q.value = value;
    else if (hasValue(fields[key], value)) fields[key].value = value;
  });

  function apply() {
    var words = normalize(fields.q.value).split(" ").filter(Boolean);
    var year = fields.year.value;
    var category = fields.category.value;
    var city = fields.city.value;
    var status = fields.status.value;
    var area = fields.area.value;
    var shown = 0;

    cards.forEach(function (card) {
      var match =
        (!year || card.getAttribute("data-year") === year) &&
        (!category || card.getAttribute("data-category") === category) &&
        (!city || card.getAttribute("data-city") === city) &&
        (!status || card.getAttribute("data-status") === status) &&
        (!area || card._areas.indexOf(area) !== -1) &&
        words.every(function (w) { return card._search.indexOf(w) !== -1; });

      card.hidden = !match;
      if (match) shown++;
    });

    groups.forEach(function (group) {
      var visible = group.querySelectorAll("[data-project-card]:not([hidden])").length;
      group.hidden = visible === 0;
      var count = group.querySelector("[data-group-count]");
      if (count) count.textContent = visible;
    });

    var filtered = words.length || year || category || city || status || area;
    noMatch.hidden = shown !== 0;
    statusText.textContent = filtered
      ? "Showing " + shown + " of " + cards.length + " project" + (cards.length === 1 ? "" : "s")
      : "Showing all " + cards.length + " project" + (cards.length === 1 ? "" : "s");
  }

  function clearAll() {
    form.reset();
    // form.reset() fires before values clear, so apply on the next tick.
    setTimeout(apply, 0);
  }

  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("submit", function (e) { e.preventDefault(); apply(); });
  form.addEventListener("reset", function () { setTimeout(apply, 0); });

  Array.prototype.forEach.call(document.querySelectorAll("[data-clear-filters]"), function (btn) {
    btn.addEventListener("click", function () {
      clearAll();
      fields.q.focus();
    });
  });

  form.hidden = false;
  apply();
})();
