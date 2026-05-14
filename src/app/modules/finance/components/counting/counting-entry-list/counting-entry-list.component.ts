import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, startWith } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import {
  CountingNumberOutOfRangeError,
  countingNumberByTypeValidator,
  getCountingAccountTypeRange,
} from '../../../common/counting-account-ranges';
import { getCoreCountingAccountTemplates } from '../../../common/finance-accounting-blueprints';
import {
  CountingEntry,
  CreateCountingEntryRequest,
  UpdateCountingEntryRequest,
} from '../../../models/counting/counting-entry.model';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

interface CountingTreeNode {
  id: string;
  level: number;
  name: string;
  countingNumber?: number;
  hasChildren: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-counting-entry-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    PageHeaderComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './counting-entry-list.component.html',
  styleUrl: './counting-entry-list.component.scss',
})
export class CountingEntryListComponent implements OnInit {
  /*
   * Accounting tree quick notes (saved for future reuse):
   *
   * 1) Hierarchical template source:
   *    - All suggested accounts are defined in:
   *      src/app/modules/finance/common/finance-accounting-blueprints.ts
   *    - Main structure fields:
   *      countingNumber (account number)
   *      parentCountingNumber (parent account number)
   *      countingLevel (tree level)
   *      countingType and reportNumber
   *
   * 2) Template loading inside accounting directory page:
   *    - This component calls getCoreCountingAccountTemplates()
   *      and stores the result in coreAccountTemplates.
   *
   * 3) Seed workflow (onSeedBranchAccounts):
   *    - Filters templates by range (e.g. assets 1000-1999)
   *    - Adds only missing accounts
   *    - Verifies parent exists before creating child
   *    - Sends create request via countingService
   *
   * 4) Sync workflow (onSyncBranchAccounts):
   *    - Adds missing branch accounts
   *    - Updates existing records if they differ from template
   *      (parent/type/level/name)
   *
   * 5) Tree rendering:
   *    - buildTree(...) links countingMain with parent's countingNumber
   *    - Then renders nodes in hierarchical order (parent -> child)
   */
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private countingService = inject(CountingEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  entries = signal<CountingEntry[]>([]);
  selectedId = signal<string | null>(null);
  searchTerm = signal('');
  expandedIds = signal<Set<string>>(new Set());
  selectedLegendLevel = signal<number | null>(null);

  loading = signal(false);
  saving = signal(false);
  deleting = signal(false);
  seedingCoreAccounts = signal(false);
  seedingBranchLabel = signal<string | null>(null);
  syncingCoreAccounts = signal(false);
  syncingBranchLabel = signal<string | null>(null);
  loadError = signal<string | null>(null);
  private languageTick = signal(0);
  readonly coreAccountTemplates = getCoreCountingAccountTemplates();

  readonly accountTypeOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('Assets'), value: 1 },
      { label: t('Liabilities'), value: 2 },
      { label: t('Equity'), value: 3 },
      { label: t('Revenue'), value: 4 },
      { label: t('Expenses'), value: 5 },
    ];
  });

  readonly reportNumberOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('Assets'), value: 1 },
      { label: t('Liabilities'), value: 2 },
      { label: t('Equity'), value: 3 },
      { label: t('Revenue'), value: 4 },
      { label: t('Expenses'), value: 5 },
    ];
  });

  readonly selectedEntry = computed<CountingEntry | null>(() => {
    const currentId = this.selectedId();
    if (!currentId) {
      return null;
    }

    return this.entries().find(item => item.id === currentId) ?? null;
  });

  readonly parentOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const currentNumber = this.form.controls.countingNumber.value;
    const items = this.entries()
      .filter(item => !item.isDeleted)
      .filter(item => item.countingNumber !== currentNumber)
      .sort((left, right) => this.compareEntries(left, right));

    return [
      { label: this.translate.instant('No Parent Account'), value: 0 },
      ...items.map(item => ({
        label: this.formatAccountLabel(item),
        value: item.countingNumber ?? 0,
      })),
    ];
  });

  readonly visibleNodes = computed<CountingTreeNode[]>(() => {
    this.languageTick();
    const nodes = this.buildTree(this.entries(), this.searchTerm());
    const minLevel = this.selectedLegendLevel();
    if (minLevel === null) {
      return nodes;
    }
    return nodes.filter(node => node.level <= minLevel);
  });

  readonly selectedCodeRange = computed(() =>
    getCountingAccountTypeRange(this.form.controls.countingType.value),
  );

  form = this.fb.group(
    {
      id: [''],
      countingNumber: [0, [Validators.required, Validators.min(0)]],
      countingMain: [0, [Validators.required, Validators.min(0)]],
      nameAr: ['', [Validators.required, Validators.maxLength(255)]],
      nameEn: ['', [Validators.maxLength(255)]],
      countingLevel: [1, [Validators.required, Validators.min(1)]],
      debtir: [0, [Validators.required, Validators.min(0)]],
      credit: [0, [Validators.required, Validators.min(0)]],
      balannce: [0, [Validators.required]],
      countingType: [1, [Validators.required, Validators.min(1)]],
      reportNumber: [1, [Validators.required, Validators.min(1)]],
      fleetId: ['', [Validators.required]],
    },
    { validators: countingNumberByTypeValidator() },
  );

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(value => value + 1);
    });

    this.form.controls.countingNumber.valueChanges
      .pipe(startWith(this.form.controls.countingNumber.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncParentAccountSelection());

    this.form.controls.countingType.valueChanges
      .pipe(startWith(this.form.controls.countingType.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncParentAccountSelection());

    this.form.controls.fleetId.setValue(this.authState.fleetId() ?? '');
    this.loadEntries();
    this.prepareCreateMode();
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchTerm.set(target?.value?.trim() ?? '');
  }

  onLegendLevelSelect(level: number): void {
    this.selectedLegendLevel.update(current => (current === level ? null : level));
  }

  toggleExpand(nodeId: string, event: Event): void {
    event.stopPropagation();

    this.expandedIds.update(existing => {
      const next = new Set(existing);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  selectNode(nodeId: string): void {
    const selected = this.entries().find(item => item.id === nodeId);
    if (!selected) {
      return;
    }

    this.selectedId.set(selected.id);
    this.form.patchValue({
      id: selected.id,
      countingNumber: selected.countingNumber ?? 0,
      countingMain: selected.countingMain ?? 0,
      nameAr: selected.nameAr ?? '',
      nameEn: selected.nameEn ?? '',
      countingLevel: selected.countingLevel ?? 1,
      debtir: selected.debtir ?? 0,
      credit: selected.credit ?? 0,
      balannce: selected.balannce ?? 0,
      countingType: selected.countingType ?? 1,
      reportNumber: selected.reportNumber ?? 1,
      fleetId: this.authState.fleetId() ?? this.form.controls.fleetId.value,
    });
    this.form.markAsPristine();
  }

  onAddNew(): void {
    this.prepareCreateMode();
  }

  onSeedAssetsAccounts(): Promise<void> {
    return this.onSeedBranchAccounts(1000, 1999, 'الأصول');
  }

  onSyncAssetsAccounts(): Promise<void> {
    return this.onSyncBranchAccounts(1000, 1999, 'الأصول');
  }

  onSeedLiabilitiesAccounts(): Promise<void> {
    return this.onSeedBranchAccounts(2000, 2999, 'الالتزامات');
  }

  onSyncLiabilitiesAccounts(): Promise<void> {
    return this.onSyncBranchAccounts(2000, 2999, 'الالتزامات');
  }

  onSeedEquityAccounts(): Promise<void> {
    return this.onSeedBranchAccounts(3000, 3999, 'حقوق الملكية');
  }

  onSeedRevenueAccounts(): Promise<void> {
    return this.onSeedBranchAccounts(4000, 4999, 'الإيرادات');
  }

  onSyncRevenueAccounts(): Promise<void> {
    return this.onSyncBranchAccounts(4000, 4999, 'الإيرادات');
  }

  onSeedExpenseAccounts(): Promise<void> {
    return this.onSeedBranchAccounts(5000, 5999, 'المصروفات');
  }

  onSyncExpenseAccounts(): Promise<void> {
    return this.onSyncBranchAccounts(5000, 5999, 'المصروفات');
  }

  private async onSeedBranchAccounts(
    rangeStart: number,
    rangeEnd: number,
    branchLabel: string,
  ): Promise<void> {
    if (
      this.seedingCoreAccounts() ||
      this.syncingCoreAccounts() ||
      this.saving() ||
      this.deleting() ||
      this.loading()
    ) {
      return;
    }

    const fleetId = this.authState.fleetId() ?? this.form.controls.fleetId.value;
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const existingNumbers = new Set<number>();
    for (const item of this.entries()) {
      const number = Number(item.countingNumber ?? 0);
      if (Number.isFinite(number) && number > 0) {
        existingNumbers.add(number);
      }
    }

    const missingTemplates = this.coreAccountTemplates
      .filter(
        template =>
          template.countingNumber >= rangeStart && template.countingNumber <= rangeEnd,
      )
      .filter(template => !existingNumbers.has(template.countingNumber))
      .sort((left, right) => {
        if (left.countingLevel !== right.countingLevel) {
          return left.countingLevel - right.countingLevel;
        }
        return left.countingNumber - right.countingNumber;
      });

    if (missingTemplates.length === 0) {
      this.toast.info(`كل حسابات فرع ${branchLabel} موجودة مسبقًا`);
      return;
    }

    this.seedingCoreAccounts.set(true);
    this.seedingBranchLabel.set(branchLabel);
    let createdCount = 0;
    let skippedCount = 0;

    try {
      for (const template of missingTemplates) {
        if (existingNumbers.has(template.countingNumber)) {
          continue;
        }

        if (template.parentCountingNumber > 0 && !existingNumbers.has(template.parentCountingNumber)) {
          skippedCount += 1;
          continue;
        }

        await firstValueFrom(
          this.countingService.create({
            countingNumber: template.countingNumber,
            countingMain: template.parentCountingNumber,
            countingType: template.countingType,
            reportNumber: template.reportNumber,
            countingLevel: template.countingLevel,
            debtir: 0,
            credit: 0,
            balannce: 0,
            nameAr: template.nameAr,
            nameEn: template.nameEn,
            fleetId,
          }),
        );

        existingNumbers.add(template.countingNumber);
        createdCount += 1;
      }

      if (createdCount > 0) {
        this.toast.success(`تمت تهيئة ${createdCount} حسابًا في فرع ${branchLabel}`);
      }

      if (skippedCount > 0) {
        this.toast.warning(
          this.translate.instant('Skipped {{count}} accounts because parent account was missing', {
            count: skippedCount,
          }),
        );
      }

      if (createdCount === 0 && skippedCount === 0) {
        this.toast.info(`كل حسابات فرع ${branchLabel} موجودة مسبقًا`);
      }

      this.loadEntries();
    } catch (err) {
      const errorMessage = (err as { message?: string } | null)?.message;
      this.toast.error(errorMessage ?? this.translate.instant('Failed to create recommended accounts'));
    } finally {
      this.seedingCoreAccounts.set(false);
      this.seedingBranchLabel.set(null);
    }
  }

  private async onSyncBranchAccounts(
    rangeStart: number,
    rangeEnd: number,
    branchLabel: string,
  ): Promise<void> {
    if (
      this.syncingCoreAccounts() ||
      this.seedingCoreAccounts() ||
      this.saving() ||
      this.deleting() ||
      this.loading()
    ) {
      return;
    }

    const fleetId = this.authState.fleetId() ?? this.form.controls.fleetId.value;
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const branchTemplates = this.coreAccountTemplates
      .filter(
        template =>
          template.countingNumber >= rangeStart && template.countingNumber <= rangeEnd,
      )
      .sort((left, right) => {
        if (left.countingLevel !== right.countingLevel) {
          return left.countingLevel - right.countingLevel;
        }
        return left.countingNumber - right.countingNumber;
      });

    if (branchTemplates.length === 0) {
      this.toast.info(`لا توجد قوالب لحسابات فرع ${branchLabel}`);
      return;
    }

    const existingByNumber = new Map<number, CountingEntry>();
    for (const item of this.entries()) {
      const number = Number(item.countingNumber ?? 0);
      if (Number.isFinite(number) && number > 0 && !existingByNumber.has(number)) {
        existingByNumber.set(number, item);
      }
    }

    this.syncingCoreAccounts.set(true);
    this.syncingBranchLabel.set(branchLabel);
    let createdCount = 0;
    let updatedCount = 0;

    try {
      for (const template of branchTemplates) {
        const existing = existingByNumber.get(template.countingNumber);

        if (!existing) {
          await firstValueFrom(
            this.countingService.create({
              countingNumber: template.countingNumber,
              countingMain: template.parentCountingNumber,
              countingType: template.countingType,
              reportNumber: template.reportNumber,
              countingLevel: template.countingLevel,
              debtir: 0,
              credit: 0,
              balannce: 0,
              nameAr: template.nameAr,
              nameEn: template.nameEn,
              fleetId,
            }),
          );
          createdCount += 1;
          continue;
        }

        const needsUpdate =
          Number(existing.countingMain ?? 0) !== template.parentCountingNumber ||
          Number(existing.countingType ?? 0) !== template.countingType ||
          Number(existing.reportNumber ?? 0) !== template.reportNumber ||
          Number(existing.countingLevel ?? 0) !== template.countingLevel ||
          (existing.nameAr ?? '').trim() !== template.nameAr ||
          (existing.nameEn ?? '').trim() !== template.nameEn;

        if (!needsUpdate) {
          continue;
        }

        await firstValueFrom(
          this.countingService.update({
            id: existing.id,
            countingNumber: template.countingNumber,
            countingMain: template.parentCountingNumber,
            countingType: template.countingType,
            reportNumber: template.reportNumber,
            countingLevel: template.countingLevel,
            debtir: Number(existing.debtir ?? 0),
            credit: Number(existing.credit ?? 0),
            balannce: Number(existing.balannce ?? 0),
            nameAr: template.nameAr,
            nameEn: template.nameEn,
            fleetId,
          }),
        );
        updatedCount += 1;
      }

      if (createdCount === 0 && updatedCount === 0) {
        this.toast.info(`فرع ${branchLabel} متطابق بالفعل`);
      } else {
        this.toast.success(
          `تمت مزامنة فرع ${branchLabel}: إضافة ${createdCount} وتحديث ${updatedCount}`,
        );
      }

      this.loadEntries();
    } catch (err) {
      const errorMessage = (err as { message?: string } | null)?.message;
      this.toast.error(errorMessage ?? `فشل مزامنة فرع ${branchLabel}`);
    } finally {
      this.syncingCoreAccounts.set(false);
      this.syncingBranchLabel.set(null);
    }
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      if (this.countingNumberRangeError()) {
        this.toast.error(this.countingNumberRangeMessage());
      }
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.countingMain === raw.countingNumber && raw.countingMain > 0) {
      this.toast.error(this.translate.instant('You cannot set the account as its own parent'));
      return;
    }

    const fleetId = this.authState.fleetId() ?? raw.fleetId;
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const payload: CreateCountingEntryRequest = {
      countingNumber: raw.countingNumber,
      countingMain: raw.countingMain,
      countingType: raw.countingType,
      reportNumber: raw.reportNumber,
      countingLevel: raw.countingLevel,
      debtir: raw.debtir,
      credit: raw.credit,
      balannce: raw.balannce,
      nameAr: raw.nameAr.trim(),
      nameEn: raw.nameEn.trim() || undefined,
      fleetId,
    };

    this.saving.set(true);

    const request$ = raw.id
      ? this.countingService.update({ ...payload, id: raw.id } satisfies UpdateCountingEntryRequest)
      : this.countingService.create(payload);

    request$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(
            raw.id ? 'Account updated successfully' : 'Account created successfully',
          ),
        );
        this.loadEntries(raw.id || null);
        if (!raw.id) {
          this.prepareCreateMode();
        }
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save account'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }

  onDelete(): void {
    const id = this.form.controls.id.value;
    if (!id) {
      return;
    }

    this.deleting.set(true);
    this.countingService.softDelete(id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Account deleted successfully'));
        this.selectedId.set(null);
        this.prepareCreateMode();
        this.loadEntries();
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to delete account'));
        this.deleting.set(false);
      },
      complete: () => this.deleting.set(false),
    });
  }

  private loadEntries(preferredId: string | null = null): void {
    const fleetId = this.authState.fleetId();

    this.loading.set(true);
    this.loadError.set(null);

    this.countingService.getList(fleetId).subscribe({
      next: items => {
        const activeItems = items.filter(item => !item.isDeleted);
        this.entries.set(activeItems);
        this.expandedIds.set(new Set(activeItems.map(item => item.id).filter(Boolean)));

        const candidateId = preferredId ?? this.selectedId();
        if (candidateId && activeItems.some(item => item.id === candidateId)) {
          this.selectNode(candidateId);
        }
      },
      error: err => {
        const message = err?.message ?? this.translate.instant('Failed to load accounts');
        this.loadError.set(message);
        this.toast.error(message);
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private prepareCreateMode(): void {
    const selected = this.selectedEntry();
    const suggestedParent = selected?.countingNumber ?? 0;
    const suggestedLevel = selected?.countingLevel ? selected.countingLevel + 1 : 1;

    this.selectedId.set(null);
    this.form.reset({
      id: '',
      countingNumber: 0,
      countingMain: suggestedParent,
      nameAr: '',
      nameEn: '',
      countingLevel: suggestedLevel,
      debtir: 0,
      credit: 0,
      balannce: 0,
      countingType: selected?.countingType ?? 1,
      reportNumber: selected?.reportNumber ?? 1,
      fleetId: this.authState.fleetId() ?? '',
    });

    this.syncParentAccountSelection();
  }

  private syncParentAccountSelection(): void {
    // Keep auto-parent logic only for create mode.
    if (this.form.controls.id.value) {
      return;
    }

    const currentNumber = Number(this.form.controls.countingNumber.value ?? 0);
    const currentType = Number(this.form.controls.countingType.value ?? 0);
    const currentParent = Number(this.form.controls.countingMain.value ?? 0);

    const candidates = this.entries()
      .filter(item => !item.isDeleted)
      .filter(item => Number(item.countingNumber ?? 0) > 0)
      .filter(item => Number(item.countingType ?? 0) === currentType)
      .filter(item => (currentNumber > 0 ? Number(item.countingNumber ?? 0) < currentNumber : true))
      .sort((left, right) => Number(left.countingNumber ?? 0) - Number(right.countingNumber ?? 0));

    const allowedParents = new Set<number>([0, ...candidates.map(item => Number(item.countingNumber ?? 0))]);
    if (allowedParents.has(currentParent)) {
      return;
    }

    const suggestedParent = candidates.length > 0 ? Number(candidates[candidates.length - 1].countingNumber ?? 0) : 0;
    this.form.controls.countingMain.setValue(suggestedParent);

    if (suggestedParent > 0) {
      const parent = candidates.find(item => Number(item.countingNumber ?? 0) === suggestedParent);
      const suggestedLevel = Number(parent?.countingLevel ?? 0) + 1;
      if (suggestedLevel > 0) {
        this.form.controls.countingLevel.setValue(suggestedLevel);
      }
    } else {
      this.form.controls.countingLevel.setValue(1);
    }
  }

  private buildTree(items: CountingEntry[], query: string): CountingTreeNode[] {
    const activeItems = items.filter(item => !!item.id && !item.isDeleted);
    if (activeItems.length === 0) {
      return [];
    }

    const entriesById = new Map(activeItems.map(item => [item.id, item]));
    const countingNumberToId = new Map<number, string>();
    for (const item of activeItems) {
      const number = item.countingNumber;
      if (typeof number === 'number' && !Number.isNaN(number) && !countingNumberToId.has(number)) {
        countingNumberToId.set(number, item.id);
      }
    }

    const childrenByParent = new Map<string | null, string[]>();
    const parentById = new Map<string, string | null>();

    for (const item of activeItems) {
      const parentId = this.resolveParentId(item, countingNumberToId);
      parentById.set(item.id, parentId);
      const bucket = childrenByParent.get(parentId) ?? [];
      bucket.push(item.id);
      childrenByParent.set(parentId, bucket);
    }

    const normalizedQuery = query.toLowerCase().trim();
    const visibleIds = this.resolveVisibleIds(activeItems, parentById, normalizedQuery);
    const expanded = this.expandedIds();
    const forceExpand = normalizedQuery.length > 0;

    const rows: CountingTreeNode[] = [];
    const walk = (nodeId: string, level: number): void => {
      if (!visibleIds.has(nodeId)) {
        return;
      }

      const entry = entriesById.get(nodeId);
      if (!entry) {
        return;
      }

      const children = this.sortEntryIds(
        (childrenByParent.get(nodeId) ?? []).filter(id => visibleIds.has(id)),
        entriesById,
      );
      const isExpanded = forceExpand || expanded.has(nodeId);

      rows.push({
        id: nodeId,
        level,
        name: this.getDisplayName(entry),
        countingNumber: entry.countingNumber,
        hasChildren: children.length > 0,
        expanded: isExpanded,
      });

      if (children.length > 0 && isExpanded) {
        for (const childId of children) {
          walk(childId, level + 1);
        }
      }
    };

    const roots = this.sortEntryIds(
      (childrenByParent.get(null) ?? []).filter(id => visibleIds.has(id)),
      entriesById,
    );

    for (const rootId of roots) {
      walk(rootId, 0);
    }

    return rows;
  }

  private resolveVisibleIds(
    items: CountingEntry[],
    parentById: Map<string, string | null>,
    query: string,
  ): Set<string> {
    if (!query) {
      return new Set(items.map(item => item.id));
    }

    const matchedIds = items
      .filter(item => this.entryMatchesQuery(item, query))
      .map(item => item.id);

    const visibleIds = new Set<string>(matchedIds);
    for (const matchedId of matchedIds) {
      let parent = parentById.get(matchedId) ?? null;
      while (parent) {
        visibleIds.add(parent);
        parent = parentById.get(parent) ?? null;
      }
    }

    return visibleIds;
  }

  private entryMatchesQuery(entry: CountingEntry, query: string): boolean {
    const candidate = `${entry.countingNumber ?? ''} ${entry.nameAr ?? ''} ${entry.nameEn ?? ''}`
      .toLowerCase()
      .trim();
    return candidate.includes(query);
  }

  private resolveParentId(entry: CountingEntry, byNumber: Map<number, string>): string | null {
    const parentNumber = entry.countingMain;
    if (typeof parentNumber !== 'number' || parentNumber <= 0) {
      return null;
    }

    const parentId = byNumber.get(parentNumber);
    if (!parentId || parentId === entry.id) {
      return null;
    }

    return parentId;
  }

  private compareEntries(left: CountingEntry, right: CountingEntry): number {
    const leftNumber = left.countingNumber ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.countingNumber ?? Number.MAX_SAFE_INTEGER;

    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return this.getDisplayName(left).localeCompare(
      this.getDisplayName(right),
      this.localeForSort(),
      {
        sensitivity: 'base',
      },
    );
  }

  private sortEntryIds(ids: string[], entriesById: Map<string, CountingEntry>): string[] {
    return [...ids].sort((leftId, rightId) => {
      const left = entriesById.get(leftId);
      const right = entriesById.get(rightId);
      if (!left || !right) {
        return 0;
      }
      return this.compareEntries(left, right);
    });
  }

  private getDisplayName(entry: CountingEntry): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    return (isArabic ? entry.nameAr : entry.nameEn) || entry.nameAr || entry.nameEn || '-';
  }

  private formatAccountLabel(entry: CountingEntry): string {
    const number = entry.countingNumber ?? '-';
    const name = this.getDisplayName(entry);
    return `${number} - ${name}`;
  }

  private localeForSort(): string {
    return this.translate.currentLang?.startsWith('ar') ? 'ar' : 'en';
  }

  isCountingNumberRangeInvalid(): boolean {
    return Boolean(
      this.countingNumberRangeError() &&
      (this.form.controls.countingNumber.touched || this.form.controls.countingType.touched),
    );
  }

  countingNumberRangeMessage(): string {
    const rangeError = this.countingNumberRangeError();
    if (!rangeError) {
      return '';
    }

    const typeLabel = this.translate.instant(rangeError.typeLabelKey);
    return this.translate.instant(
      'Account number must be between {{min}} and {{max}} for {{type}}.',
      {
        min: rangeError.min,
        max: rangeError.max,
        type: typeLabel,
      },
    );
  }

  private countingNumberRangeError(): CountingNumberOutOfRangeError | null {
    return (
      (this.form.errors?.['countingNumberOutOfRange'] as CountingNumberOutOfRangeError) ?? null
    );
  }

}
