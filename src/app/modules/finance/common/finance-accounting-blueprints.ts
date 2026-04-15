/*
 * Core accounting hierarchy blueprint:
 * - This file is the source of truth for suggested chart-of-accounts templates.
 * - Each record defines:
 *   countingNumber, parentCountingNumber, countingLevel, countingType, reportNumber.
 * - Seed logic uses these templates to add missing accounts.
 * - Sync logic uses these templates to add/update accounts to match the standard structure.
 */
export interface CoreCountingAccountTemplate {
  key: string;
  countingNumber: number;
  parentCountingNumber: number;
  countingType: number;
  reportNumber: number;
  countingLevel: number;
  nameAr: string;
  nameEn: string;
}

export interface CountingAccountCandidate {
  countingNumber?: number;
  countingType?: number;
  nameAr?: string;
  nameEn?: string;
}

export type VoucherFlowRule =
  | 'RentalRevenueCollection'
  | 'RentalExpensePayment'
  | 'CustomerBookingAdvance'
  | 'CustomerSecurityDepositReceived'
  | 'CustomerSecurityDepositRefund'
  | 'LateFeeRecognition'
  | 'DamageFeeRecognition';

export type VoucherCollectionChannel = 'cash' | 'bank';

export interface VoucherFlowPreview {
  debit: CoreCountingAccountTemplate;
  credit: CoreCountingAccountTemplate;
}

const ROOT_ACCOUNTS: ReadonlyArray<CoreCountingAccountTemplate> = [
  {
    key: 'assets_root',
    countingNumber: 1000,
    parentCountingNumber: 0,
    countingType: 1,
    reportNumber: 1,
    countingLevel: 1,
    nameAr: 'الأصول',
    nameEn: 'Assets',
  },
  {
    key: 'liabilities_root',
    countingNumber: 2000,
    parentCountingNumber: 0,
    countingType: 2,
    reportNumber: 2,
    countingLevel: 1,
    nameAr: 'الالتزامات',
    nameEn: 'Liabilities',
  },
  {
    key: 'equity_root',
    countingNumber: 3000,
    parentCountingNumber: 0,
    countingType: 3,
    reportNumber: 3,
    countingLevel: 1,
    nameAr: 'حقوق الملكية',
    nameEn: 'Equity',
  },
  {
    key: 'revenue_root',
    countingNumber: 4000,
    parentCountingNumber: 0,
    countingType: 4,
    reportNumber: 4,
    countingLevel: 1,
    nameAr: 'الإيرادات',
    nameEn: 'Revenue',
  },
  {
    key: 'expenses_root',
    countingNumber: 5000,
    parentCountingNumber: 0,
    countingType: 5,
    reportNumber: 5,
    countingLevel: 1,
    nameAr: 'المصروفات',
    nameEn: 'Expenses',
  },
];

