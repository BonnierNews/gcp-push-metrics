import monitoring from "@google-cloud/monitoring";

import counter from "./lib/counter.js";
import gauge from "./lib/gauge.js";
import summary from "./lib/summary.js";
import cloudRunResourceProvider from "./lib/cloudRunResourceProvider.js";

function pushClient({ intervalSeconds, createTimeSeriesTimeoutSeconds = 40, logger, resourceProvider, grpcKeepaliveTimeoutMs, grpcKeepaliveTimeMs } = {}) {
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

  const opts = {};
  if (createTimeSeriesTimeoutSeconds) {
    opts.clientConfig = { interfaces: { "google.monitoring.v3.MetricService": { methods: { CreateTimeSeries: { timeout_millis: createTimeSeriesTimeoutSeconds * 1000 } } } } };
  }

  if (grpcKeepaliveTimeoutMs) {
    opts["grpc.keepalive_timeout_ms"] = grpcKeepaliveTimeoutMs;
  }

  if (grpcKeepaliveTimeMs) {
    opts["grpc.keepalive_time_ms"] = grpcKeepaliveTimeMs;
  }

  const metricsClient = new monitoring.MetricServiceClient(opts);
  const metrics = [];
  let intervalEnd;

  const createCounter = (config) => {
    const counterMetric = counter(config);
    metrics.push(counterMetric);
    return counterMetric;
  };

  const createGauge = (config) => {
    const gaugeMetric = gauge(config);
    metrics.push(gaugeMetric);
    return gaugeMetric;
  };

  const createSummary = (config) => {
    const summaryMetric = summary(config);
    metrics.push(summaryMetric);
    return summaryMetric;
  };

  let resources;

  async function push(exit) {
    logger.debug("pushClient: Gathering and pushing metrics");
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
      logger.debug(`pushClient: Found ${timeSeries.length} time series`);
      logger.debug(`pushClient: Found time series ${JSON.stringify(timeSeries)}`);

      metrics.forEach((metric) => metric.intervalReset());

      logger.debug(`pushClient: found ${timeSeries.length} time series which should be pushed`);

      // StackDriver/Cloud Monitoring has a limit of 200 time series per requests
      // so we split our time series into multiple requests if needed
      const requests = [];
      for (let i = 0; i < timeSeries.length; i += 200) {
        const chunk = timeSeries.slice(i, i + 200);
        logger.debug(`pushClient: Chunk: ${JSON.stringify(chunk)}`);
        requests.push(
          metricsClient.createTimeSeries({
            name: metricsClient.projectPath(resource.labels.project_id),
            timeSeries: chunk,
          })
        );
      }
      await Promise.all(requests);
      logger.debug("pushClient: Done pushing metrics to StackDriver");
    } catch (e) {
      logger.error(`pushClient: Unable to push metrics: ${e}. Stack: ${e.stack}`);
    }
    setTimeout(push, intervalSeconds * 1000);
  }
  setTimeout(push, intervalSeconds * 1000);

  process.on("SIGTERM", push.bind(null, true));

  return { counter: createCounter, gauge: createGauge, summary: createSummary };
}

export { pushClient, cloudRunResourceProvider };
