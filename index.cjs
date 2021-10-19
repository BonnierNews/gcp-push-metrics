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
    product.flatMap((previous) => value.map((v) => [previous, v].flat()))
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
function Metric(name, labels) {
  let points = {};

  if (labels) {
    //Add a point for each unique combination of labels
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

  const inc = (labels) => {
    const key = labelsKey(labels);
    if (!points[key]) {
      points[key] = {
        labels,
        value: 0,
      };
    }
    points[labelsKey(labels)].value++;
  };

  const pointsFn = () => {
    return Object.values(points);
  };

  return { name, inc, points, pointsFn };
}

function Counter(config) {
  const metric = Metric(config.name, config.labels);
  const createTime = Date.now();
  const intervalReset = () => {};

  const toTimeSeries = (endTime, resource) => {
    return metric.pointsFn().map((point) => {
      return {
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
      };
    });
  };

  return {
    inc: metric.inc,
    points: metric.pointsFn,
    intervalReset,
    toTimeSeries: toTimeSeries,
  };
}

function Gauge(config) {
  const metric = Metric(config.name, config.labels);

  const dec = (labels) => {
    const key = labelsKey(labels);
    if (!metric.points[key]) {
      metric.points[key] = {
        labels,
        value: 0,
      };
    }

    metric.points[labelsKey(labels)].value--;
  };

  const intervalReset = () => {
    //noop as a gauge should persist its values between intervals
  };

  const toTimeSeries = (endTime, resource) => {
    return metric.pointsFn().map((point) => {
      return {
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
      };
    });
  };

  return {
    inc: metric.inc,
    dec,
    points: metric.pointsFn,
    intervalReset,
    toTimeSeries: toTimeSeries,
  };
}

// The below code has been copied, and modified to suite our needs, from
// https://github.com/brycebaril/node-stats-lite which at the time
// (2021-10-04) was MIT licensed.

function nsort(vals) {
  return vals.sort((a, b) => {
    return a - b;
  });
}

function percentile(sortedValues, ptile) {
  if (sortedValues.length === 0 || ptile == null || ptile < 0) return NaN;

  // Fudge anything over 100 to 1.0
  if (ptile > 1) ptile = 1;
  var i = sortedValues.length * ptile - 0.5;
  if ((i | 0) === i) return sortedValues[i];
  // interpolated percentile -- using Estimation method
  var int_part = i | 0;
  var fract = i - int_part;
  return (
    (1 - fract) * sortedValues[int_part] +
    fract * sortedValues[Math.min(int_part + 1, sortedValues.length - 1)]
  );
}

function Summary(config) {
  const name = config.name;
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

  const toTimeSeries = (endTime, resource) => {
    return Object.values(series)
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
  };

  const startTimer = (labels) => {
    const start = process.hrtime.bigint();
    return () => {
      const delta = Number((process.hrtime.bigint() - start) / BigInt(1e6)) / 1e3;
      observe(delta, labels);
    };
  };

  return { observe, startTimer, intervalReset, toTimeSeries };
}

function PushClient({ intervalSeconds, logger, resourceProvider } = {}) {
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

  const metricsClient = new monitoring.MetricServiceClient();
  const metrics = [];
  let intervalEnd;

  const counter = (config) => {
    const counter = Counter(config);
    metrics.push(counter);
    return counter;
  };

  const gauge = (config) => {
    const gauge = Gauge(config);
    metrics.push(gauge);
    return gauge;
  };

  const summary = (config) => {
    const summary = Summary(config);
    metrics.push(summary);
    return summary;
  };

  let resources;

  async function push(exit) {
    logger.debug("PushClient: Gathering and pushing metrics");
    try {
      if (!resources) {
        resources = await resourceProvider();
      }
      let resource = resources.default;
      if (exit) {
        resource = resources.exit;
      }

      intervalEnd = Date.now();
      let timeSeries = metrics.map((metric) => metric.toTimeSeries(intervalEnd, resource)).flat();
      logger.debug(`PushClient: Found ${timeSeries.length} time series`);

      metrics.forEach((metric) => metric.intervalReset());

      if (timeSeries.length > 0) {
        logger.debug(`PushClient: Pushing metrics to StackDriver`);
        await metricsClient.createTimeSeries({
          name: metricsClient.projectPath(resource.labels.project_id),
          timeSeries,
        });
        logger.debug(`PushClient: Done pushing metrics to StackDriver`);
      }
    } catch (e) {
      logger.error(`PushClient: Unable to push metrics: ${e}`);
    }
    setTimeout(push, intervalSeconds * 1000);
  }
  setTimeout(push, intervalSeconds * 1000);

  process.on("SIGTERM", push.bind(null, true));

  return { Counter: counter, Gauge: gauge, Summary: summary };
}

async function CloudRunResourceProvider() {
  const locationResponse = await request("/computeMetadata/v1/instance/region");
  let instance_id = await request("/computeMetadata/v1/instance/id");
  const splitLocation = locationResponse.split("/");
  const location = splitLocation[splitLocation.length - 1];
  return {
    default: {
      type: "generic_node",
      labels: {
        project_id: process.env.PROJECT_ID,
        namespace: process.env.K_SERVICE,
        node_id: instance_id,
        location,
      },
    },
    exit: {
      type: "generic_node",
      labels: {
        project_id: process.env.PROJECT_ID,
        namespace: process.env.K_SERVICE,
        node_id: `${instance_id}-exit`,
        location,
      },
    },
  };
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

exports.CloudRunResourceProvider = CloudRunResourceProvider;
exports.PushClient = PushClient;
