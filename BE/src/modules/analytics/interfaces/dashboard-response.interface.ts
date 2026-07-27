export interface DashboardPeriodPoint {
  period: string;
  [key: string]: string | number;
}

export interface DashboardStatusPoint {
  status: string;
  count: number;
  percentage?: number;
}
