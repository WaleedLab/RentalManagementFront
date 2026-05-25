import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-list-content-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './list-content-shell.component.html',
  styleUrl: './list-content-shell.component.scss',
})
export class ListContentShellComponent {
  readonly shellClass = input('');
}
