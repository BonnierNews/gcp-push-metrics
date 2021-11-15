import { MetricServiceClient } from "@google-cloud/monitoring";
import Counter from "./lib/Counter.js";
import Gauge from "./lib/Gauge.js";
import Summary from "./lib/Summary.js";
import CloudRunResourceProvider from "./lib/CloudRunResourceProvider.js";

function PushClient({ intervalSeconds, logger, resourceProvider } = {}) {
  if (intervalSeconds < 1) {
    throw new Error("intervalSeconds must be at least 1");
  }
  if (!intervalSeconds) {
    intervalSeconds = 60;
  }

  if (!logger) {
    logger = {
      debug() {},
      error() {},
    };
  }
  if (!resourceProvider) {
    throw new Error("no resourceProvider");
  }

  if (!logger.debug || !logger.error) {
    throw new Error("logger must have methods 'debug' and 'error'");
  }

  const metricsClient = new MetricServiceClient();
  const metrics = [];
  let intervalEnd;

  const counter = (config) => {
    const counterMetric = Counter(config);
    metrics.push(counterMetric);
    return counterMetric;
  };

  const gauge = (config) => {
    const gaugeMetric = Gauge(config);
    metrics.push(gaugeMetric);
    return gaugeMetric;
  };

  const summary = (config) => {
    const summaryMetric = Summary(config);
    metrics.push(summaryMetric);
    return summaryMetric;
  };

  let resources;

  async function push(exit) {
    logger.debug("PushClient: Gathering and pushing metrics");
    try {
      if (!resources) {
        resources = await resourceProvider();
      }
      let resource = resources.default;
      if (exit) {
        resource = resources.exit;
      }

      intervalEnd = Date.now();
      const timeSeries = metrics.map((metric) => metric.toTimeSeries(intervalEnd, resource)).flat();
      logger.debug(`PushClient: Found ${timeSeries.length} time series`);

      metrics.forEach((metric) => metric.intervalReset());

      logger.debug(`PushClient: found ${timeSeries.length} time series which should be pushed`);

      // StackDriver/Cloud Monitoring has a limit of 200 time series per requests
      // so we split our time series into multiple requests if needed
      const requests = [];
      for (let i = 0; i < timeSeries.length; i += 200) {
        const chunk = timeSeries.slice(i, i + 200);
        requests.push(
          metricsClient.createTimeSeries({
            name: metricsClient.projectPath(resource.labels.project_id),
            timeSeries: chunk,
          })
        );
      }
      await Promise.all(requests);
      logger.debug("PushClient: Done pushing metrics to StackDriver");
    } catch (e) {
      logger.error(`PushClient: Unable to push metrics: ${e}. Stack: ${e.stack}`);
    }
    setTimeout(push, intervalSeconds * 1000);
  }
  setTimeout(push, intervalSeconds * 1000);

  process.on("SIGTERM", push.bind(null, true));

  return { Counter: counter, Gauge: gauge, Summary: summary };
}

export { PushClient, CloudRunResourceProvider };
