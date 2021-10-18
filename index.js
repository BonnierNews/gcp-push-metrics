"use strict";
import { MetricServiceClient } from "@google-cloud/monitoring";
import Counter from "./lib/Counter.js";
import Gauge from "./lib/Gauge.js";
import Summary from "./lib/Summary.js";
import http from "http";

export function PushClient({ projectId, intervalSeconds, logger, resourceProvider } = {}) {
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

  let resource;
  // const resource = {
  //   type: "global",
  //   labels: {
  //     project_id: projectId,
  //   },
  // };

  async function push(nodeIdSuffix) {
    logger.debug("PushClient: Gathering and pushing metrics");
    try {
      if (!resource) {
        resource = await resourceProvider();
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
      console.log(e);
    }
    setTimeout(push, intervalSeconds * 1000);
  }
  setTimeout(push, intervalSeconds * 1000);

  process.on("SIGTERM", push.bind(null, "-exit"));

  return { Counter: counter, Gauge: gauge, Summary: summary };
}

export async function CloudRunResourceProvider() {
  const location = await request("/computeMetadata/v1/instance/region");
  const instance_id = await request("/computeMetadata/v1/instance/id");
  return {
    type: "cloud_run_revision",
    labels: {
      project_id: process.env.PROJECT_ID,
      service_name: process.env.K_SERVICE,
      revision_name: process.env.K_REVISION,
      configuration_name: process.env.K_CONFIGURATION,
      location,
      instance_id,
    },
  };
}

export async function CloudRunLabelsProvider() {
  return {};
}

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "metadata.google.internal",
      port: 80,
      path,
      method: "GET",
      timeout: 200,
      headers: {
        "Metadata-Flavor": "Google",
      },
    };
    const req = http.request(options, (resp) => {
      let data = "";
      resp.on("data", (chunk) => {
        data += chunk;
      });

      resp.on("end", () => {
        resolve(data);
      });
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.end();
  });
}
