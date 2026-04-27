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
  @Input() type: 'line' | 'bar' = 'line';
  @Input() labels: string[] = [];
  @Input() series: { label: string; values: number[]; color?: string }[] = [];
  @Input() loading = false;

  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['labels'] || changes['series'] || changes['type'] || changes['loading']) {
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
    const datasets = this.series.map((item, index) => {
      const palette = ['#7f1d3f', '#22c55e', '#f59e0b', '#ef4444'];
      const color = item.color ?? palette[index % palette.length];
      return {
        label: item.label,
        data: item.values,
        borderColor: color,
        backgroundColor: this.type === 'bar' ? `${color}bb` : `${color}33`,
        pointBackgroundColor: color,
        fill: this.type === 'line',
        tension: 0.3,
        borderWidth: 2,
        maxBarThickness: 32,
      };
    });

    const configuration: ChartConfiguration = {
      type: this.type,
      data: {
        labels: this.labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#64748b' },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.18)' },
            ticks: { color: '#64748b' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b' },
          },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, configuration);
  }
}
