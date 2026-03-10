// Auto-confirm logic: run after payments.js
(function () {
  let lastUrl = location.href;

  function handleAutoConfirm(url) {
    if (url.includes("ewallet-confirm")) {
      // Detected ewallet-confirm page, print hello world
      console.log("hello world");
      // Check autoConfirm from chrome.storage.local
      chrome.storage.local.get("autoConfirm", (data) => {
        if (data.autoConfirm === true) {
          let cancelBtn = document.querySelector(".mob-bot-btn.search_btn");
          if (cancelBtn) {
            cancelBtn.click();
            cancelBtn.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else {
          console.log("autoConfirm is not true, not clicking button");
        }
      });
    }
  }

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handleAutoConfirm(lastUrl);
    }
  }, 500);

  // First load
  handleAutoConfirm(location.href);
})();
