(function () {
  let lastUrl = location.href;
  let captchaInterval = null;
  let isRunning = false;

  safeLog("Content script loaded");

  // -------------------------
  // SPA URL watcher
  // -------------------------
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      safeLog("Route changed: " + lastUrl);
      onRouteChange();
    }
  }, 500);

  onRouteChange();
  injectRetryButton();

  function onRouteChange() {
    if (location.href.includes("/nget/booking/reviewBooking")) {
      safeLog("Review booking page detected");
      startCaptchaFlow();
    }
  }

  // -------------------------
  // SAFE starter (no duplicates)
  // -------------------------
  function startCaptchaFlow() {
    if (isRunning) {
      safeLog("Captcha flow already running");
      return;
    }
    isRunning = true;
    waitForCaptcha();
  }

  // -------------------------
  // Core logic
  // -------------------------
  function waitForCaptcha() {
    safeLog("Waiting for captcha...");

    clearInterval(captchaInterval);

    captchaInterval = setInterval(() => {
      try {
        const captchaImg = document.querySelector(
          'img.captcha-img[alt="Captcha Image here"]'
        );
        const input = document.querySelector(
          'input[formcontrolname="captcha"]'
        );

        if (!captchaImg || !input) return;

        clearInterval(captchaInterval);
        isRunning = false;

        safeLog("Captcha and input found");

        const base64Url = captchaImg.src;

        if (!base64Url.startsWith("data:image")) {
          safeLog("Captcha src is not base64");
          return;
        }

        sendToOCR(base64Url, input);

      } catch (e) {
        safeLog("waitForCaptcha error: " + e.message);
      }
    }, 800);
  }

  // -------------------------
  // OCR messaging (SAFE)
  // -------------------------
  function sendToOCR(base64Url, input) {
    try {
      chrome.runtime.sendMessage(
        {
          type: "OCR",
          base64: base64Url
        },
        response => {
          // 🔥 CONTEXT GUARD
          if (chrome.runtime.lastError) {
            console.warn("Extension context lost");
            return;
          }

          if (!response || !response.success) {
            safeLog("OCR failed");
            return;
          }

          const captchaText = response.text
            .replace(/\s/g, "")
            .trim();

          safeLog("OCR Text: " + captchaText);

          fillAndSubmit(input, captchaText);
        }
      );
    } catch (e) {
      safeLog("sendToOCR error: " + e.message);
    }
  }

  // -------------------------
  // Fill + Enter (Angular-safe)
  // -------------------------
  function fillAndSubmit(input, value) {
    input.focus();
    input.value = value;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    clickContinueButton();
    safeLog("Captcha filled & Enter pressed");
  }

  function clickContinueButton() {
    const btn = document.querySelector(
      'button.btnDefault.train_Search[type="submit"]'
    );

    if (!btn) {
      safeLog("Continue button not found");
      return;
    }

    safeLog("Clicking Continue button");

    // Angular-friendly click
    btn.focus();
    btn.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );
    btn.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    btn.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
  }

  // -------------------------
  // Retry Button UI
  // -------------------------
  function injectRetryButton() {
    if (document.getElementById("irctc-ocr-retry")) return;

    const btn = document.createElement("button");
    btn.id = "irctc-ocr-retry";
    btn.innerText = "Retry Captcha OCR";

    btn.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 99999;
      padding: 8px 12px;
      background: #1e293b;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;

    btn.onclick = () => {
      safeLog("Retry button clicked");
      startCaptchaFlow();
    };

    document.body.appendChild(btn);
    safeLog("Retry button injected");
  }

  // -------------------------
  // Safe logging
  // -------------------------
  function safeLog(message) {
    console.log("[IRCTC OCR]", message);

    try {
      chrome.runtime.sendMessage({
        type: "LOG",
        message
      });
    } catch (_) {
      // context invalidated → ignore
    }
  }
})();