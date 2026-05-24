export function normalizeTrackingText(value?: string | null): string {
  return String(value ?? '').trim();
}

export function isSameTrackingLabel(a?: string | null, b?: string | null): boolean {
  const left = normalizeTrackingText(a).toLowerCase();
  const right = normalizeTrackingText(b).toLowerCase();
  return left.length > 0 && left === right;
}

/** سطر واحد للمركبة بدون تكرار اللوحة · اللوحة */
export function formatTrackingVehicleCaption(plate?: string | null, label?: string | null): string {
  const plateText = normalizeTrackingText(plate);
  const labelText = normalizeTrackingText(label);

  if (!plateText && !labelText) {
    return '';
  }
  if (!plateText) {
    return labelText;
  }
  if (!labelText || isSameTrackingLabel(plateText, labelText)) {
    return plateText;
  }
  return `${plateText} · ${labelText}`;
}

/** عنوان فرعي (الموديل/الاسم) فقط إن كان مختلفًا عن اللوحة */
export function formatTrackingVehicleSecondary(plate?: string | null, label?: string | null): string {
  const plateText = normalizeTrackingText(plate);
  const labelText = normalizeTrackingText(label);
  if (!labelText || isSameTrackingLabel(plateText, labelText)) {
    return '';
  }
  return labelText;
}
