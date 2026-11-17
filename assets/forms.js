// Formulários das páginas de parceiros (ficha de indicação e questionário).
//
// Envio: POST para /api/partner-referral no site da Anthracite, que grava no
// banco (tabela partner_referrals) e manda o e-mail para a Juliana e o Sean.
// Se o envio falhar (sem internet, ou a página aberta fora do site oficial),
// cai no plano B: abre o WhatsApp (pt) ou o e-mail (en) com o texto pronto.
(function () {
  var ENDPOINT = "/api/partner-referral";
  // Plano B. Número da Juliana com DDI e DDD, só dígitos (ex.: "5516999999999");
  // vazio, o WhatsApp abre a lista de contatos.
  var WHATSAPP = "";
  // Plano B da versão em inglês. Vazio: o e-mail abre sem destinatário.
  var EMAIL = "";

  var EN = (document.documentElement.lang || "").indexOf("en") === 0;
  var MARKET = EN ? "us" : "br";
  var started = Date.now();
  var MSG = EN
    ? {
        empty: "Fill in at least one field.",
        copied: "Copied. Paste it into the chat.",
        missing: "Still missing: ",
        sending: "Sending…",
        sent: { referral: "Sent! Juliana and Sean have your referral. Within 1 business day we confirm the call with the client.", questionnaire: "Sent! We have the questionnaire. We'll be in touch about the photos and logo." },
        fallback: "We couldn't send it from here, so we opened an email with everything filled in. Just hit send.",
      }
    : {
        empty: "Preencha pelo menos um campo.",
        copied: "Copiado. É só colar na conversa.",
        missing: "Falta preencher: ",
        sending: "Enviando…",
        sent: { referral: "Ficha enviada! A Juliana e o Sean já receberam. Em até 1 dia útil a gente confirma a conversa com o cliente.", questionnaire: "Questionário enviado! A gente já recebeu e combina com você as fotos e o logo." },
        fallback: "Não conseguimos enviar por aqui, então abrimos o WhatsApp com a ficha pronta. É só enviar.",
      };

  function fmtDate(v) {
    var p = v.split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : v;
  }

  // Every answer as [label, value] pairs, in page order, section titles included.
  function pairs(form) {
    var out = [];
    form.querySelectorAll(".fields > *").forEach(function (el) {
      if (el.classList.contains("formsec")) {
        out.push(["§", el.querySelector("span").textContent.trim()]);
        return;
      }
      var opts = el.querySelector(".opts");
      if (opts) {
        var picked = Array.prototype.map.call(opts.querySelectorAll("input:checked"), function (i) { return i.value; });
        out.push([opts.dataset.name, picked.join(", ")]);
        return;
      }
      var input = el.querySelector("input, textarea");
      if (input) {
        var v = input.value.trim();
        out.push([input.name, input.type === "date" && v ? fmtDate(v) : v]);
      }
    });
    // Drop empty answers and sections with nothing under them.
    var clean = [];
    for (var i = 0; i < out.length; i++) {
      if (out[i][0] === "§") {
        var j = i + 1, has = false;
        while (j < out.length && out[j][0] !== "§") { if (out[j][1]) has = true; j++; }
        if (has) clean.push(out[i]);
      } else if (out[i][1]) {
        clean.push(out[i]);
      }
    }
    return clean;
  }

  function asText(form, list) {
    var lines = ["*" + form.dataset.title + "*"];
    list.forEach(function (p) {
      if (p[0] === "§") lines.push("", "*" + p[1] + "*");
      else lines.push(p[0] + ": " + p[1]);
    });
    return lines.join("\n");
  }

  function core(form) {
    var c = {};
    form.querySelectorAll("[data-k]").forEach(function (input) {
      var v = input.value.trim();
      c[input.dataset.k] = input.type === "date" && v ? fmtDate(v) : v;
    });
    return c;
  }

  function check(form, status) {
    var miss = [];
    form.querySelectorAll(".f.miss").forEach(function (el) { el.classList.remove("miss"); });
    form.querySelectorAll("[data-req]").forEach(function (input) {
      var v = input.value.trim();
      var ok = v !== "" && (input.type !== "email" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
      if (ok && input.type === "tel") ok = v.replace(/\D/g, "").length >= 8;
      if (!ok) {
        var f = input.closest(".f");
        f.classList.add("miss");
        miss.push(f.querySelector("span").firstChild.textContent.replace("*", "").trim());
      }
    });
    if (miss.length) {
      status.className = "hint err";
      status.textContent = MSG.missing + miss.join(", ") + ".";
      var first = form.querySelector(".f.miss input, .f.miss textarea");
      if (first) first.focus();
      return false;
    }
    return true;
  }

  function fallback(form, text) {
    if (EN) {
      window.location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(form.dataset.title) + "&body=" + encodeURIComponent(text.replace(/\*/g, ""));
    } else {
      window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text), "_blank", "noopener");
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(t);
    return Promise.resolve();
  }

  document.querySelectorAll("form[data-title]").forEach(function (form) {
    var status = form.querySelector("[data-status]");
    var button = form.querySelector("[data-send]");
    var kind = form.dataset.kind || "referral";

    button.addEventListener("click", function () {
      if (!check(form, status)) return;
      var list = pairs(form);
      if (!list.some(function (p) { return p[0] !== "§"; })) {
        status.className = "hint err"; status.textContent = MSG.empty; return;
      }
      var text = asText(form, list);
      var hp = form.querySelector('input[name="company_url"]');
      button.disabled = true;
      status.className = "hint"; status.textContent = MSG.sending;

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: kind,
          market: MARKET,
          fields: list.map(function (p) { return p[0] === "§" ? ["—", p[1]] : p; }),
          core: core(form),
          company_url: hp ? hp.value : "",
          elapsedMs: Date.now() - started,
        }),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok || !data.ok) throw new Error(data.error || "http_" + res.status);
          });
        })
        .then(function () {
          status.className = "hint ok";
          status.textContent = MSG.sent[kind];
          form.querySelectorAll("input, textarea").forEach(function (i) {
            if (i.type === "radio" || i.type === "checkbox") i.checked = false; else i.value = "";
          });
          button.disabled = false;
        })
        .catch(function () {
          button.disabled = false;
          status.className = "hint";
          status.textContent = MSG.fallback;
          fallback(form, text);
        });
    });

    form.querySelector("[data-copy]").addEventListener("click", function () {
      var list = pairs(form);
      if (!list.some(function (p) { return p[0] !== "§"; })) {
        status.className = "hint err"; status.textContent = MSG.empty; return;
      }
      copyText(asText(form, list)).then(function () {
        status.className = "hint"; status.textContent = MSG.copied;
      });
    });
  });
})();
