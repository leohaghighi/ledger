// public/js/products.js
// Product list screen and product form screen (with variants).

import { api } from "./api.js";
import {
  h, debounce, toFaDigits, formatNumber, formatMoney, parseAmount,
  currencyLabel, errorText, toast,
} from "./util.js";

const KIND_LABEL = { raw: "ماده اولیه", finished: "محصول نهایی" };
const UNIT_SUGGESTIONS = ["عدد", "متر", "کیلوگرم", "گرم", "لیتر", "بسته", "جفت", "رول", "دست"];

function namedVariants(product) {
  return product.variants.filter((v) => v.name !== "");
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export function renderProductList(view) {
  const state = { q: "", kind: "", archived: false };
  const listBox = h("div", { class: "list" });

  const search = h("input", {
    type: "search",
    class: "search",
    placeholder: "جستجوی کالا…",
    oninput: debounce((e) => { state.q = e.target.value; load(); }, 250),
  });

  const chipDefs = [["", "همه"], ["raw", "مواد اولیه"], ["finished", "محصولات نهایی"]];
  const chipButtons = chipDefs.map(([kind, label]) =>
    h("button", {
      type: "button",
      class: "chip" + (kind === state.kind ? " active" : ""),
      onclick: () => {
        state.kind = kind;
        chipButtons.forEach((b, i) => b.classList.toggle("active", chipDefs[i][0] === kind));
        load();
      },
    }, label)
  );

  const archivedBox = h("input", {
    type: "checkbox",
    onchange: (e) => { state.archived = e.target.checked; load(); },
  });

  view.replaceChildren(
    h("h1", { class: "page-title" }, "کالاها"),
    h("div", { class: "toolbar" }, search,
      h("a", { class: "btn btn-primary btn-small", href: "#/products/new" }, "+ کالای جدید")),
    h("div", { class: "chips" }, chipButtons),
    h("label", { class: "check-row" }, archivedBox, "نمایش کالاهای بایگانی‌شده"),
    listBox
  );

  async function load() {
    listBox.replaceChildren(h("div", { class: "empty" }, "در حال بارگذاری…"));
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.kind) params.set("kind", state.kind);
    if (state.archived) params.set("archived", "1");
    const res = await api("/api/products?" + params.toString());
    if (!res.ok) {
      listBox.replaceChildren(h("div", { class: "empty" }, errorText(res.error)));
      return;
    }
    if (res.products.length === 0) {
      listBox.replaceChildren(
        h("div", { class: "empty" },
          state.q || state.kind || state.archived
            ? "کالایی با این مشخصات پیدا نشد."
            : "هنوز کالایی ثبت نشده است. با دکمه‌ی «کالای جدید» شروع کنید.")
      );
      return;
    }
    listBox.replaceChildren(...res.products.map(productCard));
  }

  load();
}

function productCard(p) {
  const named = namedVariants(p);
  const activeNamed = named.filter((v) => v.active);
  const sub = [KIND_LABEL[p.kind], toFaDigits(p.unit)];
  if (named.length > 0) sub.push(formatNumber(activeNamed.length) + " تنوع");
  return h("a", { class: "item" + (p.active ? "" : " item-off"), href: "#/products/" + p.id },
    h("div", null,
      h("div", { class: "item-title" }, toFaDigits(p.name)),
      h("div", { class: "item-sub" }, sub.join(" · ")),
      activeNamed.length > 0
        ? h("div", { class: "item-variants" }, activeNamed.map((v) => toFaDigits(v.name)).join("، "))
        : null
    ),
    h("div", { class: "item-side" },
      p.default_sale_price > 0 ? formatMoney(p.default_sale_price) : "",
      !p.active ? h("div", null, h("span", { class: "badge" }, "بایگانی")) : null
    )
  );
}

