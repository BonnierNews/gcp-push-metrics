"use strict";

import Metric from "./Metric.js";

export default function Counter(config) {
  const metric = Metric(config.name, config.labels);
  const createTime = Date.now();
  const intervalReset = () => {};

  const toTimeSeries = (endTime, resource, globalLabels) => {
    return metric.pointsFn().map((point) => {
      return {
        metric: {
          type: `custom.googleapis.com/${config.name}`,
          labels: Object.assign({}, point.labels, globalLabels),
        },
        metricKind: "CUMULATIVE",
        resource,
        points: [
          {
            interval: {
              startTime: { seconds: createTime / 1000 },
              endTime: { seconds: endTime / 1000 },
            },
            value: {
              int64Value: point.value,
            },
          },
        ],
      };
    });
  };

  return {
    inc: metric.inc,
    points: metric.pointsFn,
    intervalReset,
    toTimeSeries: toTimeSeries,
  };
}
