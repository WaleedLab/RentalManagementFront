import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { AuthService } from '../../shared/services/auth/auth.service';
import { TokenService } from '../../shared/services/storage/token.service';
import { ToastService } from '../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../shared/utils/focus-first-invalid-control.util';

function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().length > 0 ? null : { whitespace: true };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private authState = inject(AuthStateService);
  private router = inject(Router);
  private tokenService = inject(TokenService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  loading = false;
  loginDisabled = false;
  errorMessage: string | null = null;
  currentYear = new Date().getFullYear();
  parallaxX = 0;
  parallaxY = 0;

  @ViewChild('usernameInput') usernameInput?: ElementRef<HTMLInputElement>;

  form = this.fb.group({
    username: ['', [Validators.required, noWhitespaceValidator]],
    password: ['', [Validators.required, noWhitespaceValidator]],
  });

  ngOnInit(): void {
    if (this.authState.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }
    this.loading = true;
    this.errorMessage = null;
    const value = this.form.getRawValue();
    const username = value.username.trim();
    const password = value.password.trim();
    this.auth
      .login({ username, password })
      .pipe(
        finalize(() => {
          queueMicrotask(() => {
            this.loading = false;
          });
        }),
      )
      .subscribe({
        next: result => {
          queueMicrotask(() => {
            if (result.success) {
              if (!this.tokenService.getToken()) {
                const msg = this.translate.instant('Login succeeded but no auth token was stored.');
                this.errorMessage = msg;
                this.toast.error(msg);
                return;
              }

              this.toast.success(this.translate.instant('Login successful'));
              this.router.navigate(['/dashboard']);
            } else {
              const msg = this.resolveLoginError(result.message);
              this.errorMessage = msg;
              this.toast.error(msg);
              this.loginDisabled = true;
              setTimeout(() => {
                this.loginDisabled = false;
                this.usernameInput?.nativeElement.focus();
              }, 2000);
            }
          });
        },
        error: err => {
          queueMicrotask(() => {
            const message = this.resolveLoginError(err);
            this.errorMessage = message;
            this.toast.error(message);
          });
        },
      });
  }

  onShellMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    this.parallaxX = Math.max(-1, Math.min(1, x)) * 8;
    this.parallaxY = Math.max(-1, Math.min(1, y)) * 8;
  }

  onShellMouseLeave(): void {
    this.parallaxX = 0;
    this.parallaxY = 0;
  }

  private resolveLoginError(source: unknown): string {
    const fallback = this.translate.instant('Login failed. Check username and password.');

    const possibleMessages: string[] = [];
    if (typeof source === 'string') {
      possibleMessages.push(source);
    }

    const payload = source as
      | {
          message?: unknown;
          error?: { message?: unknown; errors?: unknown };
        }
      | undefined;

    if (typeof payload?.message === 'string') {
      possibleMessages.push(payload.message);
    }

    if (typeof payload?.error?.message === 'string') {
      possibleMessages.push(payload.error.message);
    }

    if (Array.isArray(payload?.error?.errors)) {
      for (const entry of payload.error.errors) {
        if (typeof entry === 'string') {
          possibleMessages.push(entry);
        }
      }
    }

    const cleaned = possibleMessages
      .map(msg => msg.trim())
      .filter(Boolean)
      .find(msg => !/(^http|localhost|404|500|api\/|http failure response)/i.test(msg));

    return cleaned ?? fallback;
  }
}
