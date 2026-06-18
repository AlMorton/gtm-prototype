// GTM dataLayer event helpers.
// These push custom events you can use as triggers inside Google Tag Manager.
// Make sure the dataLayer exists even before GTM loads.
window.dataLayer = window.dataLayer || [];

function pushEvent(eventName, params) {
  window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
  // Log to the console so you can verify pushes without opening Tag Assistant.
  console.log("[dataLayer]", eventName, params || {});
}

document.addEventListener("DOMContentLoaded", function () {
  // CTA button click -> custom "cta_click" event
  var cta = document.getElementById("cta-button");
  if (cta) {
    cta.addEventListener("click", function () {
      pushEvent("cta_click", { cta_location: cta.dataset.cta || "unknown" });
    });
  }

  // Outbound link click -> custom "outbound_click" event
  var outbound = document.getElementById("outbound-link");
  if (outbound) {
    outbound.addEventListener("click", function () {
      pushEvent("outbound_click", { link_url: outbound.href });
    });
  }

  // Contact form submit -> custom "form_submit" event (no real network request)
  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      pushEvent("form_submit", {
        form_id: "contact-form",
        form_name: form.name.value || ""
      });
      var status = document.getElementById("form-status");
      if (status) status.hidden = false;
      form.reset();
    });
  }
});
