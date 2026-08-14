// ---- Configuration: fill these in after deployment (see SETUP.md) ----
const CONFIG = {
  // Apps Script Web App /exec URL, from Deploy > New deployment > Web app
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyOXYHFvI3cNZkgEmSkQZ2Hr-FszZ0h1J6YgWf-FgnymqUR6SHnPhz-2u4ZRi4PW-qKrA/exec",
  // PayPal REST app Client ID (public — safe to expose in site JS). From
  // developer.paypal.com/dashboard > Apps & Credentials > your app > Client ID.
  // Use the LIVE app's Client ID, not Sandbox. See SETUP.md.
  PAYPAL_CLIENT_ID: "BAArkJGh33VS3VJ3J8VLO728XB-QDiIm5Zl0XL1TIwMtu1FIyjf5KyHpMgHZLxa8ICUmu4EikLzHLn2lyw",
};

const PLAY_PRICES = { "1": 1, "2": 300, "3": 450, "4": 600 }; // TEMP TEST PRICE — revert "1" to 150 before going live
const TIER_LABELS = {
  GOLDEN_ACE: "Golden Ace Sponsorship",
  SILVER_EAGLE: "Silver Eagle Sponsorship",
  BRONZE_BIRDIE: "Bronze Birdie Sponsorship",
  EXCLUSIVE: "Exclusive Sponsorship (Practice Green)",
  HOLE_TEE: "Individual Hole Sponsorship (Tee Box Only)",
  HOLE_TEE_GREEN: "Individual Hole Sponsorship (Tee Box & Green Side)",
};
const PLAY_LABEL = "Play a Round";

const state = { activeTab: "play" };

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const PLAY_REQUIRED_IDS = ["#play-name", "#play-email", "#play-phone"];
const SPONSOR_REQUIRED_IDS = ["#sponsor-company", "#sponsor-contact", "#sponsor-email", "#sponsor-phone"];

// Fields in the hidden panel keep `required` unless we clear it here — hidden
// required fields still block native form validation even though invisible.
function syncRequiredFields(activePanel) {
  PLAY_REQUIRED_IDS.forEach((sel) => $(sel).required = activePanel === "play");
  SPONSOR_REQUIRED_IDS.forEach((sel) => $(sel).required = activePanel === "sponsor-form");
}

// ---- Tab switching ----
function setTab(target) {
  state.activeTab = target === "sponsor-form" ? "sponsor" : "play";
  $("#tab-play").classList.toggle("active", target === "play");
  $("#tab-sponsor").classList.toggle("active", target === "sponsor-form");
  $("#panel-play").classList.toggle("active", target === "play");
  $("#panel-sponsor-form").classList.toggle("active", target === "sponsor-form");
  syncRequiredFields(target);
  updateAmount();
}

$("#tab-play").addEventListener("click", () => setTab("play"));
$("#tab-sponsor").addEventListener("click", () => setTab("sponsor-form"));

// ---- Player slots (optional extra players) ----
function renderPlayerSlots() {
  const count = parseInt($("#play-count").value, 10);
  const container = $("#player-slots");
  container.innerHTML = "";
  for (let i = 2; i <= count; i++) {
    const field = document.createElement("div");
    field.className = "field";
    field.style.margin = "0";
    field.innerHTML = `
      <label for="player-${i}">Player ${i} Name <span class="hint">(optional)</span></label>
      <input type="text" id="player-${i}" name="player${i}Name" placeholder="Fill in now, or we'll follow up">
    `;
    container.appendChild(field);
  }
}

$("#play-count").addEventListener("change", () => {
  renderPlayerSlots();
  updateAmount();
});

// ---- Sponsor tier selection ----
$$('input[name="tier"]').forEach((el) => {
  el.addEventListener("change", updateAmount);
});

// ---- Amount calculation ----
function currentAmount() {
  if (state.activeTab === "play") {
    return PLAY_PRICES[$("#play-count").value] || 0;
  }
  const checked = document.querySelector('input[name="tier"]:checked');
  return checked ? parseInt(checked.dataset.amount, 10) : 0;
}

function currentCategory() {
  if (state.activeTab === "play") return "PLAY";
  const checked = document.querySelector('input[name="tier"]:checked');
  return checked ? checked.value : null;
}

function currentCategoryLabel() {
  const category = currentCategory();
  if (category === "PLAY") return PLAY_LABEL;
  return TIER_LABELS[category] || category || "Registration";
}

function updateAmount() {
  const amount = currentAmount();
  $("#amount-value").textContent = amount ? `$${amount.toLocaleString()}` : "$0";
}

// ---- Helpers ----
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showMsg(text, type) {
  const el = $("#form-msg");
  el.textContent = text;
  el.className = `form-msg show ${type}`;
}

