import labelsKey from "./labelsKey.js";
import labelCombinations from "./labelCombinations.js";

// "Base" functionality used by Counter and Gauge
export default function metric(name, config = {}, logger) {
  if (!name) {
    throw new Error("name is required");
  }

  const DEFAULT_TOTAL_LIMIT = 100;

  const predefinedLabels = config.predefined?.labels ?? config.labels ?? null;
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
      If behaviour is intended, please adjust the configuration: {  limit || allowHighCardinality } .`
      );
    }

    combinations.forEach((combo) => {
      const key = labelsKey(combo);
      points[key] = {
        labels: combo,
        value: 0,
      };

      logger.debug(`Setup metric for ${name} with labels: ${JSON.stringify(predefinedLabels)}`);

    });
  } else {
    points[labelsKey()] = {
      labels: null,
      value: 0,
    };
  }
  const inc = (incLabels, value) => {
    if (incLabels !== Object(incLabels)) {
      value = incLabels;
      incLabels = null;
    }
    if (value === null || value === undefined) {
      value = 1;
    }

    const key = labelsKey(incLabels);
    if (!points[key]) {
      points[key] = {
        labels: incLabels,
        value: 0,
      };
    }
    points[labelsKey(incLabels)].value += value;
  };

  const pointsFn = () => Object.values(points);

  return { name, inc, points, pointsFn };
}
