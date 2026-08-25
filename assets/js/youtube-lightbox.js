document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("youtube-lightbox");

  if (!modal) return;

  const iframe = modal.querySelector("iframe");
  const closeButton = modal.querySelector(".youtube-lightbox-close");

  document.querySelectorAll("[data-youtube-lightbox]").forEach(function (trigger) {
    trigger.addEventListener("click", function (event) {
      event.preventDefault();

      const videoUrl = trigger.getAttribute("data-youtube-lightbox");

      iframe.src = videoUrl + "?autoplay=1&rel=0";
      modal.classList.add("is-open");
      document.body.classList.add("lightbox-open");
    });
  });

  function closeLightbox() {
    modal.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
    iframe.src = "";
  }

  closeButton.addEventListener("click", closeLightbox);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
});