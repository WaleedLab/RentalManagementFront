import { MaintenanceDetail } from '../models/maintenance-detail.model';
import { sumMaintenanceDetailLines } from './maintenance-detail-total.util';

describe('sumMaintenanceDetailLines', () => {
  it('sums price and tax for each line', () => {
    const details: MaintenanceDetail[] = [
      {
        id: '1',
        idMaintenance: 10,
        idSparePartName: 1,
        idSupplier: 2,
        price: 100,
        tax: 15,
        numberInvoice: 1,
        dateInvoice: '2026-06-01',
        typeMaintenance: 0,
        isAcceptable: false,
      },
      {
        id: '2',
        idMaintenance: 10,
        idSparePartName: 3,
        idSupplier: 2,
        price: 50,
        tax: 7.5,
        numberInvoice: 2,
        dateInvoice: '2026-06-02',
        typeMaintenance: 0,
        isAcceptable: false,
      },
    ];

    expect(sumMaintenanceDetailLines(details)).toBe(172.5);
  });

  it('returns 0 for empty list', () => {
    expect(sumMaintenanceDetailLines([])).toBe(0);
  });
});
