/**
 * Unit tests for logger.
 * Run: node --test src/utils/logger.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { logger } from "./logger.js";

test("logger.log forwards to console.log", () => {
  const orig = console.log;
  let received;
  console.log = (...args) => {
    received = args;
  };
  try {
    logger.log("hello", "world");
    assert.deepStrictEqual(received, ["hello", "world"]);
  } finally {
    console.log = orig;
  }
});

test("logger.error forwards to console.error", () => {
  const orig = console.error;
  let received;
  console.error = (...args) => {
    received = args;
  };
  try {
    logger.error("oops");
    assert.deepStrictEqual(received, ["oops"]);
  } finally {
    console.error = orig;
  }
});

test("logger.warn forwards to console.warn", () => {
  const orig = console.warn;
  let received;
  console.warn = (...args) => {
    received = args;
  };
  try {
    logger.warn("warning");
    assert.deepStrictEqual(received, ["warning"]);
  } finally {
    console.warn = orig;
  }
});

test("logger.info forwards to console.info", () => {
  const orig = console.info;
  let received;
  console.info = (...args) => {
    received = args;
  };
  try {
    logger.info("info message");
    assert.deepStrictEqual(received, ["info message"]);
  } finally {
    console.info = orig;
  }
});

test("logger.debug forwards to console.debug", () => {
  const orig = console.debug;
  let received;
  console.debug = (...args) => {
    received = args;
  };
  try {
    logger.debug("debug", 42);
    assert.deepStrictEqual(received, ["debug", 42]);
  } finally {
    console.debug = orig;
  }
});
