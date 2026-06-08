import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CreateBankRequest } from '../../models/banks/bank.model';
import { BankService } from '../banks/bank.service';

describe('BankService', () => {
  let service: BankService;
  let httpMock: HttpTestingController;

  const apiBase = '/Api/V1/CarRentalManagament';
  const fleetId = '11111111-0000-0000-0000-000000000001';
  const bankId = '33333333-0000-0000-0000-000000000901';
  const countingId = '99999999-0000-0000-0000-000000001102';

  const apiBank = {
    Id: bankId,
    CountingId: countingId,
    Name: 'Saudi National Bank',
    Description: 'Main operating bank account',
    Code: '1102',
    CreatedAt: '2026-05-19T09:00:00',
    UpdatedAt: '2026-05-19T09:30:00',
  };

  const createPayload: CreateBankRequest & Record<string, unknown> = {
    countingId,
    name: 'Saudi National Bank',
    description: 'Main operating bank account',
    code: '1102',
    fleetId,
    bankName: 'SNB',
    accountNumber: '1234567890',
    iban: 'SA1111111111111111111111',
    openingBalance: 0,
    initialBalance: 0,
    idBranch: 12,
    status: 1,
    nameAr: 'البنك الأهلي السعودي',
    nameEn: 'Saudi National Bank',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BankService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BankService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets all bank accounts and sends fleet query params correctly', () => {
    service.getList(fleetId).subscribe(banks => {
      expect(banks).toEqual([
        jasmine.objectContaining({
          id: bankId,
          countingId,
          name: 'Saudi National Bank',
          code: '1102',
        }),
      ]);
    });

    const req = httpMock.expectOne(request =>
      request.method === 'GET' &&
      request.url === `${apiBase}/Bank/List` &&
      request.params.get('FleetId') === fleetId &&
      request.params.get('IdFleet') === fleetId &&
      request.params.get('Fleetid') === null,
    );

    req.flush({ data: [apiBank], succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('gets an empty bank list when the API returns null data', () => {
    service.getList(fleetId).subscribe(banks => {
      expect(banks).toEqual([]);
    });

    const req = httpMock.expectOne(request =>
      request.method === 'GET' && request.url === `${apiBase}/Bank/List`,
    );

    req.flush({ data: null, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('creates a bank account using the actual Bank endpoint and preserves the body fields', () => {
    service.create(createPayload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: bankId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Bank`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(jasmine.objectContaining({
      countingId,
      name: 'Saudi National Bank',
      description: 'Main operating bank account',
      code: '1102',
      fleetId,
      bankName: 'SNB',
      accountNumber: '1234567890',
      iban: 'SA1111111111111111111111',
      openingBalance: 0,
      initialBalance: 0,
      idBranch: 12,
      status: 1,
      nameAr: 'البنك الأهلي السعودي',
      nameEn: 'Saudi National Bank',
    }));
    req.flush({ data: { id: bankId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('creates a bank account with zero opening balance when provided by the caller', () => {
    const payload: CreateBankRequest & Record<string, unknown> = {
      ...createPayload,
      openingBalance: 0,
      initialBalance: 0,
    };

    service.create(payload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: bankId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Bank`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.openingBalance).toBe(0);
    expect(req.request.body.initialBalance).toBe(0);
    req.flush({ data: { id: bankId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('passes a negative opening balance field through when the caller provides it', () => {
    const payload: CreateBankRequest & Record<string, unknown> = {
      ...createPayload,
      openingBalance: -250,
    };

    service.create(payload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: bankId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Bank`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.openingBalance).toBe(-250);
    req.flush({ data: { id: bankId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('keeps optional bank fields undefined when the service receives null-like optional input', () => {
    const payload: CreateBankRequest & Record<string, unknown> = {
      countingId,
      name: 'Minimal Bank',
      description: undefined,
      code: undefined,
      fleetId,
      bankName: undefined,
      accountNumber: undefined,
      iban: undefined,
      idBranch: null,
      status: undefined,
    };

    service.create(payload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: bankId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Bank`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(jasmine.objectContaining({
      countingId,
      name: 'Minimal Bank',
      description: undefined,
      code: undefined,
      fleetId,
      bankName: undefined,
      accountNumber: undefined,
      iban: undefined,
      idBranch: null,
      status: undefined,
    }));
    req.flush({ data: { id: bankId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('propagates API errors to the subscriber', () => {
    service.getList(fleetId).subscribe({
      next: () => fail('Expected getList to fail'),
      error: error => {
        expect(error.status).toBe(500);
        expect(error.error.errors).toEqual(['Bank API failure']);
      },
    });

    const req = httpMock.expectOne(request =>
      request.method === 'GET' && request.url === `${apiBase}/Bank/List`,
    );

    req.flush(
      { data: null, succeeded: false, errors: ['Bank API failure'], propertyErrors: {}, httpStatusCode: 500 },
      { status: 500, statusText: 'Server Error' },
    );
  });
});
