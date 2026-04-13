import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FleetUpsertRequest } from '../../../models';
import { FleetService } from '../../../services/fleet/fleet.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-fleet-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './fleet-form.component.html',
  styleUrl: './fleet-form.component.scss',
})
export class FleetFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly FLEET_NAME_REGEX = /^[\u0600-\u06FFA-Za-z0-9\s.'-]{2,255}$/;
  private static readonly FLEET_CODE_REGEX = /^[A-Za-z0-9-_]{0,100}$/;
  private static readonly CONTACT_NUMBER_REGEX = /^(?:(?:\+966|00966)(?:5\d{8}|1\d{8})|0(?:5\d{8}|1\d{8}))$/;

  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fleetService = inject(FleetService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  fleetId = signal<string | null>(null);
  loading = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(FleetFormComponent.FLEET_NAME_REGEX)]],
    fleetCode: ['', [Validators.maxLength(100), Validators.pattern(FleetFormComponent.FLEET_CODE_REGEX)]],
    location: ['', [Validators.maxLength(255)]],
    contactNumber: ['', [Validators.maxLength(50), Validators.pattern(FleetFormComponent.CONTACT_NUMBER_REGEX)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(1000)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isEdit.set(true);
    this.fleetId.set(id);
    this.loading.set(true);
    this.fleetService.getById(id).subscribe({
      next: fleet => {
        this.form.patchValue({
          name: fleet.name,
          fleetCode: fleet.fleetCode || '',
          location: fleet.location || '',
          contactNumber: fleet.contactNumber || '',
          email: fleet.email || '',
          description: fleet.description || '',
        });
      },
      error: () => this.toast.error(this.translate.instant('Failed to load fleet')),
      complete: () => this.loading.set(false),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const body: FleetUpsertRequest = {
      name: raw.name,
      fleetCode: raw.fleetCode || undefined,
      location: raw.location || undefined,
      contactNumber: raw.contactNumber || undefined,
      email: raw.email || undefined,
      description: raw.description || undefined,
    };

    this.loading.set(true);
    const request$ = this.fleetId()
      ? this.fleetService.update({ ...body, id: this.fleetId()! })
      : this.fleetService.create(body);

    request$.subscribe({
      next: () => {
        this.toast.success(this.translate.instant(this.isEdit() ? 'Fleet updated' : 'Fleet created'));
        this.router.navigate(['/fleet']);
      },
      error: () => {
        this.toast.error(this.translate.instant('Failed to save fleet'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}






