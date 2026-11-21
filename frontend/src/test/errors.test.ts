import { describe, it, expect } from "vitest";
import { getErrorMessage, getErrorStatus, getImportFailureMessage, isAuthRejection, isNetworkError } from "../utils/errors";

const httpError = (status: number, detail?: unknown) => ({ response: { status, data: { detail } } });

describe("getErrorMessage", () => {
  it("prefers the server's own message when it sends one", () => {
    expect(getErrorMessage(httpError(400, "Username not found on Chess.com"))).toBe("Username not found on Chess.com");
  });

  it("explains offline / server-down errors in plain language", () => {
    const err = { code: "ERR_NETWORK", request: {} };
    expect(isNetworkError(err)).toBe(true);
    expect(getErrorMessage(err)).toMatch(/can't reach chesslens/i);
  });

  it("explains timeouts", () => {
    expect(getErrorMessage({ code: "ECONNABORTED", request: {} })).toMatch(/too long/i);
  });

  it("maps status codes when there is no detail", () => {
    expect(getErrorMessage(httpError(404))).toMatch(/couldn't find/i);
    expect(getErrorMessage(httpError(429))).toMatch(/too many/i);
    expect(getErrorMessage(httpError(500))).toMatch(/our side/i);
    expect(getErrorMessage(httpError(503))).toMatch(/our side/i);
  });

  it("ignores FastAPI validation-error lists and falls back to a status message", () => {
    expect(getErrorMessage(httpError(422, [{ msg: "field required" }]))).toMatch(/invalid/i);
  });

  it("uses the supplied fallback for unknown errors", () => {
    expect(getErrorMessage(new Error("boom"), "Custom fallback")).toBe("Custom fallback");
    expect(getErrorMessage(undefined, "Custom fallback")).toBe("Custom fallback");
  });

  it("reads the HTTP status", () => {
    expect(getErrorStatus(httpError(409))).toBe(409);
    expect(getErrorStatus(new Error("x"))).toBeUndefined();
  });
});

describe("isAuthRejection", () => {
  it("is true only when the server says the login is invalid", () => {
    expect(isAuthRejection(httpError(401))).toBe(true);
    expect(isAuthRejection(httpError(403))).toBe(true);
  });

  it("is false for offline, timeout and server errors, so the user is not signed out", () => {
    expect(isAuthRejection({ code: "ERR_NETWORK", request: {} })).toBe(false);
    expect(isAuthRejection({ code: "ECONNABORTED", request: {} })).toBe(false);
    expect(isAuthRejection(httpError(500))).toBe(false);
    expect(isAuthRejection(httpError(503))).toBe(false);
    expect(isAuthRejection(undefined)).toBe(false);
  });
});

describe("getImportFailureMessage", () => {
  it("names the username when Chess.com says the player does not exist", () => {
    const raw = "Client error '404 Not Found' for url 'https://api.chess.com/pub/player/zzz/games/archives'";
    expect(getImportFailureMessage(raw, "  zzz ")).toBe(
      'We couldn\'t find a Chess.com player named "zzz". Check the spelling and try again.',
    );
  });

  it("explains rate limiting", () => {
    expect(getImportFailureMessage("Client error '429 Too Many Requests'", "x")).toMatch(/limiting requests/i);
  });

  it("gives a useful message for an empty error (a timeout stores no text)", () => {
    expect(getImportFailureMessage("", "x")).toMatch(/import stopped/i);
    expect(getImportFailureMessage(undefined, "x")).toMatch(/try again in a few minutes/i);
  });

  it("does not blame the username for unrelated failures", () => {
    expect(getImportFailureMessage("Server error '503 Service Unavailable'", "x")).not.toMatch(/spelling/i);
  });

  it("does not show raw technical text to the user", () => {
    expect(getImportFailureMessage("httpx.ReadTimeout: https://api.chess.com/...", "x")).not.toMatch(/httpx|https?:/i);
  });
});
