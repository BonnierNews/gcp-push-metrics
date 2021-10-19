"use strict";

import Metric from "./Metric.js";
import labelsKey from "./labelsKey.js";

export default function Gauge(config) {
  const metric = Metric(config.name, config.labels);

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

  const toTimeSeries = (endTime, resource) => {
    return metric.pointsFn().map((point) => {
      return {
        metric: {
          type: `custom.googleapis.com/${config.name}`,
          labels: Object.assign({}, point.labels),
        },
        metricKind: "GAUGE",
        resource,
        points: [
          {
            interval: {
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
    dec,
    points: metric.pointsFn,
    intervalReset,
    toTimeSeries: toTimeSeries,
  };
}
