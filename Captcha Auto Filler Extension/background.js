// Central log store
let logs = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "LOG") {
        const entry = {
            time: new Date().toLocaleTimeString(),
            message: msg.message
        };

        logs.push(entry);

        // Keep last 100 logs
        if (logs.length > 100) logs.shift();

        chrome.storage.local.set({ logs });
    }

    if (msg.type === "GET_LOGS") {
        sendResponse({ logs });
    }

    // OCR request uses the same message object passed into the listener.
    if (msg.type === "OCR") {
        fetch("http://localhost:8000/ocr", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                image_base64: msg.base64
            })
        })
            .then(res => res.json())
            .then(data => {
                sendResponse({ success: true, text: data.text });
            })
            .catch(err => {
                sendResponse({ success: false, error: err.message });
            });

        return true; // async response
    }
});