import metric from "./metric.js";

export default function counter(config) {
  if (!config) {
    throw new Error("Invalid/empty config");
  }
  const baseMetric = metric(config.name, config.labels);
  const createTime = Date.now();
  const intervalReset = () => {};

  const toTimeSeries = (endTime, resource) =>
    baseMetric.pointsFn().map((point) => ({
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
          value: { int64Value: point.value },
        },
      ],
    }));

  return {
    inc: baseMetric.inc,
    points: baseMetric.pointsFn,
    intervalReset,
    toTimeSeries,
  };
}