// ---------------------------------------------------------------------------
// Form (create / edit)
// ---------------------------------------------------------------------------
export async function renderProductForm(view, idText) {
  const isNew = idText === "new";
  let product = {
    name: "", kind: "finished", unit: "عدد",
    default_sale_price: 0, default_purchase_price: 0, note: "", active: 1, variants: [],
  };

  if (!isNew) {
    view.replaceChildren(h("div", { class: "empty" }, "در حال بارگذاری…"));
    const res = await api("/api/products/" + Number(idText));
    if (!res.ok) {
      view.replaceChildren(
        h("div", { class: "empty" }, errorText(res.error)),
        h("a", { class: "btn btn-block", href: "#/products" }, "بازگشت")
      );
      return;
    }
    product = res.product;
  }

  // Variant rows (the hidden default variant with an empty name is not shown).
  const variants = namedVariants(product).map((v) => ({ id: v.id, name: v.name, active: !!v.active }));
  const variantBox = h("div");

  function drawVariants() {
    variantBox.replaceChildren(
      ...variants.map((v, index) =>
        h("div", { class: "variant-row" },
          h("input", {
            type: "text",
            placeholder: "مثلاً: قرمز، یا سایز بزرگ",
            value: toFaDigits(v.name),
            oninput: (e) => { v.name = e.target.value; },
          }),
          v.id
            ? h("label", null,
                h("input", {
                  type: "checkbox",
                  checked: v.active,
                  onchange: (e) => { v.active = e.target.checked; },
                }), "فعال")
            : h("button", {
                type: "button",
                class: "btn btn-danger btn-small",
                onclick: () => { variants.splice(index, 1); drawVariants(); },
              }, "حذف")
        )
      )
    );
  }
  drawVariants();

  function moneyInput(value) {
    const input = h("input", {
      type: "text",
      inputmode: "numeric",
      value: value > 0 ? formatNumber(value) : "",
      placeholder: "۰",
    });
    input.addEventListener("blur", () => {
      const n = parseAmount(input.value);
      if (!Number.isNaN(n)) input.value = n > 0 ? formatNumber(n) : "";
    });
    return input;
  }

  const nameInput = h("input", { type: "text", value: toFaDigits(product.name), autocomplete: "off" });
  const kindSelect = h("select", { value: product.kind },
    h("option", { value: "finished" }, KIND_LABEL.finished),
    h("option", { value: "raw" }, KIND_LABEL.raw));
  const unitInput = h("input", { type: "text", list: "unit-list", value: toFaDigits(product.unit) });
  const saleInput = moneyInput(product.default_sale_price);
  const purchaseInput = moneyInput(product.default_purchase_price);
  const noteInput = h("textarea", null, toFaDigits(product.note));
  const msg = h("div", { class: "msg bad" });
  const saveButton = h("button", { type: "submit", class: "btn btn-primary btn-block" }, "ذخیره");

  const form = h("form", { class: "card", autocomplete: "off" },
    h("label", null, "نام کالا"), nameInput,
    h("label", null, "نوع"), kindSelect,
    h("label", null, "واحد شمارش"), unitInput,
    h("datalist", { id: "unit-list" }, UNIT_SUGGESTIONS.map((u) => h("option", { value: u }))),
    h("div", { class: "row" },
      h("div", null, h("label", null, "قیمت خرید (" + currencyLabel() + ")"), purchaseInput),
      h("div", null, h("label", null, "قیمت فروش (" + currencyLabel() + ")"), saleInput)),
    h("div", { class: "hint" }, "قیمت‌ها پیش‌فرض هستند و در فاکتور می‌توانید تغییرشان دهید."),
    h("label", null, "تنوع‌ها (رنگ، سایز و…)"),
    variantBox,
    h("button", {
      type: "button",
      class: "btn btn-small",
      onclick: () => {
        variants.push({ id: null, name: "", active: true });
        drawVariants();
        const inputs = variantBox.querySelectorAll('input[type="text"]');
        inputs[inputs.length - 1].focus();
      },
    }, "+ افزودن تنوع"),
    h("div", { class: "hint" },
      "اگر کالا تنوع ندارد، این بخش را خالی بگذارید. موجودی هر تنوع جدا نگه داشته می‌شود."),
    h("label", null, "توضیحات (اختیاری)"), noteInput,
    saveButton,
    msg
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sale = parseAmount(saleInput.value);
    const purchase = parseAmount(purchaseInput.value);
    if (Number.isNaN(sale) || Number.isNaN(purchase)) {
      msg.textContent = errorText("invalid_price");
      return;
    }
    const payload = {
      name: nameInput.value,
      kind: kindSelect.value,
      unit: unitInput.value,
      defaultSalePrice: sale,
      defaultPurchasePrice: purchase,
      note: noteInput.value,
      variants: variants
        .filter((v) => v.id || v.name.trim() !== "")
        .map((v) => ({ id: v.id || undefined, name: v.name, active: v.active })),
    };
    saveButton.disabled = true;
    msg.className = "msg ok";
    msg.textContent = "لطفاً صبر کنید…";
    const res = isNew
      ? await api("/api/products", "POST", payload)
      : await api("/api/products/" + product.id, "PUT", payload);
    saveButton.disabled = false;
    if (!res.ok) {
      msg.className = "msg bad";
      msg.textContent = errorText(res.error);
      return;
    }
    toast("ذخیره شد");
    location.hash = "#/products";
  });

  const parts = [
    h("h1", { class: "page-title" }, isNew ? "کالای جدید" : "ویرایش کالا"),
    form,
  ];

  if (!isNew) {
    const archiveButton = h("button", {
      type: "button",
      class: "btn btn-block" + (product.active ? " btn-danger" : ""),
      onclick: async () => {
        archiveButton.disabled = true;
        const res = await api("/api/products/" + product.id + "/active", "POST", {
          active: !product.active,
        });
        if (!res.ok) {
          archiveButton.disabled = false;
          toast(errorText(res.error));
          return;
        }
        toast(product.active ? "کالا بایگانی شد" : "کالا بازگردانی شد");
        location.hash = "#/products";
      },
    }, product.active ? "بایگانی کالا" : "بازگردانی کالا");
    parts.push(archiveButton);
    parts.push(h("p", { class: "note" },
      "کالا هرگز پاک نمی‌شود تا فاکتورها و موجودی قدیمی سالم بمانند. کالای بایگانی‌شده در فاکتور جدید نشان داده نمی‌شود."));
  }
  parts.push(h("a", { class: "btn btn-block", href: "#/products" }, "بازگشت به لیست"));

  view.replaceChildren(...parts);
}
