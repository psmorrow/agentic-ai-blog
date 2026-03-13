/**
 * Unit tests for URL validation (SSRF + Safe Browsing).
 * Run: node --test src/utils/urlValidation.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  isUrlSafeForFetch,
  isUrlSafeByGoogleSafeBrowsing
} from "./urlValidation.js";

test("SSRF blocks localhost and private IPs", async () => {
  assert.strictEqual(await isUrlSafeForFetch("http://localhost/"), false);
  assert.strictEqual(await isUrlSafeForFetch("https://127.0.0.1/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://0.0.0.0/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://[::1]/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://10.0.0.1/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://192.168.1.1/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://169.254.169.254/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://172.24.0.1/"), false);
});

test("SSRF allows public IPv6 and numeric hosts", async () => {
  assert.strictEqual(await isUrlSafeForFetch("http://[2001:db8::1]/"), true);
  assert.strictEqual(await isUrlSafeForFetch("http://8.8.8.8/"), true);
  assert.strictEqual(await isUrlSafeForFetch("http://1.2.3/"), true);
});

test("SSRF rejects malformed URL", async () => {
  assert.strictEqual(await isUrlSafeForFetch("not-a-valid-url"), false);
});

test("SSRF blocks IPv6 link-local and unique local", async () => {
  assert.strictEqual(await isUrlSafeForFetch("http://[fe80::1]/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://[fc00::1]/"), false);
  assert.strictEqual(await isUrlSafeForFetch("http://[fd12::3456:789a:1]/"), false);
});

test("SSRF blocks non-http(s) protocols", async () => {
  assert.strictEqual(await isUrlSafeForFetch("file:///etc/passwd"), false);
  assert.strictEqual(await isUrlSafeForFetch("ftp://example.com"), false);
});

test("Safe Browsing skips when no key", async () => {
  assert.strictEqual(
    await isUrlSafeByGoogleSafeBrowsing("https://example.com", ""),
    true
  );
  assert.strictEqual(
    await isUrlSafeByGoogleSafeBrowsing("https://example.com", undefined),
    true
  );
});

test("Safe Browsing returns true when res.notOk", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    assert.strictEqual(
      await isUrlSafeByGoogleSafeBrowsing("https://example.com", "key"),
      true
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Safe Browsing catch returns true", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Network error");
  };
  try {
    assert.strictEqual(
      await isUrlSafeByGoogleSafeBrowsing("https://example.com", "key"),
      true
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});
