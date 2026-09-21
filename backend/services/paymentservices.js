// services/paymentService.js
//
// DUMMY payment service — simulates each payment method's flow (network
// delay, minimal input validation, a generated reference) without touching
// any real payment gateway. This is the single file to replace once a real
// provider (Paynow, Stripe, EcoCash Merchant API, etc.) is integrated —
// nothing outside this file needs to change as long as processPayment()
// keeps the same return shape: { success, paymentReference, paymentMethod }.

const MOCK_NETWORK_DELAY_MS = 1400;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateReference(prefix) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString().slice(-6)}-${rand}`;
}

// ── Card ──────────────────────────────────────────────────────────────────
async function payWithCard({ cardNumber, expiry, cvv, cardholderName }) {
  const digitsOnly = (cardNumber || "").replace(/\s/g, "");

  if (!cardholderName?.trim()) {
    throw new Error("Enter the name on the card");
  }
  if (digitsOnly.length < 13 || digitsOnly.length > 19) {
    throw new Error("Enter a valid card number");
  }
  if (!/^\d{2}\/\d{2}$/.test(expiry || "")) {
    throw new Error("Enter expiry as MM/YY");
  }
  if (!/^\d{3,4}$/.test(cvv || "")) {
    throw new Error("Enter a valid CVV");
  }

  await delay(MOCK_NETWORK_DELAY_MS);

  return {
    success: true,
    paymentMethod: "card",
    paymentReference: generateReference("CARD"),
    last4: digitsOnly.slice(-4),
  };
}

// ── EcoCash / OneMoney (mobile money) ────────────────────────────────────
async function payWithMobileMoney({ provider, phoneNumber }) {
  if (!/^0?7[0-9]{8}$/.test((phoneNumber || "").replace(/\s/g, ""))) {
    throw new Error("Enter a valid mobile money number (e.g. 077xxxxxxx)");
  }

  // Real integration would trigger a USSD push here and poll for
  // confirmation. The mock just simulates that wait.
  await delay(MOCK_NETWORK_DELAY_MS + 600);

  return {
    success: true,
    paymentMethod: provider, // "ecocash" | "onemoney"
    paymentReference: generateReference(provider === "ecocash" ? "ECO" : "ONM"),
  };
}

// ── Bank transfer ─────────────────────────────────────────────────────────
async function payWithBankTransfer({ reference }) {
  if (!reference?.trim()) {
    throw new Error("Enter your transfer reference / receipt number");
  }

  await delay(MOCK_NETWORK_DELAY_MS);

  // In a real integration this would come back as "pending" until the
  // finance team reconciles the bank statement. The mock treats it as
  // immediately confirmed to keep the guardian flow simple end-to-end.
  return {
    success: true,
    paymentMethod: "bank_transfer",
    paymentReference: reference.trim(),
  };
}

// ── Cash on pickup ───────────────────────────────────────────────────────
async function payWithCashOnPickup() {
  await delay(600);

  return {
    success: true,
    paymentMethod: "cash_on_pickup",
    paymentReference: generateReference("CASH"),
  };
}

// ── Single entry point used by the UI ────────────────────────────────────
export async function processPayment(method, details = {}) {
  switch (method) {
    case "card":
      return payWithCard(details);
    case "ecocash":
      return payWithMobileMoney({ provider: "ecocash", phoneNumber: details.phoneNumber });
    case "onemoney":
      return payWithMobileMoney({ provider: "onemoney", phoneNumber: details.phoneNumber });
    case "bank_transfer":
      return payWithBankTransfer(details);
    case "cash_on_pickup":
      return payWithCashOnPickup();
    default:
      throw new Error("Select a payment method");
  }
}

export const PAYMENT_METHODS = [
  { id: "card", label: "Card", icon: "card-outline" },
  { id: "ecocash", label: "EcoCash", icon: "phone-portrait-outline" },
  { id: "onemoney", label: "OneMoney", icon: "phone-portrait-outline" },
  { id: "bank_transfer", label: "Bank Transfer", icon: "business-outline" },
  { id: "cash_on_pickup", label: "Cash on Pickup", icon: "cash-outline" },
];
