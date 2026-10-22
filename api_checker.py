
from flask import Flask, render_template, request, jsonify
import requests
import time
import json
import os
import socket
import ipaddress
from urllib.parse import urlparse

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_FILE = os.path.join(BASE_DIR, "api_history.json")


def load_history():
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        return data if isinstance(data, list) else []

    except (FileNotFoundError, json.JSONDecodeError):
        return []


def get_overview():
    history = load_history()

    total_tests = len(history)
    successful_tests = sum(
        1 for item in history
        if item.get("status_code") is not None
        and 200 <= item["status_code"] < 300
    )
    failed_checks = total_tests - successful_tests

    response_times = [
        item["response_time"]
        for item in history
        if isinstance(item.get("response_time"), (int, float))
    ]

    average_response = (
        sum(response_times) / len(response_times)
        if response_times else 0
    )

    return {
        "total_tests": total_tests,
        "successful_tests": successful_tests,
        "failed_checks": failed_checks,
        "average_response": round(average_response, 3)
    }


def explain_status(status_code):
    if 200 <= status_code < 300:
        return {
            "status": "Success",
            "explanation": "The API returned a successful response.",
            "suggestion": "You can inspect its response data next."
        }

    if 300 <= status_code < 400:
        return {
            "status": "Redirect",
            "explanation": "The resource may be available at another URL.",
            "suggestion": "Check the API documentation for the correct endpoint."
        }

    if status_code == 401:
        return {
            "status": "Authentication Required",
            "explanation": "The API requires valid authentication credentials.",
            "suggestion": "Check whether an API key or access token is required."
        }

    if status_code == 403:
        return {
            "status": "Access Forbidden",
            "explanation": "The server refused access to this resource.",
            "suggestion": "Check your permissions and API access rules."
        }

    if status_code == 404:
        return {
            "status": "Not Found",
            "explanation": "The requested API endpoint could not be found.",
            "suggestion": "Check the URL path and API documentation."
        }

    if status_code == 429:
        return {
            "status": "Rate Limited",
            "explanation": "The API is limiting requests.",
            "suggestion": "Wait before retrying and check the API rate limits."
        }

    if 400 <= status_code < 500:
        return {
            "status": "Client Error",
            "explanation": "The server reported a problem with the request.",
            "suggestion": "Check the URL, request parameters, and API requirements."
        }

    if 500 <= status_code < 600:
        return {
            "status": "Server Error",
            "explanation": "The server encountered a problem.",
            "suggestion": "Check the API provider's status and try again later."
        }

    return {
        "status": "Unexpected Response",
        "explanation": "The API returned an unexpected status code.",
        "suggestion": "Check the API documentation."
    }


def is_public_api_url(url):
    try:
        parsed = urlparse(url)

        if parsed.scheme not in ("http", "https"):
            return False

        if not parsed.hostname or parsed.username or parsed.password:
            return False

        hostname = parsed.hostname.lower()

        if hostname == "localhost" or hostname.endswith(".localhost"):
            return False

        addresses = socket.getaddrinfo(hostname, None)

        if not addresses:
            return False

        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])

            if not ip.is_global:
                return False

        return True

    except (ValueError, OSError):
        return False


@app.route("/")
def home():
    return render_template(
        "index.html",
        overview=get_overview()
    )


@app.route("/api/check", methods=["POST"])
def check_api():
    data = request.get_json(silent=True) or {}
    api_url = data.get("url", "").strip()

    if not api_url:
        return jsonify({"error": "Please enter an API URL."}), 400

    if len(api_url) > 2048 or not is_public_api_url(api_url):
        return jsonify({
            "error": "Enter a valid public HTTP or HTTPS API URL."
        }), 400

    try:
        start_time = time.perf_counter()

        response = requests.get(
            api_url,
            timeout=10,
            allow_redirects=False,
            headers={"User-Agent": "API-Sentinel/1.0"}
        )

        response_time = round(time.perf_counter() - start_time, 3)
        status_code = response.status_code
        diagnosis = explain_status(status_code)

        history = load_history()
        history.append({
            "url": api_url,
            "status_code": status_code,
            "api_status": diagnosis["status"],
            "response_time": response_time,
            "tested_at": time.strftime("%Y-%m-%d %H:%M:%S")
        })

        with open(HISTORY_FILE, "w", encoding="utf-8") as file:
            json.dump(history, file, indent=4)

        return jsonify({
            "status": diagnosis["status"],
            "status_code": status_code,
            "response_time": response_time,
            "explanation": diagnosis["explanation"],
            "suggestion": diagnosis["suggestion"],
            "performance": (
                "Fast" if response_time < 1
                else "Moderate" if response_time < 3
                else "Slow"
            ),
            "overview": get_overview()
        })

    except requests.exceptions.Timeout:
        return jsonify({
            "error": "The API took too long to respond."
        }), 504

    except requests.exceptions.RequestException:
        return jsonify({
            "error": "Could not connect to the API. Check the URL or network."
        }), 502


if __name__ == "__main__":
    app.run(debug=True)
