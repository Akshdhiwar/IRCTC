"use strict";
chrome.storage.local.get("paymentMethod", (data) => {
  const paymentMethod = data.paymentMethod;
  console.log(paymentMethod, "this is the payemntmethod ");

  if (paymentMethod === "card") {
    // Card logic
    let lastUrl = location.href;
    let ewalletSelected = false;

    function handlePage(url) {
      if (url.includes("bkgPaymentOptions") && !ewalletSelected) {
        console.log("Payment page detected");
        setTimeout(() => {
          selectEwallet();
        } , 1000)
      }
    }

    function selectEwallet() {
      const observer = new MutationObserver(() => {
        const eWalletOption = [...document.querySelectorAll(".bank-type")].find(
          (el) => el.innerText.includes("E-Wallet")
        );

        if (eWalletOption) {
          eWalletOption.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            })
          );

          eWalletOption.dispatchEvent(new Event("change", { bubbles: true }));

          ewalletSelected = true;
          // Click the Continue button after eWallet selection
          setTimeout(() => {
            const sltbtn = document.querySelector(
              'button.mob-bot-btn.search_btn[style*="background"]'
            );
            sltbtn?.click();
            sltbtn.dispatchEvent(new Event("change", { bubbles: true }));

            console.log("Continue button clicked after eWallet selection");
          }, 1000);

          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // SPA URL watcher
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log("URL changed:", lastUrl);
        handlePage(lastUrl);
      }
    }, 500);

    // First load
    handlePage(location.href);
  } else if (paymentMethod === "upi") {
    // UPI logic
    let lastUrl = location.href;

    function handleUpiPage(url) {
      if (url.includes("bkgPaymentOptions")) {
        const upiOption = [
          ...document.querySelectorAll("#pay-type .bank-type"),
        ].find((el) => el.innerText.includes("BHIM/ UPI"));

        if (upiOption) {
          upiOption.click();
          upiOption.dispatchEvent(new Event("change", { bubbles: true }));
          const paytmOption = [
            ...document.querySelectorAll("div.bank-text span"),
          ].find((el) => el.innerText.includes("PAYTM"));

          if (paytmOption) {
            const paytmBox = paytmOption.closest(".border-all");
            paytmBox.click();

            const payBookBtn = [...document.querySelectorAll("button")].find(
              (btn) => btn.innerText.trim() === "Pay & Book"
            );

            if (payBookBtn) {
              payBookBtn.click();
              payBookBtn.dispatchEvent(new Event("change", { bubbles: true }));
            } else {
              console.log("❌ Pay & Book button not found");
            }
          } else {
            console.log("❌ PAYTM option not found");
          }

          console.log("UPI option clicked ");
        } else {
          console.log("UPI option not found ");
        }
      }
    }

    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log("URL changed:", lastUrl);
        handleUpiPage(lastUrl);
      }
    }, 500);

    // First load
    handleUpiPage(location.href);
  }
});
