import { Component, inject, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  @Input() title = 'Confirm';
  @Input() message = 'Are you sure?';

  private activeModal = inject(NgbActiveModal);
  private translate = inject(TranslateService);
  private resultSubject = new Subject<boolean>();

  result = this.resultSubject.asObservable();

  get dialogDir(): 'rtl' | 'ltr' {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar') ? 'rtl' : 'ltr';
  }

  confirm(): void {
    this.resultSubject.next(true);
    this.resultSubject.complete();
    this.activeModal.close();
  }

  cancel(): void {
    this.resultSubject.next(false);
    this.resultSubject.complete();
    this.activeModal.dismiss();
  }
}
