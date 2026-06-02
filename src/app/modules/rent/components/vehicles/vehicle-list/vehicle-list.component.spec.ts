import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VehicleListComponent } from './vehicle-list.component';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import { BranchService } from '../../../services/branches/branch.service';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

describe('VehicleListComponent', () => {
  let component: VehicleListComponent;
  let fixture: ComponentFixture<VehicleListComponent>;
  let vehicleServiceSpy: jasmine.SpyObj<VehicleService>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let categoryVehicleServiceSpy: jasmine.SpyObj<CategoryVehicleService>;
  let authStateSpy: jasmine.SpyObj<AuthStateService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let confirmServiceSpy: jasmine.SpyObj<ConfirmService>;
  let modalSpy: jasmine.SpyObj<NgbModal>;
  let translateServiceSpy: jasmine.SpyObj<TranslateService>;

  const mockVehicle = {
    id: 'vehicle-1',
    plateNumber: 'ABC-1234',
    make: 'Toyota',
    model: 'Camry',
    year: 2023,
    status: 'Available' as const,
    dailyRate: 50,
    imageUrl: 'https://example.com/vehicle.jpg',
    branchId: 1,
    branchName: 'Main Branch',
    categoryName: 'Sedan',
  };

  const mockPaginatedResponse = {
    items: [mockVehicle],
    pageNumber: 1,
    pageSize: 10,
    totalCount: 1,
    totalPages: 1,
  };

  const mockStatusCountsResponse = {
    totalCount: 5,
    statusCounts: [
      { status: 'IsAvalible', statusDisplayName: 'Available', count: 3, includedStatuses: [] },
      { status: 'IsBooking', statusDisplayName: 'Booked', count: 2, includedStatuses: [] },
    ],
  };

  const mockExpirationCountsResponse = {
    nextDays: 15,
    items: [
      { key: 'insurance', label: 'Insurance expired', expiredCount: 2, expiringSoonCount: 1 },
      { key: 'periodicInspection', label: 'Inspection expired', expiredCount: 0, expiringSoonCount: 3 },
      { key: 'operatingCard', label: 'Operating card expired', expiredCount: 1, expiringSoonCount: 0 },
      { key: 'carRegistration', label: 'Registration expired', expiredCount: 4, expiringSoonCount: 2 },
    ],
  };

  beforeEach(async () => {
    const vehicleServiceMock = jasmine.createSpyObj('VehicleService', [
      'getPaginated',
      'getStatusCounts',
      'getExpirationCounts',
      'changeStatus',
      'softDelete',
    ]);
    const branchServiceMock = jasmine.createSpyObj('BranchService', ['getList']);
    const categoryVehicleServiceMock = jasmine.createSpyObj('CategoryVehicleService', ['getList']);
    const authStateMock = jasmine.createSpyObj('AuthStateService', [], {
      fleetId: signal('fleet-1'),
    });
    const toastServiceMock = jasmine.createSpyObj('ToastService', ['success', 'error']);
    const confirmServiceMock = jasmine.createSpyObj('ConfirmService', ['confirm']);
    const modalMock = jasmine.createSpyObj('NgbModal', ['open']);
    const translateServiceMock = jasmine.createSpyObj('TranslateService', ['instant']);
    translateServiceMock.currentLang = 'en';
    translateServiceMock.getDefaultLang = jasmine.createSpy().and.returnValue('en');
    (translateServiceMock as any).onLangChange = { pipe: jasmine.createSpy().and.returnValue(of({})) };

    await TestBed.configureTestingModule({
      imports: [VehicleListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: VehicleService, useValue: vehicleServiceMock },
        { provide: BranchService, useValue: branchServiceMock },
        { provide: CategoryVehicleService, useValue: categoryVehicleServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: ConfirmService, useValue: confirmServiceMock },
        { provide: NgbModal, useValue: modalMock },
        { provide: TranslateService, useValue: translateServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleListComponent);
    component = fixture.componentInstance;
    vehicleServiceSpy = TestBed.inject(VehicleService) as jasmine.SpyObj<VehicleService>;
    branchServiceSpy = TestBed.inject(BranchService) as jasmine.SpyObj<BranchService>;
    categoryVehicleServiceSpy = TestBed.inject(CategoryVehicleService) as jasmine.SpyObj<CategoryVehicleService>;
    authStateSpy = TestBed.inject(AuthStateService) as jasmine.SpyObj<AuthStateService>;
    toastServiceSpy = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    confirmServiceSpy = TestBed.inject(ConfirmService) as jasmine.SpyObj<ConfirmService>;
    modalSpy = TestBed.inject(NgbModal) as jasmine.SpyObj<NgbModal>;
    translateServiceSpy = TestBed.inject(TranslateService) as jasmine.SpyObj<TranslateService>;
  });

  describe('initialization', () => {
    it('should create component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.pageNumber()).toBe(1);
      expect(component.pageSize()).toBe(10);
      expect(component.search()).toBe('');
      expect(component.vehicles().length).toBe(0);
    });

    it('should load vehicles, branches, categories, and status counts on init', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      fixture.detectChanges();

      setTimeout(() => {
        expect(vehicleServiceSpy.getPaginated).toHaveBeenCalled();
        expect(vehicleServiceSpy.getStatusCounts).toHaveBeenCalled();
        expect(vehicleServiceSpy.getExpirationCounts).toHaveBeenCalled();
        expect(branchServiceSpy.getList).toHaveBeenCalled();
        expect(categoryVehicleServiceSpy.getList).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('loading and pagination', () => {
    it('should load vehicle list', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      component.load();

      setTimeout(() => {
        expect(component.vehicles().length).toBe(1);
        expect(component.totalCount()).toBe(1);
        expect(component.loading()).toBe(false);
        done();
      }, 100);
    });

    it('should handle load error', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(throwError(() => new Error('Load failed')));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));
      translateServiceSpy.instant.and.returnValue('Failed to load vehicles');

      component.load();

      setTimeout(() => {
        expect(component.loadFailed()).toBe(true);
        expect(toastServiceSpy.error).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should navigate to page', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));
      component.totalPages.set(3);

      component.goToPage(2);

      setTimeout(() => {
        expect(component.pageNumber()).toBe(2);
        done();
      }, 100);
    });

    it('should change page size', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      component.changePageSize(20);

      setTimeout(() => {
        expect(component.pageSize()).toBe(20);
        expect(component.pageNumber()).toBe(1);
        done();
      }, 100);
    });
  });

  describe('filtering and sorting', () => {
    it('should search vehicles', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      component.search.set('ABC-1234');
      component.onSearchSubmit();

      setTimeout(() => {
        expect(vehicleServiceSpy.getPaginated).toHaveBeenCalledWith(
          jasmine.objectContaining({ search: 'ABC-1234' }),
        );
        expect(component.pageNumber()).toBe(1);
        done();
      }, 100);
    });

    it('should filter by status', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      component.onStatusFilterChange('Available');

      setTimeout(() => {
        expect(component.status()).toBe('Available');
        expect(vehicleServiceSpy.getPaginated).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should sort by year', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      component.onOrderByChange('Year');

      setTimeout(() => {
        expect(component.orderBy()).toBe('Year');
        done();
      }, 100);
    });

    it('should sort in ascending order', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      component.onOrderDirectionChange('ASC');

      setTimeout(() => {
        expect(component.orderByDirection()).toBe('ASC');
        done();
      }, 100);
    });
  });

  describe('vehicle title and display', () => {
    it('should get vehicle title from serial number', () => {
      const vehicle = { ...mockVehicle, serialNumber: 'SN-12345' };
      const title = component.getVehicleTitle(vehicle);
      expect(title).toBe('SN-12345');
    });

    it('should get vehicle title from plate number', () => {
      const vehicle = { ...mockVehicle, serialNumber: '', plateNumber: 'ABC-1234' };
      const title = component.getVehicleTitle(vehicle);
      expect(title).toBe('ABC-1234');
    });

    it('should get vehicle title from make and model', () => {
      const vehicle = { ...mockVehicle, serialNumber: '', plateNumber: '', make: 'Toyota', model: 'Camry' };
      const title = component.getVehicleTitle(vehicle);
      expect(title).toBe('Toyota Camry');
    });

    it('should get branch name', () => {
      const branchName = component.getBranchName(mockVehicle);
      expect(branchName).toBe('Main Branch');
    });

    it('should get status tone', () => {
      const tonAvailable = component.getStatusTone('Available');
      const toneBooked = component.getStatusTone('Booked');
      const toneMaintenance = component.getStatusTone('Maintenance');

      expect(tonAvailable).toBe('success');
      expect(toneBooked).toBe('warning');
      expect(toneMaintenance).toBe('danger');
    });

    it('should format daily rate', () => {
      const formatted = component.getDailyRateText(mockVehicle);
      expect(formatted).not.toBe('-');
    });

    it('should format daily rate as dash for zero', () => {
      const vehicle = { ...mockVehicle, dailyRate: 0 };
      const formatted = component.getDailyRateText(vehicle);
      expect(formatted).toBe('-');
    });
  });

  describe('status checks', () => {
    it('should identify if vehicle is deleting', () => {
      component['deletingIds'].set(['vehicle-1']);
      const isDeleting = component.isDeleting('vehicle-1');
      expect(isDeleting).toBe(true);
    });

    it('should identify if vehicle is changing status', () => {
      component['changingStatusIds'].set(['vehicle-1']);
      const isChangingStatus = component.isChangingStatus('vehicle-1');
      expect(isChangingStatus).toBe(true);
    });
  });

  describe('vehicle deletion', () => {
    it('should delete vehicle after confirmation', (done) => {
      vehicleServiceSpy.softDelete.and.returnValue(of(true));
      confirmServiceSpy.confirm.and.returnValue(of(true));
      translateServiceSpy.instant.and.returnValue('Vehicle deleted successfully');
      component.vehicles.set([mockVehicle]);
      component.totalCount.set(1);

      component.deleteVehicle(mockVehicle as any);

      setTimeout(() => {
        expect(vehicleServiceSpy.softDelete).toHaveBeenCalledWith('vehicle-1');
        expect(toastServiceSpy.success).toHaveBeenCalled();
        expect(component.vehicles().length).toBe(0);
        done();
      }, 100);
    });

    it('should not delete vehicle if not confirmed', (done) => {
      vehicleServiceSpy.softDelete.and.returnValue(of(true));
      confirmServiceSpy.confirm.and.returnValue(of(false));

      component.deleteVehicle(mockVehicle as any);

      setTimeout(() => {
        expect(vehicleServiceSpy.softDelete).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('image handling', () => {
    it('should get vehicle image URL', () => {
      const imageUrl = component.getVehicleImage(mockVehicle);
      expect(imageUrl).toBeTruthy();
    });

    it('should use fallback image for invalid URL', () => {
      const vehicle = { ...mockVehicle, imageUrl: 'http://files/invalid.jpg' };
      const imageUrl = component.getVehicleImage(vehicle);
      expect(imageUrl).toContain('car_defulte.png');
    });

    it('should handle image error', () => {
      const img = document.createElement('img');
      img.src = 'https://valid-url.jpg';
      const event = new Event('error');
      Object.defineProperty(event, 'target', { value: img, enumerable: true });

      component.onVehicleImageError(event);

      expect(img.src).toContain('car_defulte.png');
    });
  });

  describe('status counts', () => {
    it('should load status counts', (done) => {
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));

      component.ngOnInit();

      setTimeout(() => {
        expect(component.vehicleStatusTotalCount()).toBe(5);
        expect(component.vehicleStatusCounts().length).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('expiration counts', () => {
    it('should load expiration counts on init', (done) => {
      vehicleServiceSpy.getPaginated.and.returnValue(of(mockPaginatedResponse));
      vehicleServiceSpy.getStatusCounts.and.returnValue(of(mockStatusCountsResponse));
      vehicleServiceSpy.getExpirationCounts.and.returnValue(of(mockExpirationCountsResponse));
      branchServiceSpy.getList.and.returnValue(of([]));
      categoryVehicleServiceSpy.getList.and.returnValue(of([]));

      component.ngOnInit();

      setTimeout(() => {
        expect(component.expirationBarItems().length).toBe(4);
        expect(component.expirationBarItems()[0].expiredCount).toBe(2);
        expect(component.expirationNextDays()).toBe(15);
        done();
      }, 100);
    });
  });
});
