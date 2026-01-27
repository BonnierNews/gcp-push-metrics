import labelsKey from "./labelsKey.js";
import labelCombinations from "./labelCombinations.js";
import { createPoint, SERIES_TYPES } from "./createPoint.js";

// "Base" functionality used by Counter and Gauge
export default function metric(name, config = {}, logger) {
  if (!name) {
    throw new Error("name is required");
  }

  const DEFAULT_TOTAL_LIMIT = 10;

  const seriesType = SERIES_TYPES[config?.seriesType] ?? SERIES_TYPES.CONTINUOUS;

  const predefinedLabels = config.labels ?? null;

  const totalLimit = config.limit ?? DEFAULT_TOTAL_LIMIT;
  const isLargeMetric = config.allowHighCardinality ?? false;

  const points = {};

  // Will allocate predefined timeseries
  if (predefinedLabels) {
    // Add a point for each unique combination of labels
    const combinations = labelCombinations(predefinedLabels);

    if (!isLargeMetric && combinations.length > totalLimit) {
      throw new Error(
        `[Metrics] "${name}" failed to initialize: The combination of predefined labels would result in ${combinations.length} time series, ` +
      `which exceeds the limit of ${totalLimit}. High cardinality can lead to memory issues and high costs in Google Cloud Monitoring.
      If behaviour is intended, please adjust the configuration.`
      );
    }

    logger.debug({ labels: predefinedLabels }, `Setup metric for ${name} with labels`);
    combinations.forEach((combo) => {
      const key = labelsKey(combo);
      points[key] = createPoint({ labels: combo, value: 0, seriesType });

    });
  } else {
    points[labelsKey()] = createPoint({ labels: null, value: 0, seriesType });
  }

  const inc = (incLabels, value) => {
    if (incLabels !== Object(incLabels)) {
      value = incLabels;
      incLabels = null;
    }
    if (value === null || value === undefined) {
      value = 1;
    }
    // TODO:  Still dangerous - e.g. a user sending in 'uuid' => new transient metric each time. // e.g. traceId
    if (!isLargeMetric && incLabels && Object.keys(incLabels).length > DEFAULT_TOTAL_LIMIT) {
      logger.warn({ labels: incLabels }, `Metric: ${name}, High cardinality detected`);
    }

    const key = labelsKey(incLabels);
    if (!points[key]) {
      points[key] = createPoint({ labels: incLabels, value: 0 });
    }
    points[key].value += value;
  };

  const pointsFn = () => Object.values(points);
  const pointsReferenceFn = () => points;

  return { name, inc, points, pointsFn, pointsReferenceFn };
}
