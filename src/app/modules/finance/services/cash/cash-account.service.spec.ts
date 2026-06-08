import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CreateCashAccountRequest } from '../../models/cash/cash-account.model';
import { CashAccountService } from './cash-account.service';

describe('CashAccountService', () => {
  let service: CashAccountService;
  let httpMock: HttpTestingController;

  const apiBase = '/Api/V1/CarRentalManagament';
  const fleetId = '11111111-0000-0000-0000-000000000001';
  const cashId = '33333333-0000-0000-0000-000000000701';
  const countingId = '99999999-0000-0000-0000-000000001101';
  const userId = '44444444-0000-0000-0000-000000000801';

  const apiCashAccount = {
    Id: cashId,
    CountingId: countingId,
    Name: 'Main Cash',
    Description: 'Primary branch cash account',
    FleetId: fleetId,
    CreatedAt: '2026-05-19T09:00:00',
    UpdatedAt: '2026-05-19T09:30:00',
  };

  const createPayload: CreateCashAccountRequest & Record<string, unknown> = {
    id: cashId,
    countingId,
    name: 'Main Cash',
    description: 'Primary branch cash account',
    createdBy: userId,
    fleetId,
    code: '1101',
    openingBalance: 0,
    initialBalance: 0,
    idBranch: 12,
    status: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CashAccountService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CashAccountService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets all cash accounts and sends fleet + branch query params correctly', () => {
    service.getList(fleetId, 12).subscribe(accounts => {
      expect(accounts).toEqual([
        jasmine.objectContaining({
          id: cashId,
          countingId,
          name: 'Main Cash',
          fleetId,
        }),
      ]);
    });

    const req = httpMock.expectOne(request =>
      request.method === 'GET' &&
      request.url === `${apiBase}/Cash/List` &&
      request.params.get('FleetId') === fleetId &&
      request.params.get('IdFleet') === fleetId &&
      request.params.get('Fleetid') === null &&
      request.params.get('IdBranch') === '12' &&
      request.params.get('idBranch') === '12',
    );

    req.flush({ data: [apiCashAccount], succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('defaults branch query param to 0 when idBranch is omitted', () => {
    service.getList(fleetId).subscribe();

    const req = httpMock.expectOne(request =>
      request.method === 'GET' &&
      request.url === `${apiBase}/Cash/List` &&
      request.params.get('IdBranch') === '0' &&
      request.params.get('idBranch') === '0',
    );

    req.flush({ data: [], succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('gets an empty cash account list when the API returns null data', () => {
    service.getList(fleetId).subscribe(accounts => {
      expect(accounts).toEqual([]);
    });

    const req = httpMock.expectOne(request =>
      request.method === 'GET' && request.url === `${apiBase}/Cash/List`,
    );

    req.flush({ data: null, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('creates a cash account with null branch for admin users without branch claim', () => {
    const adminPayload: CreateCashAccountRequest = {
      id: cashId,
      countingId,
      name: 'Fleet Cash',
      createdBy: userId,
      fleetId,
      idBranch: null,
    };

    service.create(adminPayload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: cashId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Cash`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.idBranch).toBeNull();
    expect(req.request.body.IdBranch).toBeNull();
    req.flush({ data: { id: cashId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('creates a cash account using the actual Cash endpoint and preserves the body fields', () => {
    service.create(createPayload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: cashId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Cash`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(jasmine.objectContaining({
      id: cashId,
      countingId,
      name: 'Main Cash',
      description: 'Primary branch cash account',
      createdBy: userId,
      fleetId,
      code: '1101',
      openingBalance: 0,
      initialBalance: 0,
      idBranch: 12,
      status: 1,
    }));
    req.flush({ data: { id: cashId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('creates a cash account with zero balance fields when provided by the caller', () => {
    const payload: CreateCashAccountRequest & Record<string, unknown> = {
      ...createPayload,
      openingBalance: 0,
      initialBalance: 0,
    };

    service.create(payload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: cashId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Cash`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.openingBalance).toBe(0);
    expect(req.request.body.initialBalance).toBe(0);
    req.flush({ data: { id: cashId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('passes a negative balance field through when the caller provides it', () => {
    const payload: CreateCashAccountRequest & Record<string, unknown> = {
      ...createPayload,
      openingBalance: -100,
    };

    service.create(payload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: cashId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Cash`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.openingBalance).toBe(-100);
    req.flush({ data: { id: cashId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('keeps optional fields undefined when the service receives null-like optional input', () => {
    const payload: CreateCashAccountRequest = {
      id: cashId,
      countingId,
      name: 'No description cash',
      description: undefined,
      createdBy: userId,
      fleetId,
      idBranch: null,
    };

    service.create(payload).subscribe(response => {
      expect(response).toEqual(jasmine.objectContaining({ id: cashId }));
    });

    const req = httpMock.expectOne(`${apiBase}/Cash`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(jasmine.objectContaining({
      id: cashId,
      countingId,
      name: 'No description cash',
      description: undefined,
      createdBy: userId,
      fleetId,
    }));
    req.flush({ data: { id: cashId }, succeeded: true, errors: [], propertyErrors: {}, httpStatusCode: 200 });
  });

  it('propagates API errors to the subscriber', () => {
    service.getList(fleetId).subscribe({
      next: () => fail('Expected getList to fail'),
      error: error => {
        expect(error.status).toBe(500);
        expect(error.error.errors).toEqual(['Cash API failure']);
      },
    });

    const req = httpMock.expectOne(request =>
      request.method === 'GET' && request.url === `${apiBase}/Cash/List`,
    );

    req.flush(
      { data: null, succeeded: false, errors: ['Cash API failure'], propertyErrors: {}, httpStatusCode: 500 },
      { status: 500, statusText: 'Server Error' },
    );
  });
});
