
const apiForm = document.getElementById("api-form");
const apiInput = document.getElementById("api-url");
const checkButton = apiForm.querySelector("button");

const resultMessage = document.getElementById("result-message");
const resultExplanation = document.getElementById("result-explanation");
const resultSuggestion = document.getElementById("result-suggestion");
const resultPerformance = document.getElementById("result-performance");

const historyTableBody = document.getElementById("history-table-body");


// Update dashboard statistics
function updateOverview(overview) {
    if (!overview) return;

    document.getElementById("total-tests").textContent =
        overview.total_tests;

    document.getElementById("successful-tests").textContent =
        overview.successful_tests;

    document.getElementById("failed-checks").textContent =
        overview.failed_checks;

    document.getElementById("average-response").textContent =
        `${Number(overview.average_response).toFixed(3)} s`;
}


// Identify the likely purpose of familiar API endpoints
function getApiName(url) {
    try {
        const parsedUrl = new URL(url);
        const parts = parsedUrl.pathname
            .split("/")
            .filter(Boolean);

        if (parts.length === 0) {
            return "API Root";
        }

        const resource = parts[parts.length - 1]
            .toLowerCase()
            .replace(/[-_]/g, " ");

        const resourceNames = {
            posts: "Post",
            comments: "Comment",
            users: "User",
            albums: "Album",
            photos: "Photo",
            todos: "Task",
            products: "Product",
            orders: "Order",
            articles: "Article",
            search: "Search",
            login: "Login",
            register: "Registration",
            health: "Health Check",
            status: "Status Check"
        };

        // Handle endpoints ending in an ID, such as /posts/1
        const lastPartIsId =
            /^\d+$/.test(parts[parts.length - 1]);

        const resourcePart = lastPartIsId && parts.length > 1
            ? parts[parts.length - 2].toLowerCase()
            : parts[parts.length - 1].toLowerCase();

        const resourceName =
            resourceNames[resourcePart] ||
            resourcePart
                .replace(/[-_]/g, " ")
                .replace(/\b\w/g, letter => letter.toUpperCase());

        if (lastPartIsId) {
            return `Get ${resourceName.replace(/s$/, "")}`;
        }

        if (["login", "register", "search", "health", "status"]
            .includes(resourcePart)) {
            return resourceNames[resourcePart] || "API Endpoint";
        }

        return `Get ${resourceName}`;
    } catch {
        return "API Endpoint";
    }
}


// Shorten the endpoint while keeping its beginning and ending
function shortenEndpoint(url, maxLength = 55) {
    try {
        const parsedUrl = new URL(url);
        const endpoint = parsedUrl.host +
            parsedUrl.pathname +
            parsedUrl.search;

        if (endpoint.length <= maxLength) {
            return endpoint;
        }

        const startLength = 30;
        const endLength = maxLength - startLength - 3;

        return endpoint.substring(0, startLength) +
            "..." +
            endpoint.slice(-endLength);
    } catch {
        if (!url || url.length <= maxLength) {
            return url || "—";
        }

        return url.substring(0, 30) + "..." + url.slice(-22);
    }
}


// Add a normal table cell
function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}


// Display saved API tests
function displayHistory(history) {
    historyTableBody.replaceChildren();

    if (!history || history.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "No tests to display yet.";

        row.appendChild(cell);
        historyTableBody.appendChild(row);
        return;
    }

    history.forEach((item) => {
        const row = document.createElement("tr");

        // API name and endpoint
        const urlCell = document.createElement("td");
        urlCell.classList.add("api-url-cell");

        const fullUrl = item.url || "";

        const apiName = document.createElement("div");
        apiName.classList.add("api-name");
        apiName.textContent = getApiName(fullUrl);

        const endpoint = document.createElement("div");
        endpoint.classList.add("api-endpoint");
        endpoint.textContent = shortenEndpoint(fullUrl);
        endpoint.title = fullUrl || "URL unavailable";

        urlCell.appendChild(apiName);
        urlCell.appendChild(endpoint);
        row.appendChild(urlCell);

        // Status code
        addCell(row, item.status_code ?? "—");

        // API status
        addCell(row, item.api_status ?? "Unknown");

        // Response time
        addCell(
            row,
            typeof item.response_time === "number"
                ? `${item.response_time.toFixed(3)} s`
                : "—"
        );

        // Test date and time
        addCell(row, item.tested_at ?? "—");

        historyTableBody.appendChild(row);
    });
}


// Load API test history from Flask
async function loadHistory() {
    try {
        const response = await fetch("/api/history");
        const data = await response.json();

        if (!response.ok) {
            throw new Error("Could not load API history.");
        }

        displayHistory(data.history);
    } catch (error) {
        historyTableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent =
            "Unable to load history. Refresh the page.";

        row.appendChild(cell);
        historyTableBody.appendChild(row);

        console.error(error);
    }
}


// Check an API when the form is submitted
apiForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const apiUrl = apiInput.value.trim();

    if (!apiUrl) {
        resultMessage.textContent = "Please enter an API URL.";
        return;
    }

    checkButton.disabled = true;
    checkButton.textContent = "Checking...";

    resultMessage.textContent =
        "Connecting to the API. Please wait...";
    resultExplanation.textContent = "Checking...";
    resultSuggestion.textContent = "Waiting for the result...";
    resultPerformance.textContent = "Calculating...";

    try {
        const response = await fetch("/api/check", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: apiUrl })
        });

        const result = await response.json();

        if (result.overview) {
            updateOverview(result.overview);
        }

        if (!response.ok) {
            resultMessage.textContent =
                result.error || "The API check failed.";

            resultExplanation.textContent =
                "The API could not be checked successfully.";

            resultSuggestion.textContent =
                "Check the URL and your internet connection.";

            resultPerformance.textContent = "Unavailable";

            await loadHistory();
            return;
        }

        resultMessage.textContent =
            `Status: ${result.status} | ` +
            `Status Code: ${result.status_code} | ` +
            `Response Time: ${result.response_time.toFixed(3)} seconds`;

        resultExplanation.textContent = result.explanation;
        resultSuggestion.textContent = result.suggestion;
        resultPerformance.textContent = result.performance;

        await loadHistory();

    } catch (error) {
        resultMessage.textContent =
            "Could not connect to API Sentinel. Check whether the Flask server is running.";

        resultExplanation.textContent = "No result was received.";

        resultSuggestion.textContent =
            "Check the terminal for server errors and try again.";

        resultPerformance.textContent = "Unavailable";

        console.error(error);

    } finally {
        checkButton.disabled = false;
        checkButton.textContent = "Check API";
    }
});


// Load saved history when the dashboard opens
loadHistory();
