import { expect } from "chai";
import { pushClient } from "../index.js";
import globalResourceProvider from "./helpers/globalResourceProvider.js";
import monitoring from "@google-cloud/monitoring";
import sinon from "sinon";

const sandbox = sinon.createSandbox();

describe("options", () => {
  let stub;
  before(() => {
    stub = sandbox.stub(monitoring);
  });
  after(() => {
    sandbox.restore();
  });
  describe("without createTimeSeriesTimeoutSeconds", () => {
    it("is not passed to MetricServiceClient", () => {
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
      expect(ctorOpts).to.eql({});
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
        {
          clientConfig: {
            interfaces: {
              "google.monitoring.v3.MetricService": {
                methods: {
                  CreateTimeSeries: {
                    timeout_millis: 60000,
                  },
                },
              },
            },
          },
        }
      );
    });
  });
});
