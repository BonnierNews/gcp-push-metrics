import Metric from "./Metric.js";

export default function Counter(config) {
  const metric = Metric(config.name, config.labels);
  const createTime = Date.now();
  const intervalReset = () => {};

  const toTimeSeries = (endTime, resource) =>
    metric.pointsFn().map((point) => ({
      metric: {
        type: `custom.googleapis.com/${config.name}`,
        labels: point.labels,
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
    }));

  return {
    inc: metric.inc,
    points: metric.pointsFn,
    intervalReset,
    toTimeSeries: toTimeSeries,
  };
}
