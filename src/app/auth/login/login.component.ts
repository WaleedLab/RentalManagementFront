import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { AuthService } from '../../shared/services/auth/auth.service';
import { LayoutService } from '../../shared/services/layout/layout.service';
import { TokenService } from '../../shared/services/storage/token.service';
import { ToastService } from '../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  private layout = inject(LayoutService);
  private translate = inject(TranslateService);

  loading = false;
  loginDisabled = false;
  errorMessage: string | null = null;

  @ViewChild('usernameInput') usernameInput?: ElementRef<HTMLInputElement>;

  form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (this.authState.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Login screen should always start in dark mode.
    this.layout.applyTheme('dark-only');
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
    this.auth.login({ username: value.username, password: value.password }).subscribe({
      next: result => {
        this.loading = false;
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
          const msg = result.message ?? this.translate.instant('Login failed. Check username and password.');
          this.errorMessage = msg;
          this.toast.error(msg);
          this.loginDisabled = true;
          setTimeout(() => {
            this.loginDisabled = false;
            this.usernameInput?.nativeElement.focus();
          }, 2000);
        }
      },
      error: err => {
        this.loading = false;
        const message =
          err?.error?.errors?.length > 0
            ? err.error.errors.join(' ')
            : err?.message ?? this.translate.instant('Login failed. Check username and password.');
        this.errorMessage = message;
        this.toast.error(message);
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
