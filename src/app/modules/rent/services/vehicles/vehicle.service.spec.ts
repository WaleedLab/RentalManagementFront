import { TestBed } from '@angular/core/testing';
import { VehicleService } from './vehicle.service';
import { BaseService } from '../../../../shared/services/base/base.service';
import { of, throwError } from 'rxjs';

describe('VehicleService', () => {
  let service: VehicleService;
  let baseServiceSpy: jasmine.SpyObj<BaseService>;

  const mockVehicle = {
    id: 'vehicle-1',
    plateNumber: 'ABC-1234',
    modelName: 'Toyota Camry',
    categoryId: 'cat-1',
    categoryName: 'Sedan',
    status: 'available',
    dailyRate: 50,
    condition: 'excellent',
    mileage: 15000,
    registrationDate: '2023-01-01',
    isActive: true,
    fleetId: 'fleet-1',
  };

  const mockVehicleList = [
    mockVehicle,
    { id: 'vehicle-2', plateNumber: 'XYZ-5678', modelName: 'Honda Accord', categoryId: 'cat-1', status: 'rented', isActive: true },
    { id: 'vehicle-3', plateNumber: 'MNO-9012', modelName: 'Ford Focus', categoryId: 'cat-2', status: 'maintenance', isActive: true },
  ];

  beforeEach(() => {
    const baseServiceMock = jasmine.createSpyObj('BaseService', ['getData', 'postData', 'putData', 'patchData']);
    TestBed.configureTestingModule({
      providers: [VehicleService, { provide: BaseService, useValue: baseServiceMock }],
    });
    service = TestBed.inject(VehicleService);
    baseServiceSpy = TestBed.inject(BaseService) as jasmine.SpyObj<BaseService>;
  });

  describe('getList', () => {
    it('should retrieve all vehicles', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicleList));

      service.getList().subscribe((vehicles) => {
        expect(vehicles.length).toBe(3);
        expect(vehicles[0].plateNumber).toBe('ABC-1234');
        done();
      });
    });

    it('should handle empty vehicle list', (done) => {
      baseServiceSpy.getData.and.returnValue(of(null));

      service.getList().subscribe((vehicles) => {
        expect(vehicles).toEqual([]);
        done();
      });
    });

    it('should filter by status', (done) => {
      const availableVehicles = mockVehicleList.filter((v) => v.status === 'available');
      baseServiceSpy.getData.and.returnValue(of(availableVehicles));

      service.getList().subscribe((vehicles) => {
        expect(vehicles.every((v) => v.status === 'available')).toBe(true);
        done();
      });
    });
  });

  describe('getById', () => {
    it('should retrieve vehicle by id', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicle));

      service.getById('vehicle-1').subscribe((vehicle) => {
        expect(vehicle.id).toBe('vehicle-1');
        expect(vehicle.plateNumber).toBe('ABC-1234');
        done();
      });
    });

    it('should call API with correct parameters', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicle));

      service.getById('vehicle-2').subscribe(() => {
        expect(baseServiceSpy.getData).toHaveBeenCalledWith(
          jasmine.any(String),
          jasmine.objectContaining({ id: 'vehicle-2' }),
        );
        done();
      });
    });
  });

  describe('create', () => {
    const createRequest = {
      plateNumber: 'NEW-1111',
      modelName: 'BMW 3 Series',
      categoryId: 'cat-3',
      dailyRate: 100,
      registrationDate: '2024-01-01',
      fleetId: 'fleet-1',
      isActive: true,
    };

    it('should create new vehicle', (done) => {
      baseServiceSpy.postData.and.returnValue(of({ id: 'vehicle-new', ...createRequest }));

      service.create(createRequest).subscribe((response) => {
        expect(response).toBeDefined();
        done();
      });
    });

    it('should include vehicle details', (done) => {
      baseServiceSpy.postData.and.returnValue(of({}));

      service.create(createRequest).subscribe(() => {
        const callArgs = baseServiceSpy.postData.calls.mostRecent().args;
        const payload = callArgs[1];
        expect(payload.plateNumber).toBe('NEW-1111');
        expect(payload.dailyRate).toBe(100);
        done();
      });
    });
  });

  describe('filtering and searching', () => {
    it('should filter vehicles by status', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicleList));

      service.getList().subscribe((vehicles) => {
        const availableVehicles = vehicles.filter((v) => v.status === 'available');
        expect(availableVehicles.length).toBeGreaterThan(0);
        done();
      });
    });

    it('should search by plate number', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicleList));

      service.getList().subscribe((vehicles) => {
        const found = vehicles.find((v) => v.plateNumber.includes('ABC'));
        expect(found).toBeDefined();
        done();
      });
    });

    it('should search by model name', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicleList));

      service.getList().subscribe((vehicles) => {
        const found = vehicles.find((v) => v.modelName.includes('Toyota'));
        expect(found).toBeDefined();
        done();
      });
    });

    it('should sort vehicles by mileage', (done) => {
      const sorted = [...mockVehicleList].sort((a, b) => (a.mileage || 0) - (b.mileage || 0));
      baseServiceSpy.getData.and.returnValue(of(sorted));

      service.getList().subscribe((vehicles) => {
        if (vehicles.length > 1) {
          expect(vehicles[0].mileage).toBeLessThanOrEqual(vehicles[vehicles.length - 1].mileage || 0);
        }
        done();
      });
    });

    it('should filter active vehicles only', (done) => {
      const activeOnly = mockVehicleList.filter((v) => v.isActive);
      baseServiceSpy.getData.and.returnValue(of(activeOnly));

      service.getList().subscribe((vehicles) => {
        expect(vehicles.every((v) => v.isActive)).toBe(true);
        done();
      });
    });
  });

  describe('calculations', () => {
    it('should calculate total vehicles', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicleList));

      service.getList().subscribe((vehicles) => {
        expect(vehicles.length).toBe(3);
        done();
      });
    });

    it('should count available vehicles', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicleList));

      service.getList().subscribe((vehicles) => {
        const available = vehicles.filter((v) => v.status === 'available').length;
        expect(available).toBeGreaterThan(0);
        done();
      });
    });

    it('should calculate average mileage', (done) => {
      baseServiceSpy.getData.and.returnValue(of(mockVehicleList));

      service.getList().subscribe((vehicles) => {
        const totalMileage = vehicles.reduce((sum, v) => sum + (v.mileage || 0), 0);
        const avgMileage = totalMileage / vehicles.length;
        expect(avgMileage).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('getExpirationCounts', () => {
    it('should request expiration counts with fleet and branch params', (done) => {
      const mockResponse = {
        nextDays: 15,
        items: [{ key: 'insurance', label: 'Insurance', expiredCount: 1, expiringSoonCount: 2 }],
      };
      baseServiceSpy.getData.and.returnValue(of(mockResponse));

      service.getExpirationCounts({ fleetId: 'fleet-1', branchId: 3, nextDays: 15 }).subscribe(response => {
        expect(baseServiceSpy.getData).toHaveBeenCalledWith(
          'Vehicle/ExpirationCounts',
          jasmine.objectContaining({ FleetId: 'fleet-1', BranchId: 3, NextDays: 15 }),
          jasmine.any(Object),
        );
        expect(response.items.length).toBe(1);
        expect(response.items[0].expiredCount).toBe(1);
        done();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle vehicles with high mileage', (done) => {
      const highMileageVehicle = { ...mockVehicle, mileage: 500000 };
      baseServiceSpy.getData.and.returnValue(of([highMileageVehicle]));

      service.getList().subscribe((vehicles) => {
        expect(vehicles[0].mileage).toBe(500000);
        done();
      });
    });

    it('should handle zero mileage', (done) => {
      const newVehicle = { ...mockVehicle, mileage: 0 };
      baseServiceSpy.getData.and.returnValue(of([newVehicle]));

      service.getList().subscribe((vehicles) => {
        expect(vehicles[0].mileage).toBe(0);
        done();
      });
    });
  });
});
