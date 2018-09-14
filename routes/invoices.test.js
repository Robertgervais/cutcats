import MockRequest from 'mock-express-request';
import MockResponse from 'mock-express-response';
import sinon from 'sinon';
import models from '../models';
import yazl from 'yazl';
import should from 'should';
import invoiceRoutes from './invoices';
import ClientInvoice from './util/ClientInvoice';
import QuickbooksInvoice from './util/QuickbooksInvoice';
import { save, getId, idsShouldBeEqual } from './util/testUtils';
import { fixtureModel, fixtureModelArray } from '../models/fixtures';

describe('invoices routes', function () {
  beforeEach(function () {
    this.req = new MockRequest();
    this.res = new MockResponse();
    sinon.spy(this.res, 'json');
  });

  describe('getInvoices()', function () {
    it('respects ?from and ?to', function () {
      const invoices = [
        fixtureModel('Invoice', { periodStart: new Date('2000-1-1'), periodEnd: new Date('2000-1-15') }),
        fixtureModel('Invoice', { periodStart: new Date('2001-1-1'), periodEnd: new Date('2001-1-15') }),
        fixtureModel('Invoice', { periodStart: new Date('2002-1-1'), periodEnd: new Date('2002-1-15') })
      ];
      this.req.query.from = new Date('2000-12-1');
      this.req.query.to = new Date('2001-2-1');
      return save(invoices)
        .then(() => {
          return invoiceRoutes.getInvoices(this.req, this.res);
        })
        .then(() => {
          this.res.statusCode.should.eql(200);
          const jsonResponse = this.res.json.firstCall.args[0];
          jsonResponse.should.have.length(1);
          idsShouldBeEqual(jsonResponse[0], invoices[1]);
        });
    });
  });

  describe('createInvoiceZip()', function() {
    it('assigns req.invoiceZip and calls next()', function() {
      const client = fixtureModel('Client');
      const rides = fixtureModelArray('Ride', { client }, 3);
      const next = sinon.stub();
      const lambda = {
        invoke: sinon.stub().callsArgWith(1, null, { Payload: '{ "data": [] }' })
      };
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.clientInvoices = [
        new ClientInvoice(client, rides, this.req.query.periodStart, this.req.query.periodEnd, lambda)
      ];
      this.req.quickbooksInvoice = new QuickbooksInvoice(this.req.clientInvoices, this.req.query.periodStart, this.req.query.periodEnd, new Date('2000-1-1'), new Date('2000-1-1'));
      invoiceRoutes.createInvoiceZip(this.req, this.res, next);
      next.calledOnce.should.be.true();
      this.req.invoiceZip.should.be.ok();
      return new Promise((resolve, reject) => {
        this.req.invoiceZip.outputStream.on('data', () => {});
        this.req.invoiceZip.outputStream.on('finish', resolve);
        this.req.invoiceZip.outputStream.on('error', reject);
      });
    });

    it('assigns req.invoiceZipSize a promise that resolves with a number', function() {
      const client = fixtureModel('Client');
      const rides = fixtureModelArray('Ride', { client }, 3);
      const next = sinon.stub();
      const lambda = {
        invoke: sinon.stub().callsArgWith(1, null, { Payload: '{ "data": [] }' })
      };
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.clientInvoices = [
        new ClientInvoice(client, rides, this.req.query.periodStart, this.req.query.periodEnd, lambda)
      ];
      this.req.quickbooksInvoice = new QuickbooksInvoice(this.req.clientInvoices, this.req.query.periodStart, this.req.query.periodEnd, new Date('2000-1-1'), new Date('2000-1-1'));
      invoiceRoutes.createInvoiceZip(this.req, this.res, next);
      this.req.invoiceZipSize.should.be.ok();
      return this.req.invoiceZipSize.then(result => {
        result.should.be.a.Number();
      });
    });
  });

  describe('serveInvoiceZip()', function() {
    it('pipes req.invoiceZip into response and finishes successfully', function() {
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.invoiceZip = new yazl.ZipFile();
      invoiceRoutes.serveInvoiceZip(this.req, this.res);
      this.req.invoiceZip.end();
      return new Promise((resolve, reject) => {
        this.res.on('data', () => {});
        this.res.on('finish', resolve);
        this.res.on('error', reject);
      });
    });
  });

  describe('saveInvoiceZip()', function() {
    it('calls s3.putObject() and saves an Invoice to the db', function() {
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-1');
      this.req.invoiceZip = new yazl.ZipFile();
      this.req.invoiceZipSize = new Promise(resolve => resolve(1));
      const s3 = {
        putObject: sinon.stub().callsArgWith(1, null, { foo: 'bar' })
      };
      return invoiceRoutes.saveInvoiceZip(s3)(this.req, this.res, sinon.stub())
        .then(() => {
          s3.putObject.calledOnce.should.be.true();
          this.res.json.firstCall.args[0].should.be.an.Object();
          return models.Invoice.find().exec();
        })
        .then(invoices => {
          invoices.should.have.length(1);
          invoices[0].periodStart.should.eql(this.req.query.periodStart);
          invoices[0].periodEnd.should.eql(this.req.query.periodEnd);
        });
    });
  });

  describe('generateInvoices()', function () {
    it('produces a list of ClientInvoices, one for each Client', function () {
      const clients = fixtureModelArray('Client', 2);
      const commonRideAttrs = { readyTime: new Date('2000-1-2'), deliveryStatus: 'complete' };
      const rides = [
        fixtureModel('Ride', { ...commonRideAttrs, client: clients[0] }),
        fixtureModel('Ride', { ...commonRideAttrs, client: clients[1] })
      ];
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-3');
      return save(clients, rides)
        .then(() => {
          return invoiceRoutes.generateInvoices(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.clientInvoices.should.have.length(2);
          this.req.clientInvoices.forEach(clientInvoice => {
            should(clientInvoice.client.name).be.ok();
            clients.map(getId).should.containEql(getId(clientInvoice.client));
          });
        });
    });

    it('each ClientInvoice contains a list of rides belonging to that client', function () {
      const clients = fixtureModelArray('Client', 2);
      const commonRideAttrs = { readyTime: new Date('2000-1-2'), deliveryStatus: 'complete' };
      const rides = [
        fixtureModel('Ride', { ...commonRideAttrs, client: clients[0] }),
        fixtureModel('Ride', { ...commonRideAttrs, client: clients[1] }),
        fixtureModel('Ride', { ...commonRideAttrs, client: clients[1] })
      ];
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-3');
      return save(clients, rides)
        .then(() => {
          return invoiceRoutes.generateInvoices(this.req, this.res, sinon.stub());
        })
        .then(() => {
          const client0Invoice = this.req.clientInvoices.find(clientInvoice => getId(clientInvoice.client) === getId(clients[0]));
          const client1Invoice = this.req.clientInvoices.find(clientInvoice => getId(clientInvoice.client) === getId(clients[1]));
          client0Invoice.ridesInPeriod.should.have.length(1);
          client0Invoice.ridesInPeriod.forEach(ride => idsShouldBeEqual(ride.client, clients[0]));
          client1Invoice.ridesInPeriod.should.have.length(2);
          client1Invoice.ridesInPeriod.forEach(ride => idsShouldBeEqual(ride.client, clients[1]));
        });
    });

    it('respects ?periodStart and ?periodEnd dates', function () {
      const client = fixtureModel('Client');
      const commonRideAttrs = { deliveryStatus: 'complete', client };
      const rides = [
        fixtureModel('Ride', { ...commonRideAttrs, readyTime: new Date('2000-1-1') }),
        fixtureModel('Ride', { ...commonRideAttrs, readyTime: new Date('2000-2-1') }),
        fixtureModel('Ride', { ...commonRideAttrs, readyTime: new Date('2000-3-1') }),
      ];
      this.req.query.periodStart = new Date('2000-1-20');
      this.req.query.periodEnd = new Date('2000-2-20');
      return save(client, rides)
        .then(() => {
          return invoiceRoutes.generateInvoices(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.clientInvoices.should.have.length(1);
          this.req.clientInvoices[0].ridesInPeriod.should.have.length(1);
          idsShouldBeEqual(this.req.clientInvoices[0].ridesInPeriod[0], rides[1]);
          this.req.clientInvoices[0].periodStart.valueOf().should.eql(this.req.query.periodStart.valueOf());
          this.req.clientInvoices[0].periodEnd.valueOf().should.eql(this.req.query.periodEnd.valueOf());
        });
    });

    it('only includes rides with deliveryStatus == "complete"', function() {
      const client = fixtureModel('Client');
      const commonRideAttrs = { readyTime: new Date('2000-1-2'), client };
      const rides = models.Ride.schema.paths.deliveryStatus.enumValues.map(deliveryStatus => {
        return fixtureModel('Ride', { ...commonRideAttrs, deliveryStatus });
      });
      this.req.query.periodStart = new Date('2000-1-1');
      this.req.query.periodEnd = new Date('2000-1-3');
      return save(client, rides)
        .then(() => {
          return invoiceRoutes.generateInvoices(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.clientInvoices.should.have.length(1);
          this.req.clientInvoices[0].ridesInPeriod.should.have.length(1);
          this.req.clientInvoices[0].ridesInPeriod[0].deliveryStatus.should.eql('complete');
        });
    });

    it('each client invoice contains a count of that client\'s rides for the entire month', function() {
      const client = fixtureModel('Client');
      const commonRideAttrs = { readyTime: new Date('2000-1-1'), deliveryStatus: 'complete', client };
      const rides = fixtureModelArray('Ride', commonRideAttrs, 3);
      this.req.query.periodStart = new Date('2000-1-15');
      this.req.query.periodEnd = new Date('2000-1-31');
      return save(client, rides)
        .then(() => {
          return invoiceRoutes.generateInvoices(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.clientInvoices.should.have.length(1);
          this.req.clientInvoices[0].ridesInPeriod.should.have.length(0);
          this.req.clientInvoices[0].ridesInMonth.should.have.length(3);
        });
    });

    it('produces a QuickbooksInvoice', function() {
      const client = fixtureModel('Client');
      const rides = fixtureModelArray('Ride', 3);
      this.req.query.periodStart = new Date('2000-1-15');
      this.req.query.periodEnd = new Date('2000-1-31');
      return save(client, rides)
        .then(() => {
          return invoiceRoutes.generateInvoices(this.req, this.res, sinon.stub());
        })
        .then(() => {
          this.req.quickbooksInvoice.should.be.ok();
        });
    });
  });
});
