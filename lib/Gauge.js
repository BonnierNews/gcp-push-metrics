import Metric from "./Metric.js";
import labelsKey from "./labelsKey.js";

export default function Gauge(config) {
  const metric = Metric(config.name, config.labels);

  const dec = (labels, value) => {
    if (labels !== Object(labels)) {
      value = labels;
      labels = null;
    }
    if (value === null || value === undefined) {
      value = 1;
    }

    const key = labelsKey(labels);
    if (!metric.points[key]) {
      metric.points[key] = {
        value: 0,
      };
    }

    metric.points[labelsKey(labels)].value -= value;
  };

  const intervalReset = () => {
    //noop as a gauge should persist its values between intervals
  };

  const toTimeSeries = (endTime, resource) =>
    metric.pointsFn().map((point) => ({
      metric: {
        type: `custom.googleapis.com/${config.name}`,
        labels: point.labels,
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
    }));

  return {
    inc: metric.inc,
    dec,
    points: metric.pointsFn,
    intervalReset,
    toTimeSeries: toTimeSeries,
  };
}
