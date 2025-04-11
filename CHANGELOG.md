# Changelog

## 4.1.0
- Added parameter `disabled` for disabling pushing metrics locally

## 4.0.0

- Bumped deps
- Breaking change: Require node version >=18.18

## 3.2.1

- Fix cjs dist

## 3.2.0

- Expose grpc options `keepalive_timeout_ms` and `keepalive_time_ms` to counter DEADLINE_EXCEEDED errors thrown by google when pushing metrics.

## 3.1.1

- Bump deps

## 3.1.0

- Increased default timeout, from 12 to 40 seconds, when sending metrics to GCP. The timeout can also be configured.

## 3.0.0

- Breaking: all functions that return objects have been renamed to use camel case to be in line with new linting rules.
- Switched linting rules to eslint-config-exp

## 2.1.1

- Fixed bug introduced in 2.1.0 where counters and gauge incremented with labels didn't preserve the labels.

## 2.1.0

- Counter/Gauge.inc() + Gauge.dec() now supports specifying a value, like `myCounter.inc(3)` or `myGauge.inc({ color: "blue" }, 4)`.
- Basic validation of initialisation of metrics. Checking that a config object has been passed in and that it contains a name.
