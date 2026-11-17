// Número da Juliana com DDI e DDD, só dígitos (ex.: "5516999999999").
  // Vazio: o WhatsApp abre a lista de contatos para a pessoa escolher.
  var WHATSAPP = "";
  // Endereço que recebe as fichas na versão em inglês. Vazio: o e-mail abre sem destinatário.
  var EMAIL = "";
  var EN = (document.documentElement.lang || "").indexOf("en") === 0;
  var MSG = EN
    ? { empty: "Fill in at least one field.", copied: "Copied. Paste it into the chat.", missing: "Still missing: " }
    : { empty: "Preencha pelo menos um campo.", copied: "Copiado. É só colar na conversa.", missing: "Falta preencher: " };

  function check(form, status) {
    var miss = [];
    form.querySelectorAll(".f.miss").forEach(function (el) { el.classList.remove("miss"); });
    form.querySelectorAll("[data-req]").forEach(function (input) {
      var v = input.value.trim();
      var ok = v !== "" && (input.type !== "email" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
      if (!ok) {
        var f = input.closest(".f");
        f.classList.add("miss");
        miss.push(f.querySelector("span").firstChild.textContent.replace("*", "").trim());
      }
    });
    if (miss.length) {
      status.classList.add("err");
      status.textContent = MSG.missing + miss.join(", ") + ".";
      var first = form.querySelector(".f.miss input, .f.miss textarea");
      if (first) first.focus();
      return false;
    }
    status.classList.remove("err");
    return true;
  }

  function collect(form) {
    var lines = ["*" + form.dataset.title + "*"];
    var fields = form.querySelectorAll(".fields > *");
    fields.forEach(function (el) {
      if (el.classList.contains("formsec")) {
        lines.push("", "*" + el.querySelector("span").textContent.trim() + "*");
        return;
      }
      var opts = el.querySelector(".opts");
      if (opts) {
        var picked = Array.prototype.map.call(opts.querySelectorAll("input:checked"), function (i) { return i.value; });
        if (picked.length) lines.push(opts.dataset.name + ": " + picked.join(", "));
        return;
      }
      var input = el.querySelector("input, textarea");
      if (input && input.value.trim()) {
        var v = input.value.trim();
        if (input.type === "date") { var p = v.split("-"); v = p[2] + "/" + p[1] + "/" + p[0]; }
        lines.push(input.name + ": " + v);
      }
    });
    // drop section titles that ended up with nothing under them
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var isHead = /^\*.*\*$/.test(lines[i]) && i > 0;
      if (isHead) {
        var j = i + 1, has = false;
        while (j < lines.length && !/^\*.*\*$/.test(lines[j])) { if (lines[j]) has = true; j++; }
        if (!has) { if (out[out.length - 1] === "") out.pop(); continue; }
      }
      out.push(lines[i]);
    }
    return out.join("\n");
  }

  function filled(text) { return text.split("\n").filter(function (l) { return /: /.test(l); }).length; }

  document.querySelectorAll("form[data-title]").forEach(function (form) {
    var status = form.querySelector("[data-status]");
    form.querySelector("[data-send]").addEventListener("click", function () {
      if (!check(form, status)) return;
      var text = collect(form);
      if (!filled(text)) { status.textContent = MSG.empty; return; }
      if (EN) {
        window.location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(form.dataset.title) + "&body=" + encodeURIComponent(text.replace(/\*/g, ""));
      } else {
        window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text), "_blank", "noopener");
      }
      status.textContent = "";
    });
    form.querySelector("[data-copy]").addEventListener("click", function () {
      if (!check(form, status)) return;
      var text = collect(form);
      if (!filled(text)) { status.textContent = MSG.empty; return; }
      var done = function () { status.textContent = MSG.copied; };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
      } else { fallback(text); done(); }
    });
  });

  function fallback(text) {
    var t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(t);
  }
