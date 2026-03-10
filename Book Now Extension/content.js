(function () {
  const interval = setInterval(() => {
    const isLoading = document.querySelector('div.my-loading');
    if (isLoading) return;

    const buttons = document.querySelectorAll('button.btnDefault.train_Search');
    const activeBtn = Array.from(buttons).find(
      btn => !btn.disabled && !btn.classList.contains('disable-book')
    );

    if (activeBtn) {
      activeBtn.click();
      clearInterval(interval);
    }
  }, 300);
})();