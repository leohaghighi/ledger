// public/js/app.js
// Starts the app: checks login, draws the header/tab bar, and switches screens by URL hash.

import { api, setUnauthorizedHandler } from "./api.js";
import { h, toFaDigits } from "./util.js";
import { renderAuth } from "./auth-view.js";
import { renderProductList, renderProductForm } from "./products.js";

const root = document.getElementById("app");
let username = "";
let view = null;
let tabLinks = {};

const TABS = [
  { id: "home", href: "#/", icon: "🏠", label: "خانه" },
  { id: "products", href: "#/products", icon: "📦", label: "کالاها" },
];

async function boot() {
  setUnauthorizedHandler(() => {}); // avoid loops while checking login
  root.replaceChildren(h("div", { class: "auth-wrap" }, h("div", { class: "note" }, "در حال بارگذاری…")));

  const me = await api("/api/me");
  if (me.ok) {
    username = me.user.username;
    setUnauthorizedHandler(boot);
    drawShell();
    route();
    return;
  }
  if (me.error === "network_error") {
    renderAuth(root, "login", boot, "ارتباط با سرور برقرار نشد.");
    return;
  }
  const status = await api("/api/setup-status");
  renderAuth(root, status.ok && status.needsSetup ? "setup" : "login", boot);
}

function drawShell() {
  view = h("main", { class: "container" });
  tabLinks = {};
  const tabbar = h("nav", { class: "tabbar" },
    TABS.map((t) => {
      const link = h("a", { href: t.href }, h("span", { class: "ico" }, t.icon), t.label);
      tabLinks[t.id] = link;
      return link;
    })
  );
  root.replaceChildren(h("header", { class: "app-header" }, "دفتر کل"), view, tabbar);
}

function setActiveTab(id) {
  for (const key of Object.keys(tabLinks)) tabLinks[key].classList.toggle("active", key === id);
}

function route() {
  if (!view) return;
  const hash = location.hash || "#/";
  window.scrollTo(0, 0);

  let m;
  if (hash === "#/products") {
    setActiveTab("products");
    renderProductList(view);
  } else if ((m = hash.match(/^#\/products\/(new|\d+)$/))) {
    setActiveTab("products");
    renderProductForm(view, m[1]);
  } else {
    setActiveTab("home");
    renderHome();
  }
}

function renderHome() {
  view.replaceChildren(
    h("div", { class: "card" },
      h("h1", { class: "page-title" }, "سلام " + toFaDigits(username) + " 👋"),
      h("p", { class: "note" }, "از منوی پایین یا کارت‌های زیر شروع کنید."),
      h("div", { class: "home-grid" },
        h("a", { class: "home-tile", href: "#/products" }, h("span", { class: "ico" }, "📦"), "کالاها"),
        h("div", { class: "home-tile soon" }, h("span", { class: "ico" }, "👥"), "مشتری‌ها (به‌زودی)"),
        h("div", { class: "home-tile soon" }, h("span", { class: "ico" }, "🧾"), "فاکتورها (به‌زودی)"),
        h("div", { class: "home-tile soon" }, h("span", { class: "ico" }, "📊"), "موجودی (به‌زودی)")
      )
    ),
    h("button", {
      type: "button",
      class: "btn btn-block",
      onclick: async () => {
        await api("/api/logout", "POST", {});
        boot();
      },
    }, "خروج")
  );
}

window.addEventListener("hashchange", route);
boot();
