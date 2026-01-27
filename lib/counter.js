import metric from "./metric.js";

export default function counter(config, logger) {
  if (!config) throw new Error("Invalid/empty config");
  if (!config.name) throw new Error("Counter name is required");

  const baseMetric = metric(config.name, config, logger);
  const createTime = Date.now();

  // Delete dynamically keys to avoid memory leak / cost over time with inactive metrics.
  const intervalReset = () => {
    const points = baseMetric.pointsReferenceFn();
    for (const [ key, val ] of Object.entries(points)) {
      if (!val.isPredefined) {
        delete points[key];
      }
    }
  };

  const toTimeSeries = (endTime, resource) =>
    baseMetric.pointsFn().map((point) => ({
      metric: {
        type: `custom.googleapis.com/${config.name}`,
        labels: point.labels,
      },
      metricKind: "CUMULATIVE", // TODO: tillåta 'inc' på counter?
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
