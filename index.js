"use strict";
import { MetricServiceClient } from "@google-cloud/monitoring";
import Counter from "./lib/Counter.js";
import Gauge from "./lib/Gauge.js";
import Summary from "./lib/Summary.js";
import http from "http";

export function PushClient({
  projectId,
  intervalSeconds,
  logger,
  resourceProvider,
  labelsProvider,
} = {}) {
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
  if (!resourceProvider) {
    resourceProvider = () => {
      return {
        type: "global",
        labels: {
          project_id: projectId,
        },
      };
    };
  }

  if (!labelsProvider) {
    labelsProvider = () => {
      return {};
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

  let resource, labels;

  async function push(exit) {
    logger.debug("PushClient: Gathering and pushing metrics");
    try {
      if (!resource) {
        resource = await resourceProvider();
      }
      if (!labels) {
        labels = await labelsProvider();
      }

      let globalLabels = labels.labels;
      if (exit) {
        globalLabels = labels.exitLabels;
      }

      intervalEnd = Date.now();
      let timeSeries = metrics
        .map((metric) => metric.toTimeSeries(intervalEnd, resource, globalLabels))
        .flat();
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

  process.on("SIGTERM", push.bind(null, true));

  return { Counter: counter, Gauge: gauge, Summary: summary };
}

export async function CloudRunResourceProvider() {
  const locationResponse = await request("/computeMetadata/v1/instance/region");
  const splitLocation = locationResponse.split("/");
  const location = splitLocation[splitLocation.length - 1];
  return {
    type: "cloud_run_revision",
    labels: {
      project_id: process.env.PROJECT_ID,
      service_name: process.env.K_SERVICE,
      revision_name: process.env.K_REVISION,
      configuration_name: process.env.K_CONFIGURATION,
      location,
    },
  };
}

export async function CloudRunLabelsProvider() {
  const instance_id = await request("/computeMetadata/v1/instance/id");
  return { labels: { instance_id }, exitLabels: { instance_id: `${instance_id}-exit` } };
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
