// Standalone payment page for ridgeviewgolf.org/pay.html?reg=RGS-...
// Lets someone pay for an EXISTING registration by its Reference ID, from any device,
// at any time — e.g. from the link in their confirmation email after they've closed
// the registration page. It looks the registration up via the backend's JSONP
// ?regId= endpoint (the same reliable <script>-tag channel the golfer counter uses,
// which passes through the VPN/proxy/blocker setups that break reading a POST reply),
// then renders PayPal buttons with custom_id set to the RegistrationID — so the
// existing payment webhook reconciles it exactly like an inline registration payment.

// These two values MIRROR the CONFIG block in script.js — keep them in sync if either
// the Apps Script URL or the PayPal Client ID ever changes.
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyOXYHFvI3cNZkgEmSkQZ2Hr-FszZ0h1J6YgWf-FgnymqUR6SHnPhz-2u4ZRi4PW-qKrA/exec",
  PAYPAL_CLIENT_ID: "BAArkJGh33VS3VJ3J8VLO728XB-QDiIm5Zl0XL1TIwMtu1FIyjf5KyHpMgHZLxa8ICUmu4EikLzHLn2lyw",
};

const $ = (sel) => document.querySelector(sel);

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Shows exactly one of the top-level state blocks (loading / pending / paid / error).
function showState(id) {
  ["state-loading", "state-pending", "state-paid", "state-error"].forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.style.display = (s === id) ? "block" : "none";
  });
}

function showError(text) {
  $("#error-text").textContent = text;
  showState("state-error");
}

function showMsg(text, type) {
  const el = $("#pay-msg");
  el.textContent = text;
  el.className = "form-msg show " + (type || "");
}

// JSONP GET — loads the URL as a <script> tag, same technique as enhance.js/script.js.
// Cross-origin script loads aren't subject to CORS and are rarely blocked.
function jsonpGet(baseUrl, params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cb = "__payLk" + Date.now() + Math.floor(Math.random() * 1000);
    const script = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, timeoutMs || 8000);
    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("load error")); };
    const q = Object.keys(params).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
    q.push("callback=" + cb);
    script.src = baseUrl + (baseUrl.indexOf("?") === -1 ? "?" : "&") + q.join("&");
    document.head.appendChild(script);
  });
}

// Returns the backend's {found, status, amount, categoryLabel} for this reg, or null
// if the backend couldn't be reached at all (distinct from a valid {found:false}).
async function lookup(reg) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const data = await jsonpGet(CONFIG.APPS_SCRIPT_URL, { regId: reg }, 8000);
      if (data) return data;
    } catch (err) {
      // retry — a restrictive network may drop an individual attempt
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

let paypalSdkPromise = null;
function loadPaypalSdk() {
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(CONFIG.PAYPAL_CLIENT_ID) + "&currency=USD&intent=capture";
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.head.appendChild(script);
  });
  return paypalSdkPromise;
}

async function renderPayButton(reg, amount, categoryLabel) {
  let paypal;
  try {
    paypal = await loadPaypalSdk();
  } catch (err) {
    console.error("PayPal SDK load failed", err);
    showMsg("Payment is temporarily unavailable. Please try again shortly, or contact Stan Dixon at (404) 210-1740.", "error");
    return;
  }

  paypal.Buttons({
    style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
    createOrder: (data, actions) => actions.order.create({
      purchase_units: [{
        description: (categoryLabel || "Registration") + " — Sam Anders Serenity Scramble (" + reg + ")",
        custom_id: reg,
        amount: { currency_code: "USD", value: String(amount) },
      }],
    }),
    onApprove: (data, actions) => actions.order.capture().then(() => {
      $("#pending-inner").style.display = "none";
      $("#payment-success").classList.add("show");
    }),
    onError: (err) => {
      console.error("PayPal checkout error", err);
      showMsg("Something went wrong with PayPal. Please try again, or contact Stan Dixon directly.", "error");
    },
  }).render("#paypal-button-container");
}

async function init() {
  const reg = (getParam("reg") || "").trim();
  if (!reg) {
    showError("This payment link is missing its reference code. Please use the exact link from your confirmation email.");
    return;
  }

  const info = await lookup(reg);
  if (!info) {
    showError("We couldn't reach the registration system just now. Please check your connection and refresh the page, or contact Stan Dixon.");
    return;
  }
  if (!info.found) {
    showError("We couldn't find a registration for reference " + reg + ". Double-check the link from your email, or contact Stan Dixon.");
    return;
  }
  if (info.status === "Paid") {
    $("#paid-reg-id").textContent = reg;
    showState("state-paid");
    return;
  }

  const amount = Number(info.amount) || 0;
  if (!amount) {
    showError("We found your registration, but couldn't read the amount due. Please contact Stan Dixon to complete payment.");
    return;
  }

  $("#pay-reg-id").textContent = reg;
  $("#pay-amount").textContent = "$" + amount.toLocaleString();
  if (info.categoryLabel) $("#pay-type").textContent = info.categoryLabel;
  showState("state-pending");
  renderPayButton(reg, amount, info.categoryLabel);
}

init();
