// Wersje Tornado.io — jedno miejsce: wersja gry (strona główna, wspólne warstwy) i osobna wersja każdego laboratorium.
// Zmiany: CHANGELOG.md. x.y.z — y: nowa funkcja, z: poprawka. Wypełnia każdy znacznik data-lab-version.
(function () {
  "use strict";
  const V = {
    app: "0.36.0",
    labs: {
      "labs/destruction.html": "0.3.3",
      "labs/deformation.html": "0.4.1",
      "labs/mechanics.html": "0.22.0",
      "labs/streets.html": "0.10.2",
    },
  };
  window.GameLabVersions = V;
  const fill = () => document.querySelectorAll("[data-lab-version]").forEach((e) => { const k = e.dataset.labVersion; e.textContent = "v" + (k === "app" ? V.app : V.labs[k] || "?"); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill); else fill();
})();
