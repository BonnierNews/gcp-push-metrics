# Changelog

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
