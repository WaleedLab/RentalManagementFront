import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-list-command-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './list-command-bar.component.html',
  styleUrl: './list-command-bar.component.scss',
})
export class ListCommandBarComponent {
  readonly title = input.required<string>();
  /** Plain text (not translated), shown under the title. */
  readonly subtitle = input('');
  readonly iconSrc = input('');
  readonly commandClass = input('');
  readonly toolbarClass = input('');
}
