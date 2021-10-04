# GCP Push Metrics

[![Build Status](https://travis-ci.org/BonnierNews/gcp-push-metrics.svg?branch=master)](https://travis-ci.org/BonnierNews/gcp-push-metrics)

This package helps you aggregate and push custom metrics to Google Cloud Monitoring.

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

counter = client.Counter({ name: "num_requests" });
counter.inc();
```

In the above example we import the package and create a client. In order to create a client a GCP project ID is needed. This can either be supplied as an argument to the `PushClient` function, as above, or read from a `PROJECT_ID` environment variable.

We then proceed to create a counter named "num_requests" and increment it. Once 60 seconds has passed the client will try to push a single time series to the Cloud Monitoring API.

> Note: Every time `PushClient` is invoked it will create a new instance which in turn will set up a setTimeout loop that will push metrics collected by the client. In most cases you should only create a single client within your application and expose it as a singleton.

# Credit

The functionality for calculating percentiles was copied and modified from [node-stats-lite](https://github.com/brycebaril/node-stats-lite).
