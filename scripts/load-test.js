import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter, Gauge } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')
const requestDuration = new Trend('request_duration')
const activeConnections = new Gauge('active_connections')
const requestCounter = new Counter('http_requests_total')

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp-up to 10 users
    { duration: '1m', target: 50 },  // Ramp-up to 50 users
    { duration: '2m', target: 50 },  // Stay at 50 users
    { duration: '30s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.1'],                    // Error rate < 10%
    errors: ['rate<0.05'],                            // Custom error rate < 5%
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL || 'test@example.com'
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'password123'

let accessToken = ''

export function setup() {
  // Login once and get token
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, {
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  })

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  })

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body)
    return { token: body.data.access_token }
  }

  return { token: '' }
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  }

  activeConnections.add(1)

  // Test 1: List properties
  group('List Properties', () => {
    const res = http.get(`${BASE_URL}/api/v1/properties`, { headers })
    requestCounter.add(1)
    requestDuration.add(res.timings.duration)

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'response has data': (r) => JSON.parse(r.body).data !== null,
    }) || errorRate.add(1)

    sleep(1)
  })

  // Test 2: Get property detail
  group('Get Property Detail', () => {
    const res = http.get(`${BASE_URL}/api/v1/properties`, { headers })

    if (res.status === 200) {
      const body = JSON.parse(res.body)
      if (body.data && body.data.length > 0) {
        const propertyId = body.data[0].id

        const detailRes = http.get(`${BASE_URL}/api/v1/properties/${propertyId}`, { headers })
        requestCounter.add(1)
        requestDuration.add(detailRes.timings.duration)

        check(detailRes, {
          'status is 200': (r) => r.status === 200,
          'response time < 500ms': (r) => r.timings.duration < 500,
        }) || errorRate.add(1)
      }
    }

    sleep(1)
  })

  // Test 3: List leases
  group('List Leases', () => {
    const res = http.get(`${BASE_URL}/api/v1/leases`, { headers })
    requestCounter.add(1)
    requestDuration.add(res.timings.duration)

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1)

    sleep(1)
  })

  // Test 4: List payments
  group('List Payments', () => {
    const res = http.get(`${BASE_URL}/api/v1/payments`, { headers })
    requestCounter.add(1)
    requestDuration.add(res.timings.duration)

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1)

    sleep(1)
  })

  // Test 5: Health check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`)
    requestCounter.add(1)
    requestDuration.add(res.timings.duration)

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 100ms': (r) => r.timings.duration < 100,
    }) || errorRate.add(1)

    sleep(0.5)
  })

  // Test 6: Metrics endpoint
  group('Metrics Endpoint', () => {
    const res = http.get(`${BASE_URL}/metrics`)
    requestCounter.add(1)
    requestDuration.add(res.timings.duration)

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'content type is prometheus': (r) => r.headers['Content-Type'].includes('text/plain'),
    }) || errorRate.add(1)

    sleep(1)
  })

  activeConnections.add(-1)
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'test-results/load-test-summary.json': JSON.stringify(data),
  }
}

function textSummary(data, options) {
  const { indent = '', enableColors = false } = options
  const color = enableColors ? (text, color) => `\x1b[${color}m${text}\x1b[0m` : (text) => text

  let summary = '\n'
  summary += color(`${indent}Load Test Summary`, 36) + '\n'
  summary += `${indent}${'─'.repeat(60)}\n`

  const metrics = {
    'Total Requests': data.metrics?.http_requests_total?.value || 0,
    'Error Rate': `${((data.metrics?.errors?.value || 0) * 100).toFixed(2)}%`,
    'P95 Latency': `${Math.round(data.metrics?.request_duration?.values?.p(0.95) || 0)}ms`,
    'P99 Latency': `${Math.round(data.metrics?.request_duration?.values?.p(0.99) || 0)}ms`,
    'Avg Duration': `${Math.round(data.metrics?.request_duration?.values?.avg || 0)}ms`,
  }

  for (const [key, value] of Object.entries(metrics)) {
    summary += `${indent}${key.padEnd(20)}: ${value}\n`
  }

  summary += `${indent}${'─'.repeat(60)}\n`
  return summary
}
