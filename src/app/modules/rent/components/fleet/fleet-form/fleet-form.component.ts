import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../../shared/services/toast.service';
import { FileUploadComponent } from '../../../../../shared/ui/file-upload/file-upload.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';
import { FLEET_FALLBACK_IMAGE, type FleetUpsertRequest } from '../../../models';
import { FleetService } from '../../../services/fleet/fleet.service';

@Component({
  selector: 'app-fleet-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    FileUploadComponent,
    ...SHARED_FORM_FIELD_DIRECTIVES,
  ],
  templateUrl: './fleet-form.component.html',
  styleUrl: './fleet-form.component.scss',
})
export class FleetFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly FLEET_NAME_REGEX = /^[\u0600-\u06FFA-Za-z0-9\s.'-]{2,255}$/;
  private static readonly FLEET_CODE_REGEX = /^[A-Za-z0-9-_]{0,100}$/;
  private static readonly CONTACT_NUMBER_REGEX = /^(?:\+?[0-9]\s?[-()]?){7,20}$/;

  private static readonly WORKFLOW_SECTION_IDS = [
    'fleet-form-section-identity',
    'fleet-form-section-contact',
    'fleet-form-section-details',
    'fleet-form-section-branding',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fleetService = inject(FleetService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  fleetId = signal<string | null>(null);
  loadedIsActive = signal(true);
  loading = signal(false);
  selectedImage = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  readonly fleetImageFallback = FLEET_FALLBACK_IMAGE;
  private formProgressTick = signal(0);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(FleetFormComponent.FLEET_NAME_REGEX)]],
    fleetCode: ['', [Validators.maxLength(100), Validators.pattern(FleetFormComponent.FLEET_CODE_REGEX)]],
    taxNumber: ['', [Validators.maxLength(100)]],
    location: ['', [Validators.maxLength(255)]],
    contactNumber: ['', [Validators.maxLength(50), Validators.pattern(FleetFormComponent.CONTACT_NUMBER_REGEX)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(1000)]],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.name.valid && f.fleetCode.valid && f.taxNumber.valid;
  });

  contactSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.location.valid && f.contactNumber.valid && f.email.valid;
  });

  detailsSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.description.valid;
  });

  brandingSectionComplete = computed(() => {
    this.formProgressTick();
    return !!(String(this.previewUrl() ?? '').trim() || this.selectedImage());
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.contactSectionComplete()) done++;
    if (this.detailsSectionComplete()) done++;
    if (this.brandingSectionComplete()) done++;
    return Math.round((done / 4) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.contactSectionComplete()) return 2;
    if (!this.detailsSectionComplete()) return 3;
    if (!this.brandingSectionComplete()) return 4;
    return 5;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.previewUrl.set(this.fleetImageFallback);
      return;
    }

    this.isEdit.set(true);
    this.fleetId.set(id);
    this.loading.set(true);
    this.fleetService.getById(id).subscribe({
      next: fleet => {
        this.loadedIsActive.set(fleet.isActive);
        this.form.patchValue({
          name: fleet.name?.trim() ?? '',
          fleetCode: fleet.fleetCode?.trim() ?? '',
          taxNumber: fleet.taxNumber?.trim() ?? '',
          location: fleet.location?.trim() ?? '',
          contactNumber: fleet.contactNumber?.trim() ?? '',
          email: fleet.email?.trim() ?? '',
          description: fleet.description?.trim() ?? '',
        });
        this.previewUrl.set(resolveMediaUrl(fleet.url) ?? this.fleetImageFallback);
        this.formProgressTick.update(v => v + 1);
      },
      error: () => this.toast.error(this.translate.instant('Failed to load fleet')),
      complete: () => this.loading.set(false),
    });
  }

  focusWorkflowSection(step: 1 | 2 | 3 | 4): void {
    const sectionId = FleetFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('fleet-form-section--focus');
    window.setTimeout(() => section.classList.remove('fleet-form-section--focus'), 1400);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const body: FleetUpsertRequest = {
      name: raw.name.trim(),
      fleetCode: raw.fleetCode.trim() || undefined,
      taxNumber: raw.taxNumber.trim() || undefined,
      location: raw.location.trim() || undefined,
      contactNumber: raw.contactNumber.trim() || undefined,
      email: raw.email.trim() || undefined,
      description: raw.description.trim() || undefined,
      isActive: this.isEdit() ? this.loadedIsActive() : true,
      image: this.selectedImage(),
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

  onFleetPreviewError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target && target.getAttribute('src') !== this.fleetImageFallback) {
      target.setAttribute('src', this.fleetImageFallback);
    }
  }

  onImageSelected(file: File | null): void {
    this.selectedImage.set(file);
    if (file) {
      this.previewUrl.set(URL.createObjectURL(file));
    } else {
      this.previewUrl.set(this.fleetImageFallback);
    }
    this.formProgressTick.update(v => v + 1);
  }
}
