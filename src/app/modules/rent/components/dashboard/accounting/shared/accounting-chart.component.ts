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

  private themeObserver?: MutationObserver;

  ngAfterViewInit(): void {
    this.renderChart();
    this.watchThemeChanges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['labels'] || changes['series'] || changes['type'] || changes['loading'] || changes['compact']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
    this.chart?.destroy();
  }

  private watchThemeChanges(): void {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
      return;
    }
    this.themeObserver = new MutationObserver(() => this.renderChart());
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private themeHost(): HTMLElement {
    return (
      (this.canvasRef?.nativeElement.closest('app-accounting-dashboard') as HTMLElement | null) ??
      (this.canvasRef?.nativeElement.closest('.fin-dashboard') as HTMLElement | null) ??
      document.documentElement
    );
  }

  private isDarkTheme(): boolean {
    return document.body.classList.contains('dark-only');
  }

  /** Chart.js cannot parse nested `var(--token)` values — resolve to rgb/hex. */
  private resolveThemeColor(
    varName: string,
    lightFallback: string,
    darkFallback?: string,
  ): string {
    const host = this.themeHost();
    const fallback = this.isDarkTheme() ? (darkFallback ?? lightFallback) : lightFallback;
    const specified = getComputedStyle(host).getPropertyValue(varName).trim();
    if (!specified) {
      return fallback;
    }
    if (/^#|^rgb|^hsla?/i.test(specified)) {
      return specified;
    }

    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.color = specified.includes('var(') ? specified : `var(${varName})`;
    host.appendChild(probe);
    const resolved = getComputedStyle(probe).color.trim();
    host.removeChild(probe);
    return resolved && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : fallback;
  }

  private resolveThemePaint(
    varName: string,
    property: 'color' | 'backgroundColor',
    lightFallback: string,
    darkFallback?: string,
  ): string {
    const host = this.themeHost();
    const fallback = this.isDarkTheme() ? (darkFallback ?? lightFallback) : lightFallback;
    const specified = getComputedStyle(host).getPropertyValue(varName).trim();
    if (!specified) {
      return fallback;
    }
    if (/^#|^rgb|^hsla?/i.test(specified)) {
      return specified;
    }

    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    const paint = specified.includes('var(') ? specified : `var(${varName})`;
    if (property === 'backgroundColor') {
      probe.style.backgroundColor = paint;
    } else {
      probe.style.color = paint;
    }
    host.appendChild(probe);
    const resolved = getComputedStyle(probe)[property].trim();
    host.removeChild(probe);
    return resolved && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : fallback;
  }

  private renderChart(): void {
    if (!this.canvasRef || this.loading) {
      return;
    }

    this.chart?.destroy();
    const chartType = this.type === 'area' ? 'line' : this.type;
    const fillArea = this.type === 'area' || this.type === 'line';
    const tickColor = this.resolveThemeColor('--fin-chart-tick', '#334155', '#cbd5e1');
    const legendColor = this.resolveThemeColor('--fin-chart-legend', '#0f172a', '#f1f5f9');
    const gridColor = this.resolveThemePaint(
      '--fin-chart-grid',
      'backgroundColor',
      'rgba(15, 23, 42, 0.12)',
      'rgba(148, 163, 184, 0.22)',
    );

    const datasets = this.series.map((item, index) => {
      const palette = [
        this.resolveThemeColor('--fin-accent', '#059669', '#34d399'),
        this.resolveThemeColor('--fin-accent-secondary', '#2563eb', '#38bdf8'),
        this.resolveThemeColor('--fin-warning', '#d97706', '#fbbf24'),
        this.resolveThemeColor('--fin-danger', '#dc2626', '#f87171'),
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
            backgroundColor: this.resolveThemePaint(
              '--fin-glass',
              'backgroundColor',
              '#ffffff',
              '#1e293b',
            ),
            borderColor: this.resolveThemePaint(
              '--fin-border',
              'backgroundColor',
              '#e2e8f0',
              'rgba(148, 163, 184, 0.35)',
            ),
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
