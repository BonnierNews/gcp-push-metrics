import { expect } from "chai";
import monitoring from "@google-cloud/monitoring";
import { createSandbox } from "sinon";

import { pushClient } from "../index.js";
import globalResourceProvider from "./helpers/globalResourceProvider.js";

const sandbox = createSandbox();

describe("options", () => {
  let stub;
  before(() => {
    stub = sandbox.stub(monitoring);
  });
  after(() => {
    sandbox.restore();
  });
  describe("without createTimeSeriesTimeoutSeconds", () => {
    it("a default is passed to MetricServiceClient", () => {
      let ctorOpts;
      class FakeMetricServiceClient {
        constructor(opts) {
          ctorOpts = opts;
        }
      }
      stub.MetricServiceClient = (FakeMetricServiceClient);
      pushClient({
        projectId: "myproject",
        resourceProvider: globalResourceProvider,
      });
      expect(ctorOpts).to.eql({ clientConfig: { interfaces: { "google.monitoring.v3.MetricService": { methods: { CreateTimeSeries: { timeout_millis: 40000 } } } } } });
    });
  });
  describe("with createTimeSeriesTimeoutSeconds", () => {
    it("is passed to MetricServiceClient", () => {
      let ctorOpts;
      class FakeMetricServiceClient {
        constructor(opts) {
          ctorOpts = opts;
        }
      }
      stub.MetricServiceClient = (FakeMetricServiceClient);
      pushClient({
        projectId: "myproject",
        resourceProvider: globalResourceProvider,
        createTimeSeriesTimeoutSeconds: 60,
      });
      expect(ctorOpts).to.eql(
        { clientConfig: { interfaces: { "google.monitoring.v3.MetricService": { methods: { CreateTimeSeries: { timeout_millis: 60000 } } } } } }
      );
    });
  });
});
