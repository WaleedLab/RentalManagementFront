import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';

import { AppShellLoadingService } from '../../services/app-shell-loading.service';
import { AppVersionBadgeComponent } from '../../ui/app-version-badge/app-version-badge.component';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppVersionBadgeComponent],
  templateUrl: './loader.html',
  styleUrls: ['./loader.scss'],
})
export class Loader implements OnDestroy {
  private readonly router = inject(Router);
  private readonly shell = inject(AppShellLoadingService);
  private readonly destroyRef = inject(DestroyRef);

  /** First app paint until the initial route has finished navigating. */
  private readonly boot = signal(true);

  /** Fade-out class before removing overlay from the DOM. */
  readonly hiding = signal(false);

  readonly carSrc = signal('assets/loading/car-loading.png');

  private imgErrorStep = 0;

  private fadeTimer = 0;
  private bootFallbackTimer = 0;

  /** Boot overlay only; post-login overlay removed so navigation does not flash the shell loader. */
  readonly display = computed(() => this.boot());

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.onNavigationEnd());

    this.bootFallbackTimer = window.setTimeout(() => {
      if (this.boot()) {
        this.beginDismiss(() => {
          this.boot.set(false);
          this.clearBootFallback();
        });
      }
    }, 12000);
  }

  onCarImgError(): void {
    if (this.imgErrorStep === 0) {
      this.imgErrorStep = 1;
      this.carSrc.set('assets/loading/car-loading.gif');
      return;
    }
    if (this.imgErrorStep === 1) {
      this.imgErrorStep = 2;
      this.carSrc.set('assets/images/rent_icon/car-loading.gif');
    }
  }

  private onNavigationEnd(): void {
    if (this.boot()) {
      this.beginDismiss(() => {
        this.boot.set(false);
        this.clearBootFallback();
      });
      return;
    }
    if (this.shell.transitionActive()) {
      this.beginDismiss(() => this.shell.exitPostAuthTransition());
    }
  }

  /** Keep in sync with `.loading-screen` transition duration in loader.scss. */
  private static readonly dismissMs = 260;

  private beginDismiss(afterFade: () => void): void {
    if (this.hiding()) {
      return;
    }
    this.hiding.set(true);
    if (this.fadeTimer) {
      window.clearTimeout(this.fadeTimer);
    }
    this.fadeTimer = window.setTimeout(() => {
      afterFade();
      this.hiding.set(false);
      this.fadeTimer = 0;
    }, Loader.dismissMs);
  }

  private clearBootFallback(): void {
    if (this.bootFallbackTimer) {
      window.clearTimeout(this.bootFallbackTimer);
      this.bootFallbackTimer = 0;
    }
  }

  ngOnDestroy(): void {
    this.clearBootFallback();
    if (this.fadeTimer) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = 0;
    }
  }
}
