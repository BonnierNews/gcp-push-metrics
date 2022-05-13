import metric from "./metric.js";
import labelsKey from "./labelsKey.js";

export default function gauge(config) {
  if (!config) {
    throw new Error("Invalid/empty config");
  }
  const baseMetric = metric(config.name, config.labels);

  const dec = (labels, value) => {
    if (labels !== Object(labels)) {
      value = labels;
      labels = null;
    }
    if (value === null || value === undefined) {
      value = 1;
    }

    const key = labelsKey(labels);
    if (!baseMetric.points[key]) {
      baseMetric.points[key] = {
        labels,
        value: 0,
      };
    }

    baseMetric.points[labelsKey(labels)].value -= value;
  };

  const intervalReset = () => {
    // noop as a gauge should persist its values between intervals
  };

  const toTimeSeries = (endTime, resource) =>
    baseMetric.pointsFn().map((point) => ({
      metric: {
        type: `custom.googleapis.com/${config.name}`,
        labels: point.labels,
      },
      metricKind: "GAUGE",
      resource,
      points: [
        {
          interval: { endTime: { seconds: endTime / 1000 } },
          value: { int64Value: point.value },
        },
      ],
    }));

  return {
    inc: baseMetric.inc,
    dec,
    points: baseMetric.pointsFn,
    intervalReset,
    toTimeSeries,
  };
}
