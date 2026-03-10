"use strict";
// Optimized code - get all storage data at once
chrome.storage.local.get(
  ["passengerList", "autoUpgrade", "confirmBerth", "paymentMethod"],
  (allData) => {
    const passengers = allData.passengerList || [];
    if (!passengers.length) return;
    console.log(passengers, "Starting passenger injection");

    // Cached DOM elements and selectors
    const selectors = {
      nameField: 'p-autocomplete[formcontrolname="passengerName"] input',
      ageField: 'input[formcontrolname="passengerAge"]',
      genderField: 'select[formcontrolname="passengerGender"]',
      berthField: 'select[formcontrolname="passengerBerthChoice"]',
    };

    function waitForElement(selector, callback, timeout = 100) {
      const interval = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
          clearInterval(interval);
          callback(element);
        }
      }, timeout);
    }

    function clickAddPassengerButton() {
      const addBtn = Array.from(document.querySelectorAll("span.prenext")).find(
        (el) => el.textContent.includes("+ Add Passenger")
      );
      if (addBtn) addBtn.click();
    }
    function injectPassengerData(passenger, index) {
      try {
        // Get all fields at once using cached selectors
        const nameField = document.querySelectorAll(selectors.nameField)[index];
        const ageField = document.querySelectorAll(selectors.ageField)[index];
        const genderField = document.querySelectorAll(selectors.genderField)[
          index
        ];
        const berthField = document.querySelectorAll(selectors.berthField)[
          index
        ];

        // Cache DOM elements that don't change
        const checkbox = document.getElementById("autoUpgradation");
        const confirmBerth = document.getElementById("confirmberths");
        const cardRadio = document.querySelector(
          '[id="3"] input[type="radio"]'
        );
        const upiRadio = document.querySelector('[id="2"] input[type="radio"]');
        const noInsurance = document.querySelector('[id="travelInsuranceOptedNo-0"] input[type="radio"]')

        if (!nameField || !ageField || !genderField || !berthField) return; // Pre-create events to reuse
        const inputEvent = new Event("input", { bubbles: true });
        const changeEvent = new Event("change", { bubbles: true });
        const blurEvent = new Event("blur", { bubbles: true });

        // Name
        nameField.value = passenger.name;
        nameField.dispatchEvent(inputEvent);

        // Age
        ageField.value = passenger.age;
        ageField.dispatchEvent(inputEvent);

        // Gender mapping (moved outside for better performance)
        const genderMap = { male: "M", female: "F" };
        const genderCode = genderMap[passenger.gender?.toLowerCase()] || "T";
        genderField.value = genderCode;
        genderField.dispatchEvent(changeEvent);
        genderField.dispatchEvent(blurEvent);

        // Berth mapping (moved outside for better performance)
        const berthMap = {
          lower: "LB",
          middle: "MB",
          upper: "UB",
          "side lower": "SL",
          "side upper": "SU",
          "no preference": "",
        };

        const berthCode = berthMap[passenger.berth?.toLowerCase().trim()] || "";

        const options = Array.from(berthField.options);
        const match = options.find((opt) => opt.value === berthCode);
        console.warn("Matching berth option:", match);
        if (match) {
          berthField.value = berthCode;
          berthField.dispatchEvent(changeEvent);
          berthField.dispatchEvent(blurEvent);

          // Use already fetched data instead of making another storage call
          if (typeof allData.autoUpgrade === "boolean" && checkbox) {
            checkbox.checked = allData.autoUpgrade;
            checkbox.dispatchEvent(changeEvent);
            console.log("AutoUpgrade set:", allData.autoUpgrade);
          }

          if (typeof allData.confirmBerth === "boolean" && confirmBerth) {
            confirmBerth.checked = allData.confirmBerth;
            console.log("confirmBerth set:", allData.confirmBerth);
          }

          noInsurance.click();
          noInsurance.dispatchEvent(changeEvent);

          // Handle payment method
          const payment = allData.paymentMethod;
          if (payment === "card" && cardRadio) {
            cardRadio.click();
            cardRadio.dispatchEvent(changeEvent);
            console.log("Card payment selected");
          } else if (payment === "upi" && upiRadio) {
            upiRadio.click();
            upiRadio.dispatchEvent(changeEvent);
            console.log("UPI payment selected");
          }
        } else {
          console.warn("No matching berth option found for:", berthCode);
          console.log(
            "Available options:",
            options.map((o) => [o.value, o.textContent.trim()])
          );
        }
      } catch (error) {
        console.error("Error injecting passenger data:", error);
      }
    } // Flag to prevent multiple clicks
    let isFormSubmitting = false;

    // Function to click continue button
    function clickContinueButton() {
      try {
        // Check if form is already being submitted
        if (isFormSubmitting) {
          console.log("Form is already being submitted, skipping...");
          return;
        }

        // Find the specific continue button with the class and style
        const continueButton = document.querySelector(
          'button.mob-bot-btn.search_btn[type="submit"]'
        );

        // Check if button exists, is enabled, and doesn't have processing text
        if (
          continueButton &&
          !continueButton.disabled &&
          !continueButton.textContent.includes("process") &&
          !continueButton.textContent.includes("Please wait") &&
          !continueButton.classList.contains("loading")
        ) {
          console.log("Clicking continue button");
          isFormSubmitting = true;

          // Single click is usually enough
          continueButton.click();

          // Reset flag after some time in case of failure
          setTimeout(() => {
            isFormSubmitting = false;
          }, 5000);
        } else {
          console.warn(
            "Continue button not found, disabled, or already processing"
          );
        }
      } catch (error) {
        console.error("Error clicking continue button:", error);
        isFormSubmitting = false;
      }
    }

    // Start injection process
    waitForElement(
      selectors.nameField,
      () => {
        const totalPassengers = passengers.length;
        let completedPassengers = 0;

        passengers.forEach((passenger, index) => {
          if (index > 0) {
            setTimeout(() => clickAddPassengerButton(), (index - 1) * 200);
          }
          // Reduced timeout for faster execution
          setTimeout(() => {
            injectPassengerData(passenger, index);
            completedPassengers++;

            // Check if all passengers are processed
            if (completedPassengers === totalPassengers) {
              // Wait a bit more and then click continue button
              setTimeout(() => clickContinueButton(), 500);
            }
          }, index * 300);
        });
      },
      1000
    );
  }
);
