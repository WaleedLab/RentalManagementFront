export type DashboardStatusTone = 'good' | 'warning' | 'risk';

export interface DashboardFilterOption {
  value: string;
  label: string;
}

export interface DashboardKpiItem {
  key: string;
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  tone: DashboardStatusTone;
}

export interface DashboardSeriesPoint {
  label: string;
  value: number;
}

export interface DashboardTableVehicle {
  vehicleName: string;
  revenue: number;
  utilization: number;
  maintenanceCost: number;
}

export interface DashboardTableCustomer {
  name: string;
  totalSpent: number;
  bookings: number;
  debt: number;
}

export interface DashboardAlert {
  type: DashboardStatusTone;
  title: string;
  description: string;
}

export interface DashboardHeatmapCell {
  day: string;
  week: string;
  bookings: number;
}

export interface DashboardSummary {
  kpis: DashboardKpiItem[];
  revenueSeries: DashboardSeriesPoint[];
  utilizationSeries: DashboardSeriesPoint[];
  topVehicles: DashboardTableVehicle[];
  topCustomers: DashboardTableCustomer[];
  alerts: DashboardAlert[];
  heatmap: DashboardHeatmapCell[];
  fleets: DashboardFilterOption[];
  branches: DashboardFilterOption[];
}

export interface DashboardSummaryFilters {
  startDate?: string;
  endDate?: string;
  fleet?: string;
  branch?: string;
}
