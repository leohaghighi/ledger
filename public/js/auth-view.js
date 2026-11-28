// public/js/auth-view.js
// First-time setup screen and login screen.

import { api } from "./api.js";
import { h, errorText } from "./util.js";

// mode: "setup" or "login". onDone() is called after success.
export function renderAuth(root, mode, onDone, firstMessage) {
  const msg = h("div", { class: "msg bad" }, firstMessage || "");
  const button = h("button", { type: "submit", class: "btn btn-primary btn-block" },
    mode === "setup" ? "ساخت حساب" : "ورود");

  function field(id, label, type, autocomplete) {
    return [
      h("label", { for: id }, label),
      h("input", { id, type, autocomplete, autocapitalize: "none", required: true }),
    ];
  }

  const isSetup = mode === "setup";
  const form = h("form", { autocomplete: "on" },
    h("p", { class: "sub" },
      isSetup
        ? "راه‌اندازی اولیه: نام کاربری و رمز عبور خود را بسازید"
        : "برای ورود، مشخصات خود را وارد کنید"),
    isSetup ? field("setup-code", "کد راه‌اندازی (همان که در Cloudflare گذاشتید)", "password", "off") : null,
    field("username", "نام کاربری", "text", "username"),
    field("password", isSetup ? "رمز عبور (حداقل ۸ حرف)" : "رمز عبور", "password",
      isSetup ? "new-password" : "current-password"),
    isSetup ? field("password2", "تکرار رمز عبور", "password", "new-password") : null,
    button,
    isSetup
      ? h("p", { class: "note" }, "رمز را جایی امن یادداشت کنید. در این برنامه امکان «فراموشی رمز» وجود ندارد.")
      : null,
    msg
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (id) => form.querySelector("#" + id).value;
    if (isSetup && val("password") !== val("password2")) {
      msg.className = "msg bad";
      msg.textContent = "تکرار رمز عبور با رمز عبور یکی نیست.";
      return;
    }
    button.disabled = true;
    msg.className = "msg ok";
    msg.textContent = "لطفاً صبر کنید…";
    const body = isSetup
      ? { setupCode: val("setup-code"), username: val("username"), password: val("password") }
      : { username: val("username"), password: val("password") };
    const res = await api(isSetup ? "/api/setup" : "/api/login", "POST", body);
    button.disabled = false;
    if (res.ok) return onDone();
    msg.className = "msg bad";
    msg.textContent = errorText(res.error);
  });

  root.replaceChildren(
    h("div", { class: "auth-wrap" },
      h("div", { class: "auth-card" }, h("h1", null, "دفتر کل"), form))
  );
}
