// public/js/util.js
// Small helpers: DOM builder, Persian digits, number/money formatting, messages.

// ---------- DOM builder (never uses innerHTML, so user text can't inject HTML) ----------
export function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  let deferredValue;
  if (props) {
    for (const key of Object.keys(props)) {
      const v = props[key];
      if (v === null || v === undefined || v === false) continue;
      if (key === "class") node.className = v;
      else if (key === "value") deferredValue = v;
      else if (key.startsWith("on") && typeof v === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), v);
      } else node.setAttribute(key, v === true ? "" : v);
    }
  }
  append(node, kids);
  if (deferredValue !== undefined) node.value = deferredValue; // after <option>s exist
  return node;
}

export function append(node, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    node.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Digits ----------
export function toFaDigits(value) {
  return String(value === null || value === undefined ? "" : value).replace(/[0-9]/g, (d) =>
    String.fromCharCode(0x06f0 + Number(d))
  );
}

export function normalizeDigits(value) {
  return String(value)
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

// ---------- Numbers and money ----------
const nf = new Intl.NumberFormat("fa-IR");

export function formatNumber(n) {
  return nf.format(n);
}

// Money is stored as integer Toman. (Switch to Rial display comes with the settings phase.)
export function currencyLabel() {
  return "تومان";
}

export function formatMoney(toman) {
  return formatNumber(toman) + " " + currencyLabel();
}

// Reads an amount typed by the user (Persian/English digits, with or without separators).
// Empty text means 0. Returns NaN if the text is not a valid non-negative whole number.
export function parseAmount(text) {
  const clean = normalizeDigits(text).replace(/[,\u060C\u066C\s]/g, "");
  if (clean === "") return 0;
  if (!/^\d+$/.test(clean)) return NaN;
  return Number(clean);
}

// ---------- Messages ----------
const ERRORS = {
  invalid_credentials: "نام کاربری یا رمز عبور درست نیست.",
  too_many_attempts: "تعداد تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه بعد دوباره امتحان کنید.",
  bad_setup_code: "کد راه‌اندازی درست نیست.",
  setup_code_not_configured: "کد راه‌اندازی هنوز در Cloudflare ساخته نشده است.",
  already_setup: "حساب قبلاً ساخته شده است. صفحه را دوباره باز کنید.",
  weak_password: "رمز عبور باید حداقل ۸ حرف باشد.",
  invalid_username: "نام کاربری باید بین ۳ تا ۴۰ حرف باشد.",
  forbidden: "درخواست مجاز نیست.",
  server_error: "خطای سرور. کمی بعد دوباره امتحان کنید.",
  network_error: "ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید.",
  not_found: "مورد پیدا نشد.",
  invalid_name: "نام باید بین ۱ تا ۱۰۰ حرف باشد.",
  duplicate_name: "کالایی با این نام قبلاً ثبت شده است.",
  invalid_kind: "نوع کالا را انتخاب کنید.",
  invalid_unit: "واحد باید بین ۱ تا ۲۰ حرف باشد.",
  invalid_price: "مبلغ معتبر نیست.",
  invalid_note: "توضیحات حداکثر ۵۰۰ حرف می‌تواند باشد.",
  invalid_variant: "نام هر تنوع باید بین ۱ تا ۶۰ حرف باشد.",
  duplicate_variant: "نام تنوع‌ها نباید تکراری باشد.",
  too_many_variants: "حداکثر ۵۰ تنوع برای هر کالا مجاز است.",
};

export function errorText(code) {
  return ERRORS[code] || "خطایی رخ داد. دوباره امتحان کنید.";
}

export function toast(text) {
  const el = h("div", { class: "toast" }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}
