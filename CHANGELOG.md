## Changelog

# 2.1.0

- Counter/Gauge.inc() + Gauge.dec() now supports specifying a value, like `myCounter.inc(3)` or `myGauge.inc({ color: "blue" }, 4)`.
- Basic validation of initialisation of metrics. Checking that a config object has been passed in and that it contains a name.
