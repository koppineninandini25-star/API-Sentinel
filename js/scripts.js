
const apiForm = document.querySelector("#check-api form");
const apiInput = document.querySelector("#api-url");
const checkButton = apiForm.querySelector("button");
const resultMessage = document.querySelector("#check-api > div p");

apiForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const apiUrl = apiInput.value.trim();

    if (!apiUrl) {
        resultMessage.textContent = "Please enter an API URL.";
        return;
    }

    checkButton.disabled = true;
    checkButton.textContent = "Checking...";
    resultMessage.textContent = "Connecting to the API. Please wait...";

    try {
        const response = await fetch("/api/check", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: apiUrl
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Unable to check this API.");
        }

        resultMessage.textContent =
            `Status: ${result.status} | ` +
            `Status Code: ${result.status_code} | ` +
            `Response Time: ${result.response_time} seconds`;

    } catch (error) {
        resultMessage.textContent =
            error.message || "Could not connect to the server.";
    } finally {
        checkButton.disabled = false;
        checkButton.textContent = "Check API";
    }
});
