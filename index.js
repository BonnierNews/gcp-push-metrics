"use strict";
import { MetricServiceClient } from "@google-cloud/monitoring";

export function clientFactory({ projectId }) {
  //projectId, interval and instance should be options
  const metricsClient = new MetricServiceClient();
  const name = metricsClient.projectPath(projectId);
  const metrics = [];
  let intervalStart = new Date();
  let intervalEnd;
  const counter = (name) => {
    const counter = Counter(name);
    metrics.push(counter);
    return counter;
  };

  const resource = {
    labels: {
      project_id: projectId,
      node_id: uuidv4(),
      location: "global",
      namespace: "na",
    },
  };

  async function push() {
    intervalEnd = new Date();
    let timeSeries = metrics.map(toTimeSeries.bind(null, intervalStart, intervalEnd, resource));
    metrics.forEach((metric) => metric.reset());
    intervalStart = intervalEnd;
    if (metrics.length > 0) {
      await metricsClient.createTimeSeries({
        name,
        timeSeries,
      });
    }

    setTimeout(push, 60 * 1000);
  }
  setTimeout(push, 60 * 1000);

  return { counter, push };
}

function Counter(name) {
  let value = 0;

  const inc = () => {
    value++;
  };

  const valueFn = () => {
    return value;
  };

  const reset = () => {
    value = 0;
  };

  return { name, inc, value: valueFn, reset };
}

function toTimeSeries(startTime, endTime, resource, metric) {
  return {
    metric: {
      type: `custom.googleapis.com/${metric.name}`,
    },
    resource,
    points: [
      {
        interval: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        value: {
          int64Value: metric.value(),
        },
      },
    ],
  };
}
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
