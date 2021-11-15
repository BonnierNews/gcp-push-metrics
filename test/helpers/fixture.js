import monitoring from "@google-cloud/monitoring";
import sinon from "sinon";

const sandbox = sinon.createSandbox();

export default function fixture(createTimeSeriesStub) {
  const metricsRequests = [];
  let onPushListener;
  if (!createTimeSeriesStub) {
    createTimeSeriesStub = async (request) => {
      metricsRequests.push(request);
      if (onPushListener) {
        onPushListener();
      }
      return "something";
    };
  }
  metricsRequests.length = 0;
  sandbox.restore();
  const clock = sinon.useFakeTimers();
  const stub = sandbox.stub(monitoring.MetricServiceClient.prototype);
  stub.projectPath = (path) => `projectpath:${path}`;
  stub.createTimeSeries = createTimeSeriesStub;

  const onPush = () =>
    new Promise((resolve) => {
      onPushListener = () => {
        resolve();
      };
    });

  return { clock, metricsRequests, onPush };
}
