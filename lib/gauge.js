import metric from "./metric.js";
import labelsKey from "./labelsKey.js";
import createPoint from "./createPoint.js";

export default function gauge(config, logger) {
  if (!config) throw new Error("Invalid/empty config");
  if (!config.name) throw new Error("Gauge name is required");

  const baseMetric = metric(config.name, config, logger);

  const dec = (labels, value) => {
    if (labels !== Object(labels)) {
      value = labels;
      labels = null;
    }
    if (value === null || value === undefined) {
      value = 1;
    }
    // TODO: double key call
    const key = labelsKey(labels);
    if (!baseMetric.points[key]) {
      baseMetric.points[key] = createPoint({ labels, value: 0, isPredefined: false });
    }

    baseMetric.points[labelsKey(labels)].value -= value;
  };

  const set = (labels, value) => {

    if (labels !== Object(labels)) {
      value = labels;
      labels = null;
    }

    const key = labelsKey(labels);
    if (!baseMetric.points[key]) {
      baseMetric.points[key] = { labels };
    }

    baseMetric.points[key].value = value;
  };

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
    baseMetric.pointsFn().map((point) => (
      {
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
    set,
    points: baseMetric.pointsFn,
    intervalReset,
    toTimeSeries,
  };
}
