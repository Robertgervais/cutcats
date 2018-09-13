import MockRequest from 'mock-express-request';
import MockResponse from 'mock-express-response';
import sinon from 'sinon';
import models from '../models';
import yazl from 'yazl';
import payrollRoutes from './payrolls';
import CourierPaystub from './util/CourierPaystub';
import QuickbooksPayroll from './util/QuickbooksPayroll';
import { save, getId, idsShouldBeEqual } from './util/testUtils';
import { fixtureModel, fixtureModelArray } from '../models/fixtures';

describe('payrolls routes', function () {
  beforeEach(function () {
    this.req = new MockRequest();
    this.res = new MockResponse();
    sinon.spy(this.res, 'json');
  });

  describe('getPayrolls()', function () {
    it('respects ?from and ?to', function () {
      const payrolls = [
        fixtureModel('Payroll', { periodStart: new Date('2000-1-1'), periodEnd: new Date('2000-1-15') }),
        fixtureModel('Payroll', { periodStart: new Date('2001-1-1'), periodEnd: new Date('2001-1-15') }),
        fixtureModel('Payroll', { periodStart: new Date('2002-1-1'), periodEnd: new Date('2002-1-15') })
      ];
      this.req.query.from = new Date('2000-12-1');
      this.req.query.to = new Date('2001-2-1');
      return save(payrolls)
        .then(() => {
          return payrollRoutes.getPayrolls(this.req, this.res);
        })
        .then(() => {
          this.res.statusCode.should.eql(200);
          const jsonResponse = this.res.json.firstCall.args[0];
          jsonResponse.should.have.length(1);
          idsShouldBeEqual(jsonResponse[0], payrolls[1]);
        });
    });
  });

  describe('createPayrollZip()', function() {
    it('assigns req.payrollZip and calls next()', function() {
      const courier = fixtureModel('Courier');
      const rides = fixtureModelArray('Ride', { courier }, 3);
      const next = sinon.stub();
      const lambda = {
        invoke: sinon.stub().callsArgWith(1, null, { Payload: '{ "data": [] }' })
      };
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.courierPaystubs = [
        new CourierPaystub(courier, rides, this.req.query.periodStart, this.req.query.periodEnd, lambda)
      ];
      this.req.quickbooksPayroll = new QuickbooksPayroll(this.req.courierPaystubs, this.req.query.periodStart, this.req.query.periodEnd, new Date('2000-1-1'), new Date('2000-1-1'));
      payrollRoutes.createPayrollZip(this.req, this.res, next);
      next.calledOnce.should.be.true();
      this.req.payrollZip.should.be.ok();
      return new Promise((resolve, reject) => {
        this.req.payrollZip.outputStream.on('data', () => {});
        this.req.payrollZip.outputStream.on('finish', resolve);
        this.req.payrollZip.outputStream.on('error', reject);
      });
    });

    it('assigns req.payrollZipSize a promise that resolves with a number', function() {
      const courier = fixtureModel('Courier');
      const rides = fixtureModelArray('Ride', { courier }, 3);
      const next = sinon.stub();
      const lambda = {
        invoke: sinon.stub().callsArgWith(1, null, { Payload: '{ "data": [] }' })
      };
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.courierPaystubs = [
        new CourierPaystub(courier, rides, this.req.query.periodStart, this.req.query.periodEnd, lambda)
      ];
      this.req.quickbooksPayroll = new QuickbooksPayroll(this.req.courierPaystubs, this.req.query.periodStart, this.req.query.periodEnd, new Date('2000-1-1'), new Date('2000-1-1'));
      payrollRoutes.createPayrollZip(this.req, this.res, next);
      this.req.payrollZipSize.should.be.ok();
      return this.req.payrollZipSize.then(result => {
        result.should.be.a.Number();
      });
    });
  });

  describe('servePayrollZip()', function() {
    it('pipes req.payrollZip into response and finishes successfully', function() {
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.payrollZip = new yazl.ZipFile();
      payrollRoutes.servePayrollZip(this.req, this.res);
      this.req.payrollZip.end();
      return new Promise((resolve, reject) => {
        this.res.on('data', () => {});
        this.res.on('finish', resolve);
        this.res.on('error', reject);
      });
    });
  });

  describe('savePayrollZip()', function() {
    it('calls s3.putObject() and saves an Payroll to the db', function() {
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.payrollZip = new yazl.ZipFile();
      this.req.payrollZipSize = new Promise(resolve => resolve(1));
      const s3 = {
        putObject: sinon.stub().callsArgWith(1, null, { foo: 'bar' })
      };
      return payrollRoutes.savePayrollZip(s3)(this.req, this.res, sinon.stub())
        .then(() => {
          s3.putObject.calledOnce.should.be.true();
          this.res.json.firstCall.args[0].should.be.an.Object();
          return models.Payroll.find().exec();
        })
        .then(payrolls => {
          payrolls.should.have.length(1);
          payrolls[0].periodStart.should.eql(this.req.query.periodStart);
          payrolls[0].periodEnd.should.eql(this.req.query.periodEnd);
        });
    });
  });

  describe('generatePaystubs()', function () {
    it('produces a list of CourierPaystubs, one for each Courier', function () {
      const couriers = fixtureModelArray('Courier', 2);
      const commonRideAttrs = { readyTime: new Date('2000-1-2'), deliveryStatus: 'complete' };
      const rides = [
        fixtureModel('Ride', { ...commonRideAttrs, courier: couriers[0] }),
        fixtureModel('Ride', { ...commonRideAttrs, courier: couriers[1] })
      ];
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-3');
      return save(couriers, rides)
        .then(() => {
          return payrollRoutes.generatePaystubs(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.courierPaystubs.should.have.length(2);
          this.req.courierPaystubs.forEach(courierPaystub => {
            couriers.map(getId).should.containEql(getId(courierPaystub.courier));
          });
        });
    });

    it('each CourierPaystub contains a list of rides belonging to that courier', function () {
      const couriers = fixtureModelArray('Courier', 2);
      const commonRideAttrs = { readyTime: new Date('2000-1-2'), deliveryStatus: 'complete' };
      const rides = [
        fixtureModel('Ride', { ...commonRideAttrs, courier: couriers[0] }),
        fixtureModel('Ride', { ...commonRideAttrs, courier: couriers[1] }),
        fixtureModel('Ride', { ...commonRideAttrs, courier: couriers[1] })
      ];
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-3');
      return save(couriers, rides)
        .then(() => {
          return payrollRoutes.generatePaystubs(this.req, this.res, sinon.stub());
        })
        .then(() => {
          const courier0Payroll = this.req.courierPaystubs.find(courierPaystub => getId(courierPaystub.courier) === getId(couriers[0]));
          const courier1Payroll = this.req.courierPaystubs.find(courierPaystub => getId(courierPaystub.courier) === getId(couriers[1]));
          courier0Payroll.ridesInPeriod.should.have.length(1);
          courier0Payroll.ridesInPeriod.forEach(ride => idsShouldBeEqual(ride.courier, couriers[0]));
          courier1Payroll.ridesInPeriod.should.have.length(2);
          courier1Payroll.ridesInPeriod.forEach(ride => idsShouldBeEqual(ride.courier, couriers[1]));
        });
    });

    it('respects ?periodStart and ?periodEnd dates', function () {
      const courier = fixtureModel('Courier');
      const commonRideAttrs = { deliveryStatus: 'complete', courier };
      const rides = [
        fixtureModel('Ride', { ...commonRideAttrs, readyTime: new Date('2000-1-1') }),
        fixtureModel('Ride', { ...commonRideAttrs, readyTime: new Date('2000-2-1') }),
        fixtureModel('Ride', { ...commonRideAttrs, readyTime: new Date('2000-3-1') }),
      ];
      this.req.query.periodStart = new Date('2000-1-20');
      this.req.query.periodEnd = new Date('2000-2-20');
      return save(courier, rides)
        .then(() => {
          return payrollRoutes.generatePaystubs(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.courierPaystubs.should.have.length(1);
          this.req.courierPaystubs[0].ridesInPeriod.should.have.length(1);
          idsShouldBeEqual(this.req.courierPaystubs[0].ridesInPeriod[0], rides[1]);
          this.req.courierPaystubs[0].periodStart.valueOf().should.eql(this.req.query.periodStart.valueOf());
          this.req.courierPaystubs[0].periodEnd.valueOf().should.eql(this.req.query.periodEnd.valueOf());
        });
    });

    it('only includes rides with deliveryStatus == "complete"', function() {
      const courier = fixtureModel('Courier');
      const commonRideAttrs = { readyTime: new Date('2000-1-2'), courier };
      const rides = models.Ride.schema.paths.deliveryStatus.enumValues.map(deliveryStatus => {
        return fixtureModel('Ride', { ...commonRideAttrs, deliveryStatus });
      });
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-3');
      return save(courier, rides)
        .then(() => {
          return payrollRoutes.generatePaystubs(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.courierPaystubs.should.have.length(1);
          this.req.courierPaystubs[0].ridesInPeriod.should.have.length(1);
          this.req.courierPaystubs[0].ridesInPeriod[0].deliveryStatus.should.eql('complete');
        });
    });

    it('each courier payroll contains a count of that courier\'s rides for the entire month', function() {
      const courier = fixtureModel('Courier');
      const commonRideAttrs = { readyTime: new Date('2000-1-1'), deliveryStatus: 'complete', courier };
      const rides = fixtureModelArray('Ride', commonRideAttrs, 3);
      this.req.query.periodStart = new Date('2000-1-15');
      this.req.query.periodEnd = new Date('2000-1-31');
      return save(courier, rides)
        .then(() => {
          return payrollRoutes.generatePaystubs(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.courierPaystubs.should.have.length(1);
          this.req.courierPaystubs[0].ridesInPeriod.should.have.length(0);
          this.req.courierPaystubs[0].ridesInMonth.should.have.length(3);
        });
    });

    it('produces a QuickbooksPayroll', function() {
      const courier = fixtureModel('Courier');
      const rides = fixtureModelArray('Ride', 3);
      this.req.query.periodStart = new Date('2000-1-15');
      this.req.query.periodEnd = new Date('2000-1-31');
      return save(courier, rides)
        .then(() => {
          return payrollRoutes.generatePaystubs(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.quickbooksPayroll.should.be.ok();
        });
    });
  });
});
