import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
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
  @Input() title = '';
  @Input() subtitle = '';
  @Input() type: 'line' | 'bar' = 'line';
  @Input() labels: string[] = [];
  @Input() values: number[] = [];
  @Input() loading = false;

  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['labels'] || changes['values'] || changes['type'] || changes['loading']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.canvasRef || this.loading) {
      return;
    }

    this.chart?.destroy();
    const configuration: ChartConfiguration = {
      type: this.type,
      data: {
        labels: this.labels,
        datasets: [
          {
            label: this.title,
            data: this.values,
            borderColor: '#7f1d3f',
            backgroundColor: this.type === 'bar' ? 'rgba(127, 29, 63, 0.7)' : 'rgba(127, 29, 63, 0.15)',
            pointBackgroundColor: '#7f1d3f',
            fill: this.type === 'line',
            tension: 0.35,
            borderWidth: 2,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
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
