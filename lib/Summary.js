import { nsort, percentile } from "./stats.js";
import labelsKey from "./labelsKey.js";

export default function Summary(config) {
  if (!config) {
    throw new Error("Invalid/empty config");
  }

  const name = config.name;
  if (!name) {
    throw new Error("name is required");
  }

  const percentiles = (config && config.percentiles) || [0.5, 0.9, 0.99];
  const series = {};

  const intervalReset = () => {
    Object.values(series).forEach((s) => {
      s.observations.length = 0;
    });
  };

  const observe = (observation, labels) => {
    const key = labelsKey(labels);
    if (!series[key]) {
      series[key] = {
        labels,
        observations: [],
      };
    }
    series[key].observations.push(observation);
  };

  const toTimeSeries = (endTime, resource) =>
    Object.values(series)
      .filter((s) => s.observations.length)
      .flatMap((s) => {
        const observations = s.observations;
        nsort(observations);
        return percentiles.map((p) => {
          const labels = Object.assign(
            {
              percentile: (p * 100).toString(),
            },
            s.labels
          );
          return {
            metric: {
              type: `custom.googleapis.com/${name}`,
              labels,
            },
            metricKind: "GAUGE",
            resource,
            points: [
              {
                interval: {
                  //startTime: { seconds: startTime / 1000 },
                  endTime: { seconds: endTime / 1000 },
                },
                value: {
                  doubleValue: percentile(observations, p) || 0,
                },
              },
            ],
          };
        });
      });

  const startTimer = (labels) => {
    const start = process.hrtime.bigint();
    return () => {
      const delta = Number((process.hrtime.bigint() - start) / BigInt(1e6)) / 1e3;
      observe(delta, labels);
    };
  };

  return { observe, startTimer, intervalReset, toTimeSeries };
}