// ---- PayPal Smart Buttons ----
// Loaded on demand (only once someone actually reaches the payment step) so the
// PayPal SDK never blocks the page's initial load. custom_id carries our own
// RegistrationID into the PayPal order, so when the payment webhook reaches the
// Apps Script backend it can match the exact registration instead of guessing
// from the payer's name/email.
let paypalSdkPromise = null;
function loadPaypalSdk() {
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CONFIG.PAYPAL_CLIENT_ID)}&currency=USD&intent=capture`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.head.appendChild(script);
  });
  return paypalSdkPromise;
}

async function renderPaypalButtons(registrationId, amount, categoryLabel) {
  const container = $("#paypal-button-container");
  container.innerHTML = "";

  let paypal;
  try {
    paypal = await loadPaypalSdk();
  } catch (err) {
    console.error("PayPal SDK load failed", err);
    container.innerHTML = '<p class="form-msg show error">Payment is temporarily unavailable. Use "I\'ll pay later" below, or contact Stan Dixon directly.</p>';
    return;
  }

  paypal.Buttons({
    style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
    createOrder: (data, actions) => actions.order.create({
      purchase_units: [{
        description: `${categoryLabel} — Sam Anders Serenity Scramble (${registrationId})`,
        custom_id: registrationId,
        amount: { currency_code: "USD", value: String(amount) },
      }],
    }),
    onApprove: (data, actions) => actions.order.capture().then(() => {
      container.innerHTML = "";
      showMsg(
        "Payment received — thank you! Your spot is confirmed. (It can take a minute for your registration record to update.)",
        "success"
      );
    }),
    onCancel: () => {
      // No-op: they can just click the button again, or use "I'll pay later".
    },
    onError: (err) => {
      console.error("PayPal checkout error", err);
      showMsg("Something went wrong with PayPal. Please try again, or use \"I'll pay later\" below.", "error");
    },
  }).render("#paypal-button-container");
}

// ---- Submit ----
$("#reg-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const category = currentCategory();
  if (state.activeTab === "sponsor" && !category) {
    showMsg("Please select a sponsorship level.", "error");
    return;
  }

  const amount = currentAmount();
  const submitBtn = $("#submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
  showMsg("", "");
  $("#form-msg").classList.remove("show");

  const payload = {
    formType: "registration",
    category,
    amount,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    companyName: "",
    players: [],
    notes: "",
    logo: null,
  };

  if (state.activeTab === "play") {
    payload.contactName = $("#play-name").value.trim();
    payload.contactEmail = $("#play-email").value.trim();
    payload.contactPhone = $("#play-phone").value.trim();
    payload.notes = $("#play-notes").value.trim();
    payload.players = [payload.contactName];
    const count = parseInt($("#play-count").value, 10);
    for (let i = 2; i <= count; i++) {
      const val = $(`#player-${i}`) ? $(`#player-${i}`).value.trim() : "";
      payload.players.push(val || "(TBD)");
    }
  } else {
    payload.contactName = $("#sponsor-contact").value.trim();
    payload.contactEmail = $("#sponsor-email").value.trim();
    payload.contactPhone = $("#sponsor-phone").value.trim();
    payload.companyName = $("#sponsor-company").value.trim();
    payload.notes = $("#sponsor-notes").value.trim();

    const fileInput = $("#sponsor-logo");
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      try {
        const base64 = await fileToBase64(file);
        payload.logo = { name: file.name, type: file.type, dataBase64: base64 };
      } catch (err) {
        console.warn("Logo read failed, continuing without it", err);
      }
    }
  }

  const backendConfigured = CONFIG.APPS_SCRIPT_URL && !CONFIG.APPS_SCRIPT_URL.startsWith("PASTE_");
  const paymentConfigured = CONFIG.PAYPAL_CLIENT_ID && !CONFIG.PAYPAL_CLIENT_ID.startsWith("PASTE_");

  // Only go fully live (save + show a real payment button) when BOTH the backend
  // and PayPal are configured — otherwise we'd capture someone's registration and
  // then hand them a payment step that doesn't work. Until then, point people to
  // the coordinator so no one falls into a broken flow.
  if (!backendConfigured || !paymentConfigured) {
    showMsg(
      "Online registration is being finalized. To reserve your spot right now, contact Stan Dixon at (404) 210-1740 or stanldixon@gmail.com.",
      "info"
    );
    submitBtn.disabled = false;
    submitBtn.textContent = "Continue to Payment";
    return;
  }

  let registrationId = null;
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    registrationId = data.registrationId;
  } catch (err) {
    console.error("Registration submission failed", err);
    showMsg("Something went wrong submitting your registration. Please try again or contact Stan Dixon directly.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Continue to Payment";
    return;
  }

  const categoryLabel = currentCategoryLabel();
  $("#confirm-reg-id").textContent = registrationId;
  $("#confirm-amount").textContent = `$${amount.toLocaleString()}`;
  $("#confirm-panel").classList.add("show");
  form.querySelectorAll("input, select, textarea, button[type=submit]").forEach((el) => (el.disabled = true));
  showMsg("Registration captured. Check your email for a confirmation.", "success");

  renderPaypalButtons(registrationId, amount, categoryLabel);
});

// "I'll pay later" — the spot is already saved as Pending; just reassure them
// and surface the emailed-payment-link note. No backend call needed.
$("#pay-later-btn").addEventListener("click", () => {
  $("#pay-later-note").classList.add("show");
});

// ---- Init ----
renderPlayerSlots();
syncRequiredFields("play");
updateAmount();
