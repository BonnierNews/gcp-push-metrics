"use strict";
import { MetricServiceClient } from "@google-cloud/monitoring";
import Counter from "./lib/Counter.js";
import Gauge from "./lib/Gauge.js";
import Summary from "./lib/Summary.js";

export default function PushClient({ projectId, intervalSeconds, logger } = {}) {
  projectId = projectId || process.env.PROJECT_ID;
  if (!projectId) {
    throw new Error("No project ID found");
  }

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

  if (!logger.debug || !logger.error) {
    throw new Error("logger must have methods 'debug' and 'error'");
  }

  const metricsClient = new MetricServiceClient();
  const name = metricsClient.projectPath(projectId);
  const metrics = [];
  let intervalEnd;

  const counter = (config) => {
    const counter = Counter(config);
    metrics.push(counter);
    return counter;
  };

  const gauge = (config) => {
    const gauge = Gauge(config);
    metrics.push(gauge);
    return gauge;
  };

  const summary = (config) => {
    const summary = Summary(config);
    metrics.push(summary);
    return summary;
  };

  const resource = {
    type: "global",
    labels: {
      project_id: projectId,
    },
  };

  async function push(nodeIdSuffix) {
    logger.debug("PushClient: Gathering and pushing metrics");
    try {
      if (nodeIdSuffix) {
        resource.labels.node_id += nodeIdSuffix;
      }

      intervalEnd = Date.now();
      let timeSeries = metrics.map((metric) => metric.toTimeSeries(intervalEnd, resource)).flat();
      logger.debug(`PushClient: Found ${timeSeries.length} time series`);

      metrics.forEach((metric) => metric.intervalReset());

      if (timeSeries.length > 0) {
        logger.debug(`PushClient: Pushing metrics to StackDriver`);
        await metricsClient.createTimeSeries({
          name,
          timeSeries,
        });
        logger.debug(`PushClient: Done pushing metrics to StackDriver`);
      }
    } catch (e) {
      logger.error(`PushClient: Unable to push metrics: ${e}`);
    }
    setTimeout(push, intervalSeconds * 1000);
  }
  setTimeout(push, intervalSeconds * 1000);

  process.on("SIGTERM", push.bind(null, "-exit"));

  return { Counter: counter, Gauge: gauge, Summary: summary };
}
