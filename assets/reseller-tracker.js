// Reseller Tracking System for Shopify
class ResellerTracker {
  constructor() {
    this.resellerCode = null;
    this.storageKey = "reseller_tracking";
    this.init();
  }

  init() {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code") || urlParams.get("reseller");

    if (codeFromUrl) {
      this.setResellerCode(codeFromUrl);
    } else {
      // Check stored code
      this.loadStoredCode();
    }

    // Set up form listeners
    this.setupFormListeners();
  }

  setResellerCode(code) {
    this.resellerCode = code;
    const trackingData = {
      code: code,
      timestamp: new Date().toISOString(),
      source: window.location.href,
    };

    // Store in both localStorage and sessionStorage for redundancy
    localStorage.setItem(this.storageKey, JSON.stringify(trackingData));
    sessionStorage.setItem(this.storageKey, JSON.stringify(trackingData));

    // Also set a cookie for server-side access
    this.setCookie("reseller_code", code, 30);
  }

  loadStoredCode() {
    try {
      const stored =
        localStorage.getItem(this.storageKey) ||
        sessionStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.resellerCode = data.code;
      }
    } catch (e) {
      console.error("Error loading stored reseller code:", e);
    }
  }

  setupFormListeners() {
    // Listen for registration form submissions
    document.addEventListener("submit", (e) => {
      const form = e.target;

      // Check if it's a customer registration form
      if (
        form.action &&
        form.action.includes("/account") &&
        (form.id.includes("create_customer") ||
          form.id.includes("RegisterForm"))
      ) {
        this.handleRegistrationSubmit(form);
      }
    });

    // Add reseller info to any forms on the page
    this.updateFormsWithResellerInfo();
  }

  handleRegistrationSubmit(form) {
    if (!this.resellerCode) return;

    // Add hidden fields to capture reseller info
    this.addHiddenField(
      form,
      "customer[note]",
      `Reseller Code: ${this.resellerCode}`
    );

    // Store in form data for post-registration processing
    this.addHiddenField(form, "reseller_code", this.resellerCode);

    // Tag the customer with reseller info (if tags are enabled)
    this.addHiddenField(
      form,
      "customer[tags]",
      `reseller-${this.resellerCode}`
    );
  }

  addHiddenField(form, name, value) {
    // Check if field already exists
    let field = form.querySelector(`input[name="${name}"]`);

    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = name;
      form.appendChild(field);
    }

    field.value = value;
  }

  updateFormsWithResellerInfo() {
    if (!this.resellerCode) return;

    // Update any reseller display elements
    const displayElements = document.querySelectorAll("[data-reseller-code]");
    displayElements.forEach((el) => {
      el.textContent = this.resellerCode;
      el.closest("[data-reseller-info]")?.classList.remove("hidden");
    });

    // Update form fields
    const codeFields = document.querySelectorAll("[data-reseller-field]");
    codeFields.forEach((field) => {
      field.value = this.resellerCode;
    });
  }

  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  }

  getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // Method to get current reseller code
  getResellerCode() {
    return this.resellerCode;
  }

  // Method to clear reseller tracking
  clearTracking() {
    this.resellerCode = null;
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.storageKey);
    this.setCookie("reseller_code", "", -1);
  }
}

// Initialize tracker when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.resellerTracker = new ResellerTracker();
  });
} else {
  window.resellerTracker = new ResellerTracker();
}

// Export for use in other scripts
window.ResellerTracker = ResellerTracker;
