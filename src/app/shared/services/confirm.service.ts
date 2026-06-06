import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

import { ConfirmDialogComponent } from '../component/confirm-dialog/confirm-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  private modal = inject(NgbModal);

  confirm(title: string, message: string): Observable<boolean> {
    const ref = this.modal.open(ConfirmDialogComponent, { centered: true });
    ref.componentInstance.title = title;
    ref.componentInstance.message = message;
    return ref.componentInstance.result;
  }

  confirmDelete(title: string, message: string): Observable<boolean> {
    return this.confirm(title, message);
  }
}