const OPERATIONAL_ACCOUNTS: ReadonlyArray<CoreCountingAccountTemplate> = [
  { key: 'current_assets_group', countingNumber: 1100, parentCountingNumber: 1000, countingType: 1, reportNumber: 1, countingLevel: 2, nameAr: 'الأصول المتداولة', nameEn: 'Current Assets' },
  { key: 'cash_equivalents_group', countingNumber: 1110, parentCountingNumber: 1100, countingType: 1, reportNumber: 1, countingLevel: 3, nameAr: 'النقدية وما في حكمها', nameEn: 'Cash and Cash Equivalents' },
  { key: 'cash', countingNumber: 1101, parentCountingNumber: 1110, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'الصندوق الرئيسي', nameEn: 'Main Cash' },
  { key: 'bank', countingNumber: 1102, parentCountingNumber: 1110, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'البنك - الحساب الجاري', nameEn: 'Bank - Current Account' },
  { key: 'sub_cash', countingNumber: 1103, parentCountingNumber: 1110, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'الصندوق الفرعي', nameEn: 'Sub Cash' },
  { key: 'bank_saving', countingNumber: 1104, parentCountingNumber: 1110, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'البنك - حساب التوفير', nameEn: 'Bank - Savings Account' },
  { key: 'petty_cash', countingNumber: 1105, parentCountingNumber: 1110, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'عهد نقدية', nameEn: 'Petty Cash' },
  { key: 'receivables_group', countingNumber: 1120, parentCountingNumber: 1100, countingType: 1, reportNumber: 1, countingLevel: 3, nameAr: 'الذمم المدينة', nameEn: 'Accounts Receivable' },
  { key: 'customers', countingNumber: 1201, parentCountingNumber: 1120, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'العملاء', nameEn: 'Customers' },
  { key: 'deferred_customer_receivables', countingNumber: 1202, parentCountingNumber: 1120, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'ذمم العملاء الآجلة', nameEn: 'Deferred Customer Receivables' },
  { key: 'checks_under_collection', countingNumber: 1203, parentCountingNumber: 1120, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'شيكات تحت التحصيل', nameEn: 'Checks Under Collection' },
  { key: 'notes_receivable', countingNumber: 1204, parentCountingNumber: 1120, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'أوراق قبض', nameEn: 'Notes Receivable' },
  { key: 'prepaid_expenses_group', countingNumber: 1130, parentCountingNumber: 1100, countingType: 1, reportNumber: 1, countingLevel: 3, nameAr: 'المصروفات المقدمة', nameEn: 'Prepaid Expenses' },
  { key: 'prepaid_rent', countingNumber: 1301, parentCountingNumber: 1130, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'إيجار مدفوع مقدمًا', nameEn: 'Prepaid Rent' },
  { key: 'prepaid_insurance', countingNumber: 1302, parentCountingNumber: 1130, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'تأمين مدفوع مقدمًا', nameEn: 'Prepaid Insurance' },
  { key: 'prepaid_licenses', countingNumber: 1303, parentCountingNumber: 1130, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'رخص وتجديدات مدفوعة مقدمًا', nameEn: 'Prepaid Licenses and Renewals' },
  { key: 'inventory_group', countingNumber: 1140, parentCountingNumber: 1100, countingType: 1, reportNumber: 1, countingLevel: 3, nameAr: 'المخزون والمواد', nameEn: 'Inventory and Supplies' },
  { key: 'oil_inventory', countingNumber: 1401, parentCountingNumber: 1140, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'مخزون زيوت', nameEn: 'Oil Inventory' },
  { key: 'tire_inventory', countingNumber: 1402, parentCountingNumber: 1140, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'مخزون إطارات', nameEn: 'Tire Inventory' },
  { key: 'spare_parts_inventory', countingNumber: 1403, parentCountingNumber: 1140, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'قطع غيار', nameEn: 'Spare Parts Inventory' },
  { key: 'operating_supplies', countingNumber: 1404, parentCountingNumber: 1140, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'مواد تشغيل وصيانة', nameEn: 'Operating and Maintenance Supplies' },
  { key: 'non_current_assets_group', countingNumber: 1200, parentCountingNumber: 1000, countingType: 1, reportNumber: 1, countingLevel: 2, nameAr: 'الأصول غير المتداولة', nameEn: 'Non-Current Assets' },
  { key: 'fixed_assets_group', countingNumber: 1210, parentCountingNumber: 1200, countingType: 1, reportNumber: 1, countingLevel: 3, nameAr: 'الأصول الثابتة', nameEn: 'Fixed Assets' },
  { key: 'rental_cars', countingNumber: 1501, parentCountingNumber: 1210, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'السيارات المعدة للتأجير', nameEn: 'Rental Vehicles' },
  { key: 'administrative_cars', countingNumber: 1502, parentCountingNumber: 1210, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'السيارات الإدارية', nameEn: 'Administrative Vehicles' },
  { key: 'furniture_and_fixtures', countingNumber: 1503, parentCountingNumber: 1210, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'الأثاث والمكاتب', nameEn: 'Furniture and Fixtures' },
  { key: 'computers_and_printers', countingNumber: 1504, parentCountingNumber: 1210, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'أجهزة الحاسب والطابعات', nameEn: 'Computers and Printers' },
  { key: 'tracking_devices', countingNumber: 1505, parentCountingNumber: 1210, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'أجهزة التتبع والمراقبة', nameEn: 'Tracking and Monitoring Devices' },
  { key: 'accumulated_depreciation_group', countingNumber: 1220, parentCountingNumber: 1200, countingType: 1, reportNumber: 1, countingLevel: 3, nameAr: 'مجمع الإهلاك', nameEn: 'Accumulated Depreciation' },
  { key: 'accumulated_depreciation', countingNumber: 1591, parentCountingNumber: 1220, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'مجمع إهلاك السيارات المعدة للتأجير', nameEn: 'Accumulated Depreciation - Rental Vehicles' },
  { key: 'accumulated_depreciation_admin_vehicles', countingNumber: 1592, parentCountingNumber: 1220, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'مجمع إهلاك السيارات الإدارية', nameEn: 'Accumulated Depreciation - Administrative Vehicles' },
  { key: 'accumulated_depreciation_furniture', countingNumber: 1593, parentCountingNumber: 1220, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'مجمع إهلاك الأثاث والمكاتب', nameEn: 'Accumulated Depreciation - Furniture and Fixtures' },
  { key: 'accumulated_depreciation_computers', countingNumber: 1594, parentCountingNumber: 1220, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'مجمع إهلاك أجهزة الحاسب', nameEn: 'Accumulated Depreciation - Computers' },
  { key: 'other_assets_group', countingNumber: 1230, parentCountingNumber: 1200, countingType: 1, reportNumber: 1, countingLevel: 3, nameAr: 'أصول أخرى', nameEn: 'Other Assets' },
  { key: 'refundable_deposits', countingNumber: 1601, parentCountingNumber: 1230, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'تأمينات مستردة لدى الغير', nameEn: 'Refundable Deposits' },
  { key: 'statutory_deposits', countingNumber: 1602, parentCountingNumber: 1230, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'ودائع نظامية', nameEn: 'Statutory Deposits' },
  { key: 'software_systems_asset', countingNumber: 1603, parentCountingNumber: 1230, countingType: 1, reportNumber: 1, countingLevel: 4, nameAr: 'برامج وأنظمة', nameEn: 'Software and Systems' },
  { key: 'current_liabilities_group', countingNumber: 2100, parentCountingNumber: 2000, countingType: 2, reportNumber: 2, countingLevel: 2, nameAr: 'الالتزامات المتداولة', nameEn: 'Current Liabilities' },
  { key: 'suppliers_creditors_group', countingNumber: 2110, parentCountingNumber: 2100, countingType: 2, reportNumber: 2, countingLevel: 3, nameAr: 'الموردون والدائنون', nameEn: 'Suppliers and Creditors' },
  { key: 'suppliers', countingNumber: 2101, parentCountingNumber: 2110, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'الموردون', nameEn: 'Suppliers' },
  { key: 'misc_creditors', countingNumber: 2102, parentCountingNumber: 2110, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'دائنون متنوعون', nameEn: 'Miscellaneous Creditors' },
  { key: 'accrued_expenses', countingNumber: 2103, parentCountingNumber: 2110, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'مصاريف مستحقة', nameEn: 'Accrued Expenses' },
  { key: 'operating_liabilities_group', countingNumber: 2120, parentCountingNumber: 2100, countingType: 2, reportNumber: 2, countingLevel: 3, nameAr: 'الالتزامات التشغيلية', nameEn: 'Operating Liabilities' },
  { key: 'accrued_salaries', countingNumber: 2204, parentCountingNumber: 2120, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'رواتب مستحقة', nameEn: 'Accrued Salaries' },
  { key: 'accrued_rent', countingNumber: 2205, parentCountingNumber: 2120, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'إيجارات مستحقة', nameEn: 'Accrued Rent' },
  { key: 'accrued_utilities', countingNumber: 2206, parentCountingNumber: 2120, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'كهرباء ومياه مستحقة', nameEn: 'Accrued Utilities' },
  { key: 'accrued_maintenance', countingNumber: 2207, parentCountingNumber: 2120, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'صيانة مستحقة', nameEn: 'Accrued Maintenance' },
  { key: 'taxes_group', countingNumber: 2130, parentCountingNumber: 2100, countingType: 2, reportNumber: 2, countingLevel: 3, nameAr: 'ضرائب وزكاة ورسوم', nameEn: 'Taxes, Zakat and Fees' },
  { key: 'vat_payable', countingNumber: 2301, parentCountingNumber: 2130, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'ضريبة القيمة المضافة المستحقة', nameEn: 'VAT Payable' },
  { key: 'zakat_payable', countingNumber: 2302, parentCountingNumber: 2130, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'زكاة مستحقة', nameEn: 'Zakat Payable' },
  { key: 'gov_fees_payable', countingNumber: 2303, parentCountingNumber: 2130, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'رسوم حكومية مستحقة', nameEn: 'Government Fees Payable' },
  { key: 'customer_advances_group', countingNumber: 2140, parentCountingNumber: 2100, countingType: 2, reportNumber: 2, countingLevel: 3, nameAr: 'عربون وتأمينات العملاء', nameEn: 'Customer Advances and Deposits' },
  { key: 'booking_advance', countingNumber: 2201, parentCountingNumber: 2140, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'عربون حجوزات العملاء', nameEn: 'Customer Booking Advances' },
  { key: 'security_deposit', countingNumber: 2202, parentCountingNumber: 2140, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'تأمينات مستلمة من العملاء', nameEn: 'Customer Security Deposits' },
  { key: 'pending_customer_balances', countingNumber: 2203, parentCountingNumber: 2140, countingType: 2, reportNumber: 2, countingLevel: 4, nameAr: 'مبالغ معلقة للعملاء', nameEn: 'Pending Customer Balances' },
  { key: 'non_current_liabilities_group', countingNumber: 2300, parentCountingNumber: 2000, countingType: 2, reportNumber: 2, countingLevel: 2, nameAr: 'الالتزامات غير المتداولة', nameEn: 'Non-Current Liabilities' },
  { key: 'long_term_loans', countingNumber: 2401, parentCountingNumber: 2300, countingType: 2, reportNumber: 2, countingLevel: 3, nameAr: 'قروض طويلة الأجل', nameEn: 'Long-Term Loans' },
  { key: 'lease_obligations', countingNumber: 2402, parentCountingNumber: 2300, countingType: 2, reportNumber: 2, countingLevel: 3, nameAr: 'التزامات عقود الإيجار', nameEn: 'Lease Contract Obligations' },
  { key: 'vehicle_long_term_financing', countingNumber: 2403, parentCountingNumber: 2300, countingType: 2, reportNumber: 2, countingLevel: 3, nameAr: 'تمويل سيارات طويل الأجل', nameEn: 'Long-Term Vehicle Financing' },
  { key: 'capital', countingNumber: 3101, parentCountingNumber: 3000, countingType: 3, reportNumber: 3, countingLevel: 2, nameAr: 'رأس المال', nameEn: 'Capital' },
  { key: 'owner_current_accounts', countingNumber: 3201, parentCountingNumber: 3000, countingType: 3, reportNumber: 3, countingLevel: 2, nameAr: 'جاري الشركاء / المالك', nameEn: 'Owners Current Accounts' },
  { key: 'statutory_reserve', countingNumber: 3301, parentCountingNumber: 3000, countingType: 3, reportNumber: 3, countingLevel: 2, nameAr: 'الاحتياطي النظامي', nameEn: 'Statutory Reserve' },
  { key: 'retained_earnings', countingNumber: 3401, parentCountingNumber: 3000, countingType: 3, reportNumber: 3, countingLevel: 2, nameAr: 'الأرباح المبقاة', nameEn: 'Retained Earnings' },
  { key: 'period_profit_loss', countingNumber: 3501, parentCountingNumber: 3000, countingType: 3, reportNumber: 3, countingLevel: 2, nameAr: 'صافي الربح / الخسارة للفترة', nameEn: 'Net Profit / Loss for the Period' },
  { key: 'rental_revenue_group', countingNumber: 4100, parentCountingNumber: 4000, countingType: 4, reportNumber: 4, countingLevel: 2, nameAr: 'إيرادات النشاط الرئيسي', nameEn: 'Main Rental Revenue' },
  { key: 'daily_rental_revenue', countingNumber: 4101, parentCountingNumber: 4100, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'إيرادات التأجير اليومي', nameEn: 'Daily Rental Revenue' },
  { key: 'monthly_rental_revenue', countingNumber: 4102, parentCountingNumber: 4100, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'إيرادات التأجير الشهري', nameEn: 'Monthly Rental Revenue' },
  { key: 'weekly_rental_revenue', countingNumber: 4103, parentCountingNumber: 4100, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'إيرادات تأجير أسبوعي', nameEn: 'Weekly Rental Revenue' },
  { key: 'rental_extension_revenue', countingNumber: 4104, parentCountingNumber: 4100, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'إيرادات تمديد عقود التأجير', nameEn: 'Rental Contract Extension Revenue' },
  { key: 'rental_related_revenue_group', countingNumber: 4200, parentCountingNumber: 4000, countingType: 4, reportNumber: 4, countingLevel: 2, nameAr: 'إيرادات تشغيلية مرتبطة بالتأجير', nameEn: 'Rental Related Operating Revenue' },
  { key: 'late_fees_revenue', countingNumber: 4201, parentCountingNumber: 4200, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'رسوم تأخير', nameEn: 'Late Fees Revenue' },
  { key: 'damage_fees_revenue', countingNumber: 4202, parentCountingNumber: 4200, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'رسوم أضرار محصلة من العميل', nameEn: 'Customer Damage Fees Revenue' },
  { key: 'delivery_pickup_fees', countingNumber: 4203, parentCountingNumber: 4200, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'رسوم تسليم واستلام', nameEn: 'Delivery and Pickup Fees' },
  { key: 'additional_driver_fees', countingNumber: 4204, parentCountingNumber: 4200, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'رسوم سائق إضافي', nameEn: 'Additional Driver Fees' },
  { key: 'extra_km_fees', countingNumber: 4205, parentCountingNumber: 4200, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'رسوم زيادة الكيلومترات', nameEn: 'Extra Kilometers Fees' },
  { key: 'car_cleaning_fees_revenue', countingNumber: 4206, parentCountingNumber: 4200, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'رسوم تنظيف', nameEn: 'Car Cleaning Fees' },
  { key: 'other_revenue_group', countingNumber: 4300, parentCountingNumber: 4000, countingType: 4, reportNumber: 4, countingLevel: 2, nameAr: 'إيرادات أخرى', nameEn: 'Other Revenue' },
  { key: 'used_cars_sale_revenue', countingNumber: 4301, parentCountingNumber: 4300, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'إيراد بيع سيارات مستعملة', nameEn: 'Used Car Sale Revenue' },
  { key: 'misc_revenue', countingNumber: 4302, parentCountingNumber: 4300, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'إيرادات متنوعة', nameEn: 'Miscellaneous Revenue' },
  { key: 'earned_discounts', countingNumber: 4303, parentCountingNumber: 4300, countingType: 4, reportNumber: 4, countingLevel: 3, nameAr: 'خصومات مكتسبة', nameEn: 'Earned Discounts' },
  { key: 'direct_operating_expenses_group', countingNumber: 5100, parentCountingNumber: 5000, countingType: 5, reportNumber: 5, countingLevel: 2, nameAr: 'مصروفات تشغيلية مباشرة', nameEn: 'Direct Operating Expenses' },
  { key: 'fuel_expense', countingNumber: 5101, parentCountingNumber: 5100, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروف وقود', nameEn: 'Fuel Expense' },
  { key: 'vehicle_maintenance_expense', countingNumber: 5102, parentCountingNumber: 5100, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروف صيانة السيارات', nameEn: 'Vehicle Maintenance Expense' },
  { key: 'oil_spare_parts_expense', countingNumber: 5103, parentCountingNumber: 5100, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروف زيوت وقطع غيار', nameEn: 'Oil and Spare Parts Expense' },
  { key: 'car_washing_expense', countingNumber: 5104, parentCountingNumber: 5100, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروف غسيل وتنظيف السيارات', nameEn: 'Car Washing and Cleaning Expense' },
  { key: 'vehicle_insurance_expense', countingNumber: 5105, parentCountingNumber: 5100, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروف تأمين السيارات', nameEn: 'Vehicle Insurance Expense' },
  { key: 'inspection_licensing_expense', countingNumber: 5106, parentCountingNumber: 5100, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروف فحص وتجديد ورخص', nameEn: 'Inspection, Renewal and Licensing Expense' },
  { key: 'vehicle_depreciation_expense', countingNumber: 5107, parentCountingNumber: 5100, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'إهلاك السيارات المعدة للتأجير', nameEn: 'Vehicle Depreciation Expense' },
  { key: 'admin_general_expenses_group', countingNumber: 5200, parentCountingNumber: 5000, countingType: 5, reportNumber: 5, countingLevel: 2, nameAr: 'مصروفات إدارية وعمومية', nameEn: 'Administrative and General Expenses' },
  { key: 'operating_expenses', countingNumber: 5201, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'الرواتب والأجور', nameEn: 'Salaries and Wages' },
  { key: 'allowances_benefits_expense', countingNumber: 5202, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'بدلات ومزايا', nameEn: 'Allowances and Benefits' },
  { key: 'office_rent_expense', countingNumber: 5203, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'إيجار المكتب / الفرع', nameEn: 'Office / Branch Rent Expense' },
  { key: 'utilities_telecom_expense', countingNumber: 5204, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'كهرباء ومياه واتصالات', nameEn: 'Utilities and Telecom Expense' },
  { key: 'stationery_printing_expense', countingNumber: 5205, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'قرطاسية ومطبوعات', nameEn: 'Stationery and Printing Expense' },
  { key: 'software_systems_expense', countingNumber: 5206, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروفات برامج وأنظمة', nameEn: 'Software and Systems Expense' },
  { key: 'bank_charges_expense', countingNumber: 5207, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'مصروفات بنكية', nameEn: 'Bank Charges Expense' },
  { key: 'furniture_equipment_depreciation_expense', countingNumber: 5208, parentCountingNumber: 5200, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'إهلاك الأثاث والأجهزة', nameEn: 'Furniture and Equipment Depreciation Expense' },
  { key: 'marketing_expenses_group', countingNumber: 5300, parentCountingNumber: 5000, countingType: 5, reportNumber: 5, countingLevel: 2, nameAr: 'مصروفات تسويقية', nameEn: 'Marketing Expenses' },
  { key: 'marketing_ads_expense', countingNumber: 5301, parentCountingNumber: 5300, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'إعلانات وتسويق', nameEn: 'Advertising and Marketing Expense' },
  { key: 'sales_commission_expense', countingNumber: 5302, parentCountingNumber: 5300, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'عمولات مبيعات', nameEn: 'Sales Commission Expense' },
  { key: 'allowed_discounts_expense', countingNumber: 5303, parentCountingNumber: 5300, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'عروض وخصومات مسموحة', nameEn: 'Allowed Discounts Expense' },
  { key: 'financial_expenses_group', countingNumber: 5400, parentCountingNumber: 5000, countingType: 5, reportNumber: 5, countingLevel: 2, nameAr: 'مصروفات مالية', nameEn: 'Financial Expenses' },
  { key: 'loan_interest_expense', countingNumber: 5401, parentCountingNumber: 5400, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'فوائد قروض', nameEn: 'Loan Interest Expense' },
  { key: 'financing_fees_expense', countingNumber: 5402, parentCountingNumber: 5400, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'رسوم تمويل', nameEn: 'Financing Fees Expense' },
  { key: 'bank_difference_losses_expense', countingNumber: 5403, parentCountingNumber: 5400, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'خسائر فروقات بنكية', nameEn: 'Bank Difference Losses Expense' },
  { key: 'other_expenses_group', countingNumber: 5500, parentCountingNumber: 5000, countingType: 5, reportNumber: 5, countingLevel: 2, nameAr: 'مصروفات أخرى', nameEn: 'Other Expenses' },
  { key: 'asset_disposal_losses_expense', countingNumber: 5501, parentCountingNumber: 5500, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'خسائر بيع أصول', nameEn: 'Asset Disposal Losses' },
  { key: 'bad_debts_expense', countingNumber: 5502, parentCountingNumber: 5500, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'ديون معدومة', nameEn: 'Bad Debts Expense' },
  { key: 'fines_penalties_expense', countingNumber: 5503, parentCountingNumber: 5500, countingType: 5, reportNumber: 5, countingLevel: 3, nameAr: 'غرامات ومخالفات', nameEn: 'Fines and Penalties Expense' },
];

export const CORE_COUNTING_ACCOUNT_TEMPLATES: ReadonlyArray<CoreCountingAccountTemplate> = [
  ...ROOT_ACCOUNTS,
  ...OPERATIONAL_ACCOUNTS,
];

const TEMPLATE_BY_KEY = new Map(
  CORE_COUNTING_ACCOUNT_TEMPLATES.map(template => [template.key, template]),
);

const CASH_NUMBER = TEMPLATE_BY_KEY.get('cash')?.countingNumber ?? 1101;
const BANK_NUMBER = TEMPLATE_BY_KEY.get('bank')?.countingNumber ?? 1102;

export function getCoreCountingAccountTemplates(): ReadonlyArray<CoreCountingAccountTemplate> {
  return CORE_COUNTING_ACCOUNT_TEMPLATES;
}

export function getCoreTemplateByKey(key: string): CoreCountingAccountTemplate | undefined {
  return TEMPLATE_BY_KEY.get(key);
}

export function getOperationalCountingAccountTemplates(): ReadonlyArray<CoreCountingAccountTemplate> {
  return OPERATIONAL_ACCOUNTS;
}

export function resolveVoucherFlow(
  rule: VoucherFlowRule,
  channel: VoucherCollectionChannel,
): VoucherFlowPreview {
  const cashOrBankAccount = channel === 'bank' ? 'bank' : 'cash';

  switch (rule) {
    case 'RentalExpensePayment':
      return {
        debit: requireTemplate('fuel_expense'),
        credit: requireTemplate(cashOrBankAccount),
      };
    case 'CustomerBookingAdvance':
      return {
        debit: requireTemplate(cashOrBankAccount),
        credit: requireTemplate('booking_advance'),
      };
    case 'CustomerSecurityDepositReceived':
      return {
        debit: requireTemplate(cashOrBankAccount),
        credit: requireTemplate('security_deposit'),
      };
    case 'CustomerSecurityDepositRefund':
      return {
        debit: requireTemplate('security_deposit'),
        credit: requireTemplate(cashOrBankAccount),
      };
    case 'LateFeeRecognition':
      return {
        debit: requireTemplate('customers'),
        credit: requireTemplate('late_fees_revenue'),
      };
    case 'DamageFeeRecognition':
      return {
        debit: requireTemplate('customers'),
        credit: requireTemplate('damage_fees_revenue'),
      };
    case 'RentalRevenueCollection':
    default:
      return {
        debit: requireTemplate(cashOrBankAccount),
        credit: requireTemplate('daily_rental_revenue'),
      };
  }
}

export function isCashCountingCandidate(entry: CountingAccountCandidate): boolean {
  if (!entry) {
    return false;
  }

  if (Number(entry.countingNumber) === CASH_NUMBER) {
    return true;
  }

  if (Number(entry.countingType ?? 0) !== 1) {
    return false;
  }

  const searchable = normalizeSearchableName(entry);
  return searchable.includes('cash') || searchable.includes('صندوق');
}

export function isBankCountingCandidate(entry: CountingAccountCandidate): boolean {
  if (!entry) {
    return false;
  }

  if (Number(entry.countingNumber) === BANK_NUMBER) {
    return true;
  }

  if (Number(entry.countingType ?? 0) !== 1) {
    return false;
  }

  const searchable = normalizeSearchableName(entry);
  return searchable.includes('bank') || searchable.includes('بنك');
}

function requireTemplate(key: string): CoreCountingAccountTemplate {
  const template = TEMPLATE_BY_KEY.get(key);
  if (!template) {
    throw new Error(`Missing core accounting template for key: ${key}`);
  }

  return template;
}

function normalizeSearchableName(entry: CountingAccountCandidate): string {
  return `${entry.nameAr ?? ''} ${entry.nameEn ?? ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
