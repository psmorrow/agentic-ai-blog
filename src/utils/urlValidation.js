/**
 * URL validation for SSRF protection and Safe Browsing.
 */

import { promises as dns } from "dns";
import { SAFE_BROWSING_TIMEOUT_MS } from "../config.js";

/**
 * Checks if an IPv4 address is in a blocked range (loopback, private, link-local).
 * @param {string} ip - IPv4 address (e.g. "127.0.0.1")
 * @returns {boolean} true if blocked
 */
function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => n < 0 || n > 255)) return false;
  if (parts[0] === 127) return true; // 127.0.0.0/8
  if (parts[0] === 10) return true; // 10.0.0.0/8
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
  if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
  if (parts[0] === 0) return true; // 0.0.0.0/8
  return false;
}

/**
 * Checks if an IPv6 address is in a blocked range (loopback, link-local, unique local).
 * @param {string} ip - IPv6 address (e.g. "::1", "fe80::1")
 * @returns {boolean} true if blocked
 */
function isPrivateIPv6(ip) {
  const s = ip.toLowerCase();
  if (s === "::1") return true;
  if (s.startsWith("fe80:")) return true; // fe80::/10
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // fc00::/7
  return false;
}

/**
 * Checks if an IP address (string) is in a private/blocked range.
 * @param {string} ip - IPv4 or IPv6 address
 * @returns {boolean}
 */
function isPrivateIP(ip) {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  if (trimmed.includes(".")) return isPrivateIPv4(trimmed);
  return isPrivateIPv6(trimmed);
}

/**
 * SSRF protection: returns false if the URL should not be fetched
 * (targets localhost, private IPs, or internal resources).
 * @param {string} urlString - URL to check
 * @returns {Promise<boolean>} true if safe to fetch
 */
export async function isUrlSafeForFetch(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname;
    const lower = hostname.toLowerCase();

    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(lower)) {
      return false;
    }

    if (lower.endsWith(".localhost")) return false;

    if (hostname.includes(".")) {
      const parts = hostname.split(".");
      if (parts.every((p) => /^\d+$/.test(p))) {
        return !isPrivateIPv4(hostname);
      }
    }
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      const ip = hostname.slice(1, -1);
      return !isPrivateIP(ip);
    }

    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    return addresses.every((a) => !isPrivateIP(a.address));
  } catch {
    return false;
  }
}

/**
 * Google Safe Browsing v4: returns false if the URL is on a threat list.
 * If apiKey is empty, returns true (check skipped).
 * @param {string} url - URL to check
 * @param {string} [apiKey] - Google Safe Browsing API key
 * @returns {Promise<boolean>} true if safe (or check skipped)
 */
export async function isUrlSafeByGoogleSafeBrowsing(url, apiKey) {
  if (!apiKey || typeof apiKey !== "string") return true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SAFE_BROWSING_TIMEOUT_MS);

    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "langgraph-blog-validator", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }]
          }
        }),
        signal: controller.signal
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return true;

    const data = await res.json();
    const matches = data?.matches ?? [];
    return matches.length === 0;
  } catch {
    return true;
  }
}
