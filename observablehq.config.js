// Theme: follows the system light/dark setting until the toggle button is used.
// The choice is then stored in localStorage and applied before the page paints.
const themeHead = `
<style>
:root[data-theme="light"] {
  color-scheme: light;
  --theme-foreground: #1b1e23;
  --theme-foreground-alt: #2b3037;
  --theme-foreground-muted: #6b7280;
  --theme-foreground-faint: #aeb4bd;
  --theme-foreground-fainter: #d3d7dc;
  --theme-foreground-faintest: #eceff2;
  --theme-foreground-focus: #3b5fc0;
  --theme-background: #ffffff;
  --theme-background-alt: #f6f7f9;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --theme-foreground: #e4e6ea;
  --theme-foreground-alt: #f3f4f6;
  --theme-foreground-muted: #9aa1ac;
  --theme-foreground-faint: #6a7280;
  --theme-foreground-fainter: #4a505b;
  --theme-foreground-faintest: #343a44;
  --theme-foreground-focus: #6f9bff;
  --theme-background: #14171c;
  --theme-background-alt: #1d2128;
}
#theme-toggle {
  position: fixed;
  top: 0.6rem;
  right: 0.8rem;
  z-index: 1000;
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: 0.85rem;
  color: var(--theme-foreground);
  background: var(--theme-background-alt);
  border: 1px solid var(--theme-foreground-faint);
  border-radius: 6px;
  cursor: pointer;
}
#theme-toggle:hover { border-color: var(--theme-foreground-focus); }
</style>
<script>
(function () {
  var KEY = "segy-theme";
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) {}
  function effective() {
    return root.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function label(btn) {
    btn.textContent = effective() === "dark" ? "\\u2600 Light theme" : "\\u263E Dark theme";
  }
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.createElement("button");
    btn.id = "theme-toggle";
    btn.type = "button";
    label(btn);
    btn.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      label(btn);
    });
    document.body.appendChild(btn);
  });
})();
</script>`;

export default {
  title: "SEG-Y Analyzer",
  root: "src",
  pager: false,
  head: themeHead,
  footer: `<p>© 2026 Andreas Plesch, Waltham, MA</p>`
};
