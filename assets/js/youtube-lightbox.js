document.addEventListener("DOMContentLoaded", function () {
  const lightbox = document.getElementById("youtube-lightbox");
  const iframe = document.getElementById("youtube-lightbox-iframe");

  if (!lightbox || !iframe) return;

  const triggers = document.querySelectorAll("[data-youtube-url]");
  const closeButtons = document.querySelectorAll("[data-youtube-close]");

  function getYouTubeEmbedUrl(url) {
    try {
      const parsedUrl = new URL(url);

      let videoId = "";

      if (parsedUrl.hostname.includes("youtu.be")) {
        videoId = parsedUrl.pathname.substring(1);
      } else if (parsedUrl.hostname.includes("youtube.com")) {
        videoId = parsedUrl.searchParams.get("v") || "";

        if (parsedUrl.pathname.startsWith("/shorts/")) {
          videoId = parsedUrl.pathname.split("/shorts/")[1];
        }

        if (parsedUrl.pathname.startsWith("/embed/")) {
          videoId = parsedUrl.pathname.split("/embed/")[1];
        }
      }

      if (!videoId) return null;

      videoId = videoId.split("?")[0].split("&")[0];

      return "https://www.youtube.com/embed/" + videoId +
        "?autoplay=1&rel=0";
    } catch (error) {
      return null;
    }
  }

  function openLightbox(url) {
    const embedUrl = getYouTubeEmbedUrl(url);

    if (!embedUrl) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    iframe.src = embedUrl;

    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("youtube-lightbox-open");
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");

    document.body.classList.remove("youtube-lightbox-open");

    iframe.src = "";
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      const url = trigger.getAttribute("data-youtube-url");

      if (url) {
        openLightbox(url);
      }
    });
  });

  closeButtons.forEach(function (button) {
    button.addEventListener("click", closeLightbox);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });
});