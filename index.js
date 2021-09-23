"use strict";
import { MetricServiceClient } from "@google-cloud/monitoring";

export function PushClient({ projectId, intervalSeconds, logger } = {}) {
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
  let intervalStart = new Date();
  let intervalEnd;
  const counter = (name, labels) => {
    const counter = Counter(name, labels);
    metrics.push(counter);
    return counter;
  };

  const gauge = (name, labels) => {
    const gauge = Gauge(name, labels);
    metrics.push(gauge);
    return gauge;
  };

  const resource = {
    labels: {
      project_id: projectId,
      node_id: randomId(),
      location: "global",
      namespace: "na",
    },
  };

  async function push(nodeIdSuffix) {
    logger.debug("PushClient: Gathering and pushing metrics");
    try {
      if (nodeIdSuffix) {
        resource.labels.node_id += nodeIdSuffix;
      }
      intervalEnd = new Date();
      let timeSeries = metrics
        .map(toTimeSeries.bind(null, intervalStart, intervalEnd, resource))
        .flat();
      metrics.forEach((metric) => metric.intervalReset());
      intervalStart = intervalEnd;
      logger.debug(`PushClient: Found ${timeSeries.length} time series`);
      if (timeSeries.length > 0) {
        logger.debug(`PushClient: Pushing metrics to StackDriver`);
        await metricsClient.createTimeSeries({
          name,
          timeSeries,
        });
        logger.debug(`PushClient: Done pushing metrics to StackDriver`);
      }

      setTimeout(push, intervalSeconds * 1000);
    } catch (e) {
      logger.error(`PushClient: Unable to push metrics: ${e}`);
    }
  }
  setTimeout(push, intervalSeconds * 1000);

  process.on("SIGTERM", push.bind(null, "-exit"));

  return { counter, gauge, push };
}

// "Base" factory function used by Counter and Gauge
function Metric(name, labels) {
  let points = {};

  if (labels) {
    //Add a point for each unique combination of labels
    const combinations = labelCombinations(labels);
    combinations.forEach((combo) => {
      const key = labelsKey(combo);
      points[key] = {
        labels: combo,
        value: 0,
      };
    });
  } else {
    points[labelsKey()] = {
      labels: null,
      value: 0,
    };
  }

  const inc = (labels) => {
    const key = labelsKey(labels);
    if (!points[key]) {
      points[key] = {
        labels,
        value: 0,
      };
    }
    points[labelsKey(labels)].value++;
  };

  const dec = (labels) => {
    const key = labelsKey(labels);
    if (!points[key]) {
      points[key] = {
        labels,
        value: 0,
      };
    }
    points[labelsKey(labels)].value--;
  };

  const pointsFn = () => {
    return Object.values(points);
  };

  return { name, inc, dec, points, pointsFn };
}

function Counter(name, labels) {
  const metric = Metric(name, labels);

  const intervalReset = () => {
    Object.values(metric.points).forEach((point) => {
      point.value = 0;
    });
  };

  const kind = () => "CUMULATIVE";

  return { name, inc: metric.inc, points: metric.pointsFn, intervalReset, kind };
}

function Gauge(name, labels) {
  const metric = Metric(name, labels);

  const dec = (labels) => {
    const key = labelsKey(labels);
    if (!metric.points[key]) {
      metric.points[key] = {
        labels,
        value: 0,
      };
    }

    metric.points[labelsKey(labels)].value--;
  };

  const intervalReset = () => {
    //noop as a gauge should persist its values between intervals
  };

  const kind = () => "GAUGE";

  return { name, inc: metric.inc, dec, points: metric.pointsFn, intervalReset, kind };
}

function toTimeSeries(startTime, endTime, resource, metric) {
  return metric.points().map((point) => {
    return {
      metric: {
        type: `custom.googleapis.com/${metric.name}`,
        labels: point.labels,
      },
      metricKind: metric.kind(),
      resource,
      points: [
        {
          interval: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
          value: {
            int64Value: point.value,
          },
        },
      ],
    };
  });
}

function randomId() {
  return Math.random().toString(36).substr(2, 11);
}

function labelCombinations(labels) {
  if (Object.keys(labels).length === 0) {
    return [];
  }
  return labelCombinationsForKeys(labels, Object.keys(labels));
}

function labelCombinationsForKeys(labelsObj, keys) {
  const result = [];
  const myValues = labelsObj[keys[0]];
  const remainder = keys.slice(1);
  myValues.forEach((value) => {
    if (remainder.length > 0) {
      const remainderCombinations = labelCombinationsForKeys(labelsObj, remainder);
      remainderCombinations.forEach((combo) => {
        const valueObj = {};
        valueObj[keys[0]] = value;
        Object.assign(valueObj, combo);
        result.push(valueObj);
      });
    } else {
      const valueObj = {};
      valueObj[keys[0]] = value;
      result.push(valueObj);
    }
  });
  return result;
}

function labelsKey(labels) {
  if (!labels) {
    return "no-labels";
  }
  return JSON.stringify(labels, Object.keys(labels).sort());
}
