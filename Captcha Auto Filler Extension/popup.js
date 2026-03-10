const logsDiv = document.getElementById("logs");
const clearBtn = document.getElementById("clear");

function renderLogs(logs) {
  logsDiv.innerHTML = "";
  logs.forEach(log => {
    const div = document.createElement("div");
    div.className = "log";
    div.innerHTML = `<span class="time">[${log.time}]</span> ${log.message}`;
    logsDiv.appendChild(div);
  });

  logsDiv.scrollTop = logsDiv.scrollHeight;
}

// Load logs on popup open
chrome.runtime.sendMessage({ type: "GET_LOGS" }, response => {
  if (response?.logs) renderLogs(response.logs);
});

// Clear logs
clearBtn.onclick = () => {
  chrome.storage.local.set({ logs: [] }, () => {
    renderLogs([]);
  });
};