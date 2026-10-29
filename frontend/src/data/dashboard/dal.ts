import { goFetch } from "@/lib/go/client"
import { mapDashboardMetrics, type DashboardMetrics, type DashboardMetricsResponse } from "./mapper"

export type { DashboardMetrics } from "./mapper"

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await goFetch<DashboardMetricsResponse>("/api/v1/dashboard/metrics")
  return mapDashboardMetrics(res)
}
