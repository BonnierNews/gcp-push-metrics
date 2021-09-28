"use strict";
import monitoring from "@google-cloud/monitoring";
import sinon from "sinon";

const sandbox = sinon.createSandbox();

export default function fixture(createTimeSeriesStub) {
  const metricsRequests = [];
  if (!createTimeSeriesStub) {
    createTimeSeriesStub = async (request) => {
      metricsRequests.push(request);
      return "something";
    };
  }
  metricsRequests.length = 0;
  sandbox.restore();
  let clock = sinon.useFakeTimers();
  const stub = sandbox.stub(monitoring.MetricServiceClient.prototype);
  stub.projectPath = (path) => {
    return `projectpath:${path}`;
  };
  stub.createTimeSeries = createTimeSeriesStub;

  return { clock, metricsRequests };
}
