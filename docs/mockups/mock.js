(function () {
  const root = document.documentElement;
  const saved = sessionStorage.getItem("mock-theme");
  const query = new URLSearchParams(location.search).get("theme");
  if (query === "dark" || query === "light") root.dataset.theme = query;
  else if (saved) root.dataset.theme = saved;

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      sessionStorage.setItem("mock-theme", next);
      button.setAttribute("aria-label", next === "dark" ? "ライトモードに切替" : "ダークモードに切替");
    });
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => chip.classList.toggle("active"));
  });
})();
