// public/js/parties.js
// Customers and suppliers: list screen and form screen.

import { api } from "./api.js";
import { h, debounce, toFaDigits, errorText, toast } from "./util.js";

export function renderPartyList(view) {
  const state = { q: "", role: "", archived: false };
  const listBox = h("div", { class: "list" });

  const search = h("input", {
    type: "search",
    class: "search",
    placeholder: "جستجوی نام یا تلفن…",
    oninput: debounce((e) => { state.q = e.target.value; load(); }, 250),
  });

  const chipDefs = [["", "همه"], ["customer", "مشتری‌ها"], ["supplier", "تأمین‌کنندگان"]];
  const chipButtons = chipDefs.map(([role, label]) =>
    h("button", {
      type: "button",
      class: "chip" + (role === state.role ? " active" : ""),
      onclick: () => {
        state.role = role;
        chipButtons.forEach((b, i) => b.classList.toggle("active", chipDefs[i][0] === role));
        load();
      },
    }, label)
  );

  const archivedBox = h("input", {
    type: "checkbox",
    onchange: (e) => { state.archived = e.target.checked; load(); },
  });

  view.replaceChildren(
    h("h1", { class: "page-title" }, "مشتری‌ها و تأمین‌کنندگان"),
    h("div", { class: "toolbar" }, search,
      h("a", { class: "btn btn-primary btn-small", href: "#/parties/new" }, "+ شخص جدید")),
    h("div", { class: "chips" }, chipButtons),
    h("label", { class: "check-row" }, archivedBox, "نمایش بایگانی‌شده‌ها"),
    listBox
  );

  async function load() {
    listBox.replaceChildren(h("div", { class: "empty" }, "در حال بارگذاری…"));
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.role) params.set("role", state.role);
    if (state.archived) params.set("archived", "1");
    const res = await api("/api/parties?" + params.toString());
    if (!res.ok) {
      listBox.replaceChildren(h("div", { class: "empty" }, errorText(res.error)));
      return;
    }
    if (res.parties.length === 0) {
      listBox.replaceChildren(
        h("div", { class: "empty" },
          state.q || state.role || state.archived
            ? "موردی با این مشخصات پیدا نشد."
            : "هنوز کسی ثبت نشده است. با دکمه‌ی «شخص جدید» شروع کنید.")
      );
      return;
    }
    listBox.replaceChildren(...res.parties.map(partyCard));
  }

  load();
}

function roleBadges(p) {
  return [
    p.is_customer ? h("span", { class: "badge" }, "مشتری") : null,
    p.is_supplier ? h("span", { class: "badge" }, "تأمین‌کننده") : null,
    !p.active ? h("span", { class: "badge" }, "بایگانی") : null,
  ];
}

function partyCard(p) {
  return h("a", { class: "item" + (p.active ? "" : " item-off"), href: "#/parties/" + p.id },
    h("div", null,
      h("div", { class: "item-title" }, toFaDigits(p.name)),
      p.phone ? h("div", { class: "item-sub" }, toFaDigits(p.phone)) : null
    ),
    h("div", { class: "item-side" }, h("div", { class: "badges" }, roleBadges(p)))
  );
}

export async function renderPartyForm(view, idText) {
  const isNew = idText === "new";
  let party = {
    name: "", is_customer: 1, is_supplier: 0, phone: "", national_id: "",
    address: "", note: "", active: 1,
  };

  if (!isNew) {
    view.replaceChildren(h("div", { class: "empty" }, "در حال بارگذاری…"));
    const res = await api("/api/parties/" + Number(idText));
    if (!res.ok) {
      view.replaceChildren(
        h("div", { class: "empty" }, errorText(res.error)),
        h("a", { class: "btn btn-block", href: "#/parties" }, "بازگشت")
      );
      return;
    }
    party = res.party;
  }

  const nameInput = h("input", { type: "text", value: toFaDigits(party.name), autocomplete: "off" });
  const customerBox = h("input", { type: "checkbox", checked: !!party.is_customer });
  const supplierBox = h("input", { type: "checkbox", checked: !!party.is_supplier });
  const phoneInput = h("input", {
    type: "tel", inputmode: "tel", value: toFaDigits(party.phone), autocomplete: "off",
  });
  const idInput = h("input", { type: "text", value: toFaDigits(party.national_id), autocomplete: "off" });
  const addressInput = h("textarea", null, toFaDigits(party.address));
  const noteInput = h("textarea", null, toFaDigits(party.note));
  const msg = h("div", { class: "msg bad" });
  const saveButton = h("button", { type: "submit", class: "btn btn-primary btn-block" }, "ذخیره");

  const form = h("form", { class: "card", autocomplete: "off" },
    h("label", null, "نام (شخص یا شرکت)"), nameInput,
    h("label", null, "نقش"),
    h("label", { class: "check-row" }, customerBox, "مشتری (به او می‌فروشم)"),
    h("label", { class: "check-row" }, supplierBox, "تأمین‌کننده (از او می‌خرم)"),
    h("label", null, "تلفن"), phoneInput,
    h("label", null, "کد ملی / شناسه ملی (اختیاری)"), idInput,
    h("label", null, "آدرس (اختیاری)"), addressInput,
    h("label", null, "توضیحات (اختیاری)"), noteInput,
    saveButton,
    msg
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: nameInput.value,
      isCustomer: customerBox.checked,
      isSupplier: supplierBox.checked,
      phone: phoneInput.value,
      nationalId: idInput.value,
      address: addressInput.value,
      note: noteInput.value,
    };
    saveButton.disabled = true;
    msg.className = "msg ok";
    msg.textContent = "لطفاً صبر کنید…";
    const res = isNew
      ? await api("/api/parties", "POST", payload)
      : await api("/api/parties/" + party.id, "PUT", payload);
    saveButton.disabled = false;
    if (!res.ok) {
      msg.className = "msg bad";
      msg.textContent = errorText(res.error);
      return;
    }
    toast("ذخیره شد");
    location.hash = "#/parties";
  });

  const parts = [h("h1", { class: "page-title" }, isNew ? "شخص جدید" : "ویرایش"), form];

  if (!isNew) {
    const archiveButton = h("button", {
      type: "button",
      class: "btn btn-block" + (party.active ? " btn-danger" : ""),
      onclick: async () => {
        archiveButton.disabled = true;
        const res = await api("/api/parties/" + party.id + "/active", "POST", { active: !party.active });
        if (!res.ok) {
          archiveButton.disabled = false;
          toast(errorText(res.error));
          return;
        }
        toast(party.active ? "بایگانی شد" : "بازگردانی شد");
        location.hash = "#/parties";
      },
    }, party.active ? "بایگانی" : "بازگردانی");
    parts.push(archiveButton);
    parts.push(h("p", { class: "note" },
      "شخص هرگز پاک نمی‌شود تا فاکتورهای قبلی سالم بمانند. بایگانی‌شده‌ها در فاکتور جدید نشان داده نمی‌شوند."));
  }
  parts.push(h("a", { class: "btn btn-block", href: "#/parties" }, "بازگشت به لیست"));

  view.replaceChildren(...parts);
}
