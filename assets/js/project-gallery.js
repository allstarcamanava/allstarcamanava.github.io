/* Project photo gallery: shows 12 photos at a time.
   When a gallery has more than 12 photos, arrow buttons move between
   sets of 12. Without this script every photo is shown. */
(function () {
  "use strict";

  var PER_PAGE = 12;

  Array.prototype.forEach.call(document.querySelectorAll("[data-gallery]"), function (gallery) {
    var items = Array.prototype.slice.call(gallery.querySelectorAll("[data-gallery-item]"));
    var navs = Array.prototype.slice.call(gallery.querySelectorAll("[data-gallery-nav]"));
    if (!navs.length || items.length <= PER_PAGE) return;

    var list = gallery.querySelector(".project-gallery");
    function all(selector) {
      return navs.map(function (nav) { return nav.querySelector(selector); });
    }
    var prevs = all("[data-gallery-prev]");
    var nexts = all("[data-gallery-next]");
    var ranges = all("[data-gallery-range]");
    var pages = Math.ceil(items.length / PER_PAGE);
    var page = 0;

    function showPage(n, moveFocus) {
      page = Math.max(0, Math.min(pages - 1, n));
      var first = page * PER_PAGE;
      var last = Math.min(first + PER_PAGE, items.length);
      items.forEach(function (item, i) {
        item.hidden = i < first || i >= last;
      });
      var label = (first + 1) + "–" + last + " of " + items.length + " photos";
      ranges.forEach(function (r) { r.textContent = label; });
      prevs.forEach(function (b) { b.disabled = page === 0; });
      nexts.forEach(function (b) { b.disabled = page === pages - 1; });
      list.classList.remove("is-changing");
      void list.offsetWidth; // restart the fade
      list.classList.add("is-changing");
      if (moveFocus) {
        var link = items[first].querySelector("a");
        if (link) link.focus({ preventScroll: true });
      }
    }

    // Scroll back to the top of the gallery so the new set starts in view.
    prevs.forEach(function (b) {
      b.addEventListener("click", function () {
        showPage(page - 1, false);
        gallery.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    nexts.forEach(function (b) {
      b.addEventListener("click", function () {
        showPage(page + 1, false);
        gallery.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // After the photo viewer closes, show the set that holds the last photo viewed.
    gallery.addEventListener("lightbox:closed", function (e) {
      var item = e.target.closest("[data-gallery-item]");
      var i = items.indexOf(item);
      if (i !== -1) showPage(Math.floor(i / PER_PAGE), false);
    });

    navs.forEach(function (nav) { nav.hidden = false; });
    showPage(0, false);
  });
})();

/* Project photo lightbox.
   Every link with [data-lightbox] opens its image full size, with arrows
   for the other photos in the same [data-lightbox-group]. Without this
   script the links simply open the image. */
(function () {
  "use strict";

  var links = document.querySelectorAll("a[data-lightbox]");
  if (!links.length) return;

  var box = document.createElement("div");
  box.className = "project-lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Photo viewer");
  box.hidden = true;
  box.innerHTML =
    '<div class="project-lightbox-backdrop" data-close></div>' +
    '<figure class="project-lightbox-figure">' +
    '  <img alt="">' +
    '  <figcaption></figcaption>' +
    '</figure>' +
    '<button type="button" class="project-lightbox-btn project-lightbox-close" data-close aria-label="Close photo">&times;</button>' +
    '<button type="button" class="project-lightbox-btn project-lightbox-prev" aria-label="Previous photo">&#8249;</button>' +
    '<button type="button" class="project-lightbox-btn project-lightbox-next" aria-label="Next photo">&#8250;</button>' +
    '<p class="project-lightbox-count" aria-live="polite"></p>';
  document.body.appendChild(box);

  var img = box.querySelector("img");
  var caption = box.querySelector("figcaption");
  var count = box.querySelector(".project-lightbox-count");
  var prevBtn = box.querySelector(".project-lightbox-prev");
  var nextBtn = box.querySelector(".project-lightbox-next");
  var closeBtn = box.querySelector(".project-lightbox-close");

  var set = [];
  var index = 0;
  var opener = null;

  function show(i) {
    index = (i + set.length) % set.length;
    var link = set[index];
    var thumb = link.querySelector("img");
    img.src = link.getAttribute("href");
    img.alt = thumb ? thumb.alt : "";
    var text = link.getAttribute("data-caption") || "";
    caption.textContent = text;
    caption.hidden = !text;
    var many = set.length > 1;
    prevBtn.hidden = nextBtn.hidden = count.hidden = !many;
    count.textContent = many ? (index + 1) + " of " + set.length : "";
  }

  function open(link) {
    var group = link.closest("[data-lightbox-group]");
    set = Array.prototype.slice.call((group || document).querySelectorAll("a[data-lightbox]"));
    opener = link;
    show(set.indexOf(link));
    box.hidden = false;
    document.documentElement.classList.add("lightbox-open");
    closeBtn.focus();
  }

  function close() {
    box.hidden = true;
    img.removeAttribute("src");
    document.documentElement.classList.remove("lightbox-open");
    // Return to the last photo viewed (its gallery set is shown first).
    var current = set[index] || opener;
    if (current) {
      current.dispatchEvent(new CustomEvent("lightbox:closed", { bubbles: true }));
      current.focus({ preventScroll: true });
    }
  }

  Array.prototype.forEach.call(links, function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      open(link);
    });
  });

  prevBtn.addEventListener("click", function () { show(index - 1); });
  nextBtn.addEventListener("click", function () { show(index + 1); });
  Array.prototype.forEach.call(box.querySelectorAll("[data-close]"), function (el) {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft" && set.length > 1) show(index - 1);
    else if (e.key === "ArrowRight" && set.length > 1) show(index + 1);
    else if (e.key === "Tab") {
      // Keep keyboard focus inside the viewer.
      var focusable = Array.prototype.filter.call(box.querySelectorAll("button"), function (b) { return !b.hidden; });
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Basic swipe on phones.
  var startX = null;
  box.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (startX === null || set.length < 2) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();
