import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Chart, ChartConfiguration } from 'chart.js/auto';

@Component({
  selector: 'accounting-chart',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './accounting-chart.component.html',
  styleUrl: './accounting-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() type: 'line' | 'bar' | 'area' = 'line';
  @Input() labels: string[] = [];
  @Input() series: { label: string; values: number[]; color?: string }[] = [];
  @Input() loading = false;
  @Input() compact = false;

  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['labels'] || changes['series'] || changes['type'] || changes['loading'] || changes['compact']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private themeVar(name: string, fallback: string): string {
    const root =
      (this.canvasRef?.nativeElement.closest('.fin-dashboard') as HTMLElement | null) ??
      document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
  }

  private renderChart(): void {
    if (!this.canvasRef || this.loading) {
      return;
    }

    this.chart?.destroy();
    const chartType = this.type === 'area' ? 'line' : this.type;
    const fillArea = this.type === 'area' || this.type === 'line';
    const tickColor = this.themeVar('--fin-chart-tick', '#334155');
    const legendColor = this.themeVar('--fin-chart-legend', tickColor);
    const gridColor = this.themeVar('--fin-chart-grid', 'rgba(15, 23, 42, 0.12)');

    const datasets = this.series.map((item, index) => {
      const palette = [
        this.themeVar('--fin-accent', '#059669'),
        this.themeVar('--fin-accent-secondary', '#2563eb'),
        this.themeVar('--fin-warning', '#d97706'),
        this.themeVar('--fin-danger', '#dc2626'),
      ];
      const color = item.color?.trim() ? item.color : palette[index % palette.length];
      return {
        label: item.label,
        data: item.values,
        borderColor: color,
        backgroundColor: fillArea ? `${color}44` : `${color}bb`,
        pointBackgroundColor: color,
        pointRadius: this.compact ? 0 : 3,
        fill: fillArea,
        tension: 0.42,
        borderWidth: 2,
        maxBarThickness: 28,
      };
    });

    const configuration: ChartConfiguration = {
      type: chartType,
      data: {
        labels: this.labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: !this.compact,
            labels: {
              color: legendColor,
              boxWidth: 12,
              font: { size: 12, weight: 600 },
              padding: 14,
            },
          },
          tooltip: {
            titleColor: legendColor,
            bodyColor: tickColor,
            backgroundColor: this.themeVar('--fin-glass', '#ffffff'),
            borderColor: this.themeVar('--fin-border', '#e2e8f0'),
            borderWidth: 1,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              maxTicksLimit: this.compact ? 4 : 8,
              font: { size: 11, weight: 500 },
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: tickColor,
              maxTicksLimit: this.compact ? 6 : 12,
              font: { size: 11, weight: 500 },
            },
          },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, configuration);
  }
}
