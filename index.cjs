'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var monitoring = require('@google-cloud/monitoring');
var http = require('http');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var http__default = /*#__PURE__*/_interopDefaultLegacy(http);

function labelsKey(labels) {
  if (!labels) {
    return "no-labels";
  }
  return JSON.stringify(labels, Object.keys(labels).sort());
}

/**
 * Calculates the Cartesian product of a number of values
 *
 * @template T
 * @param {...T[]} values - Any number of arrays to combine to a product
 * @returns {T[]} - The cartesian product of the values
 *
 * @example cartesianProduct([17])
 * //=> [17]
 * @example cartesianProduct([17], [4711])
 * //=> [17, 4711]
 * @example cartesianProduct([17, 4711], [42, 1])
 * //=> [[17, 42], [17, 1], [4711, 42], [4711, 1]]
 */
const cartesianProduct = (...values) =>
  values.reduce((product, value) =>
    product.flatMap((previous) => value.map((v) => [ previous, v ].flat()))
  );

/**
 * Combines all given labels with all values
 *
 * @template T
 * @param {{[key: string]: T[]}} labels - An object mapping labels to values
 * @returns {{[key: string]: T}[]}
 *
 * @example combination({})
 * //=> []
 * @example combination({foo: [17]})
 * //=> [{foo: 17}]
 * @example combination({foo: [17, 4711]})
 * //=> [{foo: 17}, {foo: 4711}]
 * @example combination({
 *   foo: [17, 4711]
 * })
 * //=> [{foo: 17}, {foo: 4711}]
 * @example combination({
 *   foo: [17, 4711],
 *   bar: [42, 1]
 * })
 * //=> [{
 *   foo: 17, bar: 42
 * }, {
 *   foo: 17, bar: 1
 * }, {
 *   foo: 4711, bar: 42
 * }, {
 *   foo: 4711, bar: 1
 * }]
 */
function labelCombinations(labels) {
  const values = Object.values(labels);

  if (values.length === 0) return [];

  return cartesianProduct(...values).map((value) =>
    Object.fromEntries(
      Object.keys(labels).map((label, index) => [
        label,
        Array.isArray(value) ? value[index] : value,
      ])
    )
  );
}

