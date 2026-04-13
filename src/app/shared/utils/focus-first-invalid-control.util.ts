/**
 * After `markAllAsTouched()` on a reactive form, scroll to and focus the first invalid
 * control in DOM order under `root` (usually `inject(ElementRef).nativeElement`).
 */
export function focusFirstInvalidControl(
  root: HTMLElement,
  options?: { behavior?: ScrollBehavior },
): boolean {
  if (!root) {
    return false;
  }
  const behavior = options?.behavior ?? 'smooth';

  const tryFocus = (el: HTMLElement | null): boolean => {
    if (!el) {
      return false;
    }
    el.scrollIntoView({ block: 'center', behavior });
    queueMicrotask(() => {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* some hosts are not focusable */
      }
    });
    return true;
  };

  const nativeInvalid = root.querySelector<HTMLElement>(
    'input.ng-invalid:not([type="hidden"]):not([disabled]), select.ng-invalid:not([disabled]), textarea.ng-invalid:not([disabled])',
  );
  if (nativeInvalid) {
    return tryFocus(nativeInvalid);
  }

  const customHosts = root.querySelectorAll<HTMLElement>(
    'app-smooth-select.ng-invalid, [formcontrolname].ng-invalid, [formControlName].ng-invalid',
  );
  for (const host of Array.from(customHosts)) {
    const inner =
      host.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ) ??
      host.querySelector<HTMLElement>('[tabindex]:not([tabindex="-1"]):not([disabled])');
    if (inner && tryFocus(inner)) {
      return true;
    }
    if (host.tabIndex >= 0) {
      return tryFocus(host);
    }
    host.scrollIntoView({ block: 'center', behavior });
    return true;
  }

  const fallback = root.querySelector<HTMLElement>('.ng-invalid:not(form)');
  if (fallback) {
    fallback.scrollIntoView({ block: 'center', behavior });
    queueMicrotask(() => {
      try {
        fallback.focus({ preventScroll: true });
      } catch {
        /* noop */
      }
    });
    return true;
  }

  return false;
}
