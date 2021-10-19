# GCP Push Metrics

[![Build Status](https://travis-ci.org/BonnierNews/gcp-push-metrics.svg?branch=master)](https://travis-ci.org/BonnierNews/gcp-push-metrics)

This package helps you aggregate and push custom metrics to Google Cloud Monitoring from Node.js applications, for instance running using Google Cloud Run.

Using this package you can collect three types of metrics: counters, gauges and summaries. The values are aggregated in memory and every 60 seconds pushed to the [Cloud Monitoring API](https://cloud.google.com/monitoring/custom-metrics/creating-metrics).

Its API is heavily inspired by the excellent [prom-client](https://github.com/siimon/prom-client/) but the inner workings are very different. As it was initially written for a scenario where applications using Prometheus for metrics was being migrated to Cloud Monitoring out of necessity there will be some comparisons with prom-client throughout this document.

# Installation

```
npm install @bonniernews/gcp-push-metrics
```

# Usage

Let's start by looking at a basic use case, creating a counter and incrementing it.

```
import PushClient from "@bonniernews/gcp-push-metrics";

const client = PushClient({ projectId: "myproject" });

const counter = client.Counter({ name: "num_requests" });
counter.inc();
```

In the above example we import the package and create a client. In order to create a client a GCP project ID is needed. This can either be supplied as an argument to the `PushClient` function, as above, or read from a `PROJECT_ID` environment variable.

We then proceed to create a counter named "num_requests" and increment it. Once 60 seconds has passed the client will try to push a single time series to the Cloud Monitoring API.

> Note: Every time `PushClient` is invoked it will create a new instance which in turn will set up a setTimeout loop that will push metrics collected by the client. In most cases you should only create a single client within your application and expose it as a singleton.

# Counters

Counters are implemented as the CUMULATIVE metric kind and the value reported will continously increase. Let's look at an example:

```
const counter = client.Counter({ name: "num_requests" });

setTimeout(() => {
    counter.inc();
    counter.inc();
}, 61 * 1000);

setTimeout(() => {
    counter.inc();
}, 121 * 1000);
```

After 60 seconds the client will push a time series with metric type "custom.googleapis.com/num_request" metric. The value will be **0**.

After 120 seconds the client will again push a time series, this time with the value **2**.

After 180 seconds the client will push the time series with **3** as value.

After 240 seconds the client will again push the time series with **3** as value.

# Gauges

Gauges are point in time metrics that can both be increased and decresed. Example:

```
const gauge = client.Gauge({ name: "requests_in_progress" });

setTimeout(() => {
    gauge.inc();
    gauge.inc();
}, 61 * 1000);

setTimeout(() => {
    gauge.dec();
}, 121 * 1000);
```

After 60 seconds the client will push a time series with metric type "custom.googleapis.com/requests_in_progress" metric. The value will be **0**.

After 120 seconds the client will again push a time series, this time with the value **2**.

After 180 seconds the client will push the time series with **1** as value.

After 240 seconds the client will again push the time series with **1** as value.

# Summaries

Summaries aggregate and calculate percentiles from observed values. The observed values are reset between each interval (60 seconds). Contrary to counters and gauges summary metrics will only be sent if there is at least one observation during the interval. Example:

```
const summary = client.Summary({
    name: "response_time",
    percentiles: [0.5, 0.9]
});

setTimeout(() => {
    summary.observe(10);
    summary.observe(20);
    summary.observe(30);
}, 61 * 1000);
```

After 60 seconds the client will **not send any time series** as there has been no observations.

After 120 seconds the client will push two time series. Both will have metric type "custom.googleapis.com/response_time" but they will differ in their labels. One will be labeled `percentile: 50` and one `percentile: 90`. The first will have **20** as value and the latter will have **30** as value.

After 180 seconds the client will again **not send any time series** as there has been no observations in the passed interval.

> Note: `prom-client` also pushes the number of observations and the sum of all observations. This library does not.

## Default percentiles

If you don't specify percentiles when creating a summary it will default to `[0.5, 0.9, 0.99]`. Note that this is different from `prom-client` which defaults to `[0.01, 0.05, 0.5, 0.9, 0.95, 0.99, 0.999]`.

## Timers

As summaries are commonly used to measure execution or response times the summary object provides a convenience method for observing durations:

```
const summary = client.Summary({
    name: "response_time",
});

const end = summary.startTimer();

// Do something time consuming

end();
```

# Labels

All methods for changing the values of metrics (counter.inc, summary.observe etc) supports an optional labels object which can contain one or more labels and values. Let's look at an example:

```
const counter = client.Counter({ name: "num_requests" });

setTimeout(() => {
    counter.inc({ response_code: "2xx" });
    counter.inc({ response_code: "2xx" });
    counter.inc({ response_code: "3xx" });
}, 61 * 1000);
```

After 60 seconds the client will push a single time series with metric type "custom.googleapis.com/num_requests" and **0** as value.

Once 120 seconds has passed the client will push three time series. All three will have type "custom.googleapis.com/num_requests" but they will differ in labels. One will not have any labels at all. Another will have `{ response_code: "2xx" }` as labels and **2** as value. The last one will have `{ response_code: "3xx" }` as labels and **1** as value.

## Default labels for counters and gauges

As we saw in the above example the client will push time series for created counters without labels as well as for incremented counters with labels. In other words, by default:

- Counters (and gauges) that are intended to be used only with labels are still pushed as time series without labels.
- When labels are used in the call to `inc` the time series will only be pushed after `inc` has been called at least once.

This behavior can be changed by specifying labels when creating counters and gauges. In order to disable sending the un-labeled version of these metric types we can create them with an empty labels object, like this:

```
const counter = client.Counter({ labels: {} });
```

We can also specify known label combinations up front, like this:

```
const counter = client.Counter({
    labels: {
        response_code: ["2xx", "3xx", "4xx", "5xx"]
    }
});
```

Let's look at a concrete example:

```
const counter = client.Counter({
    labels: {
        response_code: ["2xx", "3xx", "4xx", "5xx"],
        source: ["internal", "cdn"]
    }
});

setTimeout(() => {
    counter.inc({ response_code: "2xx", source: "internal" });
    counter.inc({ response_code: "2xx", source: "internal" });
}, 61 * 1000);

setTimeout(() => {
    counter.inc();
    counter.inc({ response_code: "2xx", source: "unknown" });
}, 121 * 1000);
```

After 60 seconds the client will push a total of **ten** time series, all with **0** as values. Each time series will be labeled with one of the combinations among the labels we specified when creating the counter, for instance `{ response_code: "3xx", source: "cdn" }`. Note that the client will not send a time series without labels.

After 120 the client will again push **ten** time series. The one labeled with `{ response_code: "2xx", source: "internal" }` will now have **2** as value.

After 180 seconds the client will push **twelve** time series. Ten of them will be the same as before. The other two will be for the previously unseen label combinations, meaning one with `{ response_code: "2xx", source: "unknown" }` as labels and one without labels.

# Resource and node ID

When pushing metrics to Cloud Monitoring one must specify a resource type. The client uses the [generic_node](https://cloud.google.com/monitoring/api/resources#tag_generic_node) resource type. It sets `node_id` to a unique value which is generated when the client is created. This means that each client will create unique time series for each metric and in most cases you will want to aggregate metrics, combining multiple series from different resources, when viewing metrics or createing dashboards.

# Maximum 200 time series

The Cloud Monitoring API currently supports a maximum of 200 time series in a single API call. This means that currently this package will only work with 200 or less time series. In the future we may implement functionality to split a greater number of time series into multiple requests.

# Development/packaging

As the package is built using ES6 modules we also need to ship a CommonJS dist. This is done in the form of `index.cjs` which is generated using `npm run dist`. This command should always be run prior to `npm publish`.

# Credit

The functionality for calculating percentiles was copied and modified from [node-stats-lite](https://github.com/brycebaril/node-stats-lite).