// "Base" functionality used by Counter and Gauge
function metric(name, labels) {
  if (!name) {
    throw new Error("name is required");
  }

  const points = {};

  if (labels) {
    // Add a point for each unique combination of labels
    const combinations = labelCombinations(labels);
    combinations.forEach((combo) => {
      const key = labelsKey(combo);
      points[key] = {
        labels: combo,
        value: 0,
      };
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

function counter(config) {
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
          value: {
            int64Value: point.value,
          },
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

function gauge(config) {
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
    inc: baseMetric.inc,
    dec,
    points: baseMetric.pointsFn,
    intervalReset,
    toTimeSeries,
  };
}

// The below code has been copied, and modified to suite our needs, from
// https://github.com/brycebaril/node-stats-lite which at the time
// (2021-10-04) was MIT licensed.

function nsort(vals) {
  return vals.sort((a, b) => a - b);
}

function percentile(sortedValues, ptile) {
  if (sortedValues.length === 0 || !ptile || ptile < 0) return NaN;

  // Fudge anything over 100 to 1.0
  if (ptile > 1) ptile = 1;
  const i = sortedValues.length * ptile - 0.5;
  if ((i | 0) === i) return sortedValues[i];
  // interpolated percentile -- using Estimation method
  const intPart = i | 0;
  const fract = i - intPart;
  return (
    (1 - fract) * sortedValues[intPart] +
    fract * sortedValues[Math.min(intPart + 1, sortedValues.length - 1)]
  );
}

function summary(config) {
  if (!config) {
    throw new Error("Invalid/empty config");
  }

  const name = config.name;
  if (!name) {
    throw new Error("name is required");
  }

  const percentiles = (config && config.percentiles) || [ 0.5, 0.9, 0.99 ];
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

async function cloudRunResourceProvider() {
  /* eslint-disable camelcase*/
  const [ project_id, locationResponse, instance_id ] = await Promise.all([
    request("/computeMetadata/v1/project/project-id"),
    request("/computeMetadata/v1/instance/region"),
    request("/computeMetadata/v1/instance/id"),
  ]);
  const splitLocation = locationResponse.split("/");
  const location = splitLocation[splitLocation.length - 1];
  return {
    default: {
      type: "generic_node",
      labels: {
        project_id,
        namespace: process.env.K_SERVICE,
        node_id: instance_id,
        location,
      },
    },
    exit: {
      type: "generic_node",
      labels: {
        project_id,
        namespace: process.env.K_SERVICE,
        node_id: `${instance_id}-exit`,
        location,
      },
    },
  };
  /* eslint-enable camelcase*/
}

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "metadata.google.internal",
      port: 80,
      path,
      method: "GET",
      timeout: 200,
      headers: {
        "Metadata-Flavor": "Google",
      },
    };
    const req = http__default["default"].request(options, (resp) => {
      let data = "";
      resp.on("data", (chunk) => {
        data += chunk;
      });

      resp.on("end", () => {
        resolve(data);
      });
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.end();
  });
}

function pushClient({ intervalSeconds, logger, resourceProvider, grpcKeepaliveTimeoutMs, grpcKeepaliveTimeMs } = {}) {
  if (intervalSeconds < 1) {
    throw new Error("intervalSeconds must be at least 1");
  }
  if (!intervalSeconds) {
    intervalSeconds = 60;
  }

  if (!logger) {
    logger = {
      debug() {},
      error() {},
    };
  }
  if (!resourceProvider) {
    throw new Error("no resourceProvider");
  }

  if (!logger.debug || !logger.error) {
    throw new Error("logger must have methods 'debug' and 'error'");
  }

  const opts = {};

  if (grpcKeepaliveTimeoutMs) {
    opts["grpc.keepalive_timeout_ms"] = grpcKeepaliveTimeoutMs;
  }

  if (grpcKeepaliveTimeMs) {
    opts["grpc.keepalive_time_ms"] = grpcKeepaliveTimeMs;
  }

  const metricsClient = new monitoring.MetricServiceClient(opts);
  const metrics = [];
  let intervalEnd;

  const createCounter = (config) => {
    const counterMetric = counter(config);
    metrics.push(counterMetric);
    return counterMetric;
  };

  const createGauge = (config) => {
    const gaugeMetric = gauge(config);
    metrics.push(gaugeMetric);
    return gaugeMetric;
  };

  const createSummary = (config) => {
    const summaryMetric = summary(config);
    metrics.push(summaryMetric);
    return summaryMetric;
  };

  let resources;

  async function push(exit) {
    logger.debug("pushClient: Gathering and pushing metrics");
    try {
      if (!resources) {
        resources = await resourceProvider();
      }
      let resource = resources.default;
      if (exit) {
        resource = resources.exit;
      }

      intervalEnd = Date.now();
      const timeSeries = metrics.map((metric) => metric.toTimeSeries(intervalEnd, resource)).flat();
      logger.debug(`pushClient: Found ${timeSeries.length} time series`);

      metrics.forEach((metric) => metric.intervalReset());

      logger.debug(`pushClient: found ${timeSeries.length} time series which should be pushed`);

      // StackDriver/Cloud Monitoring has a limit of 200 time series per requests
      // so we split our time series into multiple requests if needed
      const requests = [];
      for (let i = 0; i < timeSeries.length; i += 200) {
        const chunk = timeSeries.slice(i, i + 200);
        requests.push(
          metricsClient.createTimeSeries({
            name: metricsClient.projectPath(resource.labels.project_id),
            timeSeries: chunk,
          })
        );
      }
      await Promise.all(requests);
      logger.debug("pushClient: Done pushing metrics to StackDriver");
    } catch (e) {
      logger.error(`pushClient: Unable to push metrics: ${e}. Stack: ${e.stack}`);
    }
    setTimeout(push, intervalSeconds * 1000);
  }
  setTimeout(push, intervalSeconds * 1000);

  process.on("SIGTERM", push.bind(null, true));

  return { counter: createCounter, gauge: createGauge, summary: createSummary };
}

exports.cloudRunResourceProvider = cloudRunResourceProvider;
exports.pushClient = pushClient;
