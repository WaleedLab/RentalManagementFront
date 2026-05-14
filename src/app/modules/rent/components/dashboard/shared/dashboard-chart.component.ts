import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Chart, ChartConfiguration } from 'chart.js/auto';

@Component({
  selector: 'dashboard-chart',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './dashboard-chart.component.html',
  styleUrl: './dashboard-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() title = '';
  @Input() subtitle = '';
  @Input() type: 'line' | 'bar' | 'doughnut' = 'line';
  @Input() labels: string[] = [];
  @Input() values: number[] = [];
  /** When set (same length as `values`), used as per-segment colors for bar/doughnut. */
  @Input() segmentColors: string[] = [];
  @Input() loading = false;
  /** When true (e.g. API error), show the fallback hint instead of an empty chart. */
  @Input() dataUnavailable = false;

  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      queueMicrotask(() => this.renderChart());
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.renderChart());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['labels'] ||
      changes['values'] ||
      changes['type'] ||
      changes['loading'] ||
      changes['segmentColors'] ||
      changes['title'] ||
      changes['dataUnavailable']
    ) {
      queueMicrotask(() => this.renderChart());
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  /** Shown when the backend returned nothing usable or the chart is marked unavailable. */
  showChartFallback(): boolean {
    if (this.loading) {
      return false;
    }
    if (this.dataUnavailable) {
      return true;
    }
    return !this.hasAlignedChartSeries();
  }

  private hasAlignedChartSeries(): boolean {
    const labels = this.labels ?? [];
    const values = this.values ?? [];
    return labels.length > 0 && values.length > 0 && labels.length === values.length;
  }

  private renderChart(): void {
    if (this.loading || this.showChartFallback()) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    if (!this.canvasRef) {
      return;
    }

    this.chart?.destroy();
    const defaultBar = 'rgba(127, 29, 63, 0.7)';
    const defaultLineFill = 'rgba(127, 29, 63, 0.15)';
    const palette =
      this.segmentColors.length === this.values.length && this.values.length > 0
        ? this.segmentColors
        : this.values.map(
            (_, i) =>
              [
                'rgba(59, 130, 246, 0.75)',
                'rgba(16, 185, 129, 0.75)',
                'rgba(245, 158, 11, 0.78)',
                'rgba(139, 92, 246, 0.75)',
                'rgba(236, 72, 153, 0.75)',
                'rgba(14, 165, 233, 0.75)',
                'rgba(100, 116, 139, 0.75)',
                'rgba(234, 179, 8, 0.78)',
              ][i % 8],
          );

    const isRadial = this.type === 'doughnut';
    const isBar = this.type === 'bar';
    const datasetLabel = this.title ? this.translate.instant(this.title) : '';
    const configuration: ChartConfiguration = {
      type: isRadial ? 'doughnut' : this.type,
      data: {
        labels: this.labels,
        datasets: [
          {
            label: datasetLabel,
            data: this.values,
            borderColor: isRadial ? '#ffffff' : '#7f1d3f',
            backgroundColor: isRadial || isBar ? palette : defaultLineFill,
            pointBackgroundColor: '#7f1d3f',
            fill: this.type === 'line',
            tension: 0.35,
            borderWidth: isRadial ? 1 : 2,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: isRadial,
            position: 'bottom',
            labels: { color: '#64748b', boxWidth: 10 },
          },
        },
        scales: isRadial
          ? {}
          : {
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(148, 163, 184, 0.18)',
                },
                ticks: {
                  color: '#64748b',
                },
              },
              x: {
                grid: {
                  display: false,
                },
                ticks: {
                  color: '#64748b',
                },
              },
            },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, configuration);
  }
}
