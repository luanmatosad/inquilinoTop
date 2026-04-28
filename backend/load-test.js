-- InquilinoTop Load Test Script
-- Run with: k6 run load-test.js
-- Or: k6 run -e HOST=https://api.inquilino.top load-test.js

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const HOST = __ENV.HOST || "http://localhost:8080";
const EMAIL = __ENV.EMAIL || "test@example.com";
const PASSWORD = __ENV.PASSWORD || "test123456";

const authDuration = new Trend("auth_duration");
const propertyListDuration = new Trend("property_list_duration");
const tenantListDuration = new Trend("tenant_list_duration");

const errorRate = new Rate("errors");

let accessToken = "";

export const options = {
  stages: [
    { duration: "10s", vu: 10 },
    { duration: "30s", vu: 50 },
    { duration: "30s", vu: 100 },
    { duration: "10s", vu: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.1"],
  },
};

export function setup() {
  const loginRes = http.post(`${HOST}/api/v1/auth/login`, JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
  }), {
    headers: { "Content-Type": "application/json" },
  });

  if (loginRes.status !== 200) {
    errorRate.add(1);
    throw new Error(`Login failed: ${loginRes.status}`);
  }

  const body = JSON.parse(loginRes.body);
  accessToken = body.data.access_token;
  
  return { token: accessToken };
}

export default function (data) {
  const token = data.token || accessToken;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  group("Auth", function () {
    const start = new Date();
    const res = http.get(`${HOST}/api/v1/auth/me`, { headers });
    authDuration.add(new Date() - start);
    check(res, { "auth me status 200": (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  });

  group("Properties", function () {
    const start = new Date();
    const res = http.get(`${HOST}/api/v1/properties`, { headers });
    propertyListDuration.add(new Date() - start);
    check(res, { "properties status 200": (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  });

  group("Tenants", function () {
    const start = new Date();
    const res = http.get(`${HOST}/api/v1/tenants`, { headers });
    tenantListDuration.add(new Date() - start);
    check(res, { "tenants status 200": (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  });

  group("Leases", function () {
    const res = http.get(`${HOST}/api/v1/leases`, { headers });
    check(res, { "leases status 200": (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  });

  group("Payments", function () {
    const res = http.get(`${HOST}/api/v1/payments`, { headers });
    check(res, { "payments status 200": (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "./load-test-report.json": JSON.stringify(data),
  };
}

function textSummary(data, opts) {
  const indent = opts.indent || "";
  const enableColors = opts.enableColors || false;
  const cyan = enableColors ? "\x1b[36m" : "";
  const reset = enableColors ? "\x1b[0m" : "";

  let summary = `${cyan}=== Load Test Results ===${reset}\n\n`;
  
  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration;
    summary += `${indent}HTTP Request Duration:\n`;
    summary += `${indent}  avg: ${duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${duration.values["p(95)"].toFixed(2)}ms\n`;
    summary += `${indent}  max: ${duration.values.max.toFixed(2)}ms\n\n`;
  }

  if (data.metrics.errors) {
    const errors = data.metrics.errors;
    summary += `${indent}Errors: ${(errors.values.rate * 100).toFixed(2)}%\n`;
  }

  return summary;
}