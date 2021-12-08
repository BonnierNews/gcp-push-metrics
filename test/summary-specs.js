/* eslint-disable no-unused-expressions */
import { expect } from "chai";
import { pushClient } from "../index.js";
import fixture from "./helpers/fixture.js";
import globalResourceProvider from "./helpers/globalResourceProvider.js";

describe("summary with percentiles 50 and 90 and observations 10, 20 and 30 have been recorded", () => {
  let summary;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    summary = client.summary({
      name: "response_time",
      percentiles: [ 0.5, 0.9 ],
    });
    summary.observe(10);
    summary.observe(20);
    summary.observe(30);
    clock.tick(60 * 1000);
  });

  after(() => clock.restore);

  let fiftySeries, ninetySeries;
  it("sends two time series, labeled with the percentiles", () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(2);
    fiftySeries = metricsRequests[0].timeSeries.find((s) => s.metric.labels.percentile === "50");
    expect(fiftySeries).to.not.be.undefined;
    ninetySeries = metricsRequests[0].timeSeries.find((s) => s.metric.labels.percentile === "90");
    expect(ninetySeries).to.not.be.undefined;
  });

  describe("the series for the 50th percentile", () => {
    it("should include a metric type as 'custom.googleapis.com/${the_summary_name}", () => {
      expect(fiftySeries).to.have.property("metric");
      expect(fiftySeries.metric).to.have.property("type", "custom.googleapis.com/response_time");
    });

    it("should include a metricKind as 'GAUGE'", () => {
      expect(fiftySeries).to.have.property("metricKind", "GAUGE");
    });

    it("should include a resource", () => {
      expect(fiftySeries).to.have.property("resource");
      const resource = fiftySeries.resource;
      expect(resource).to.have.property("labels");
      const labels = resource.labels;
      expect(labels).to.have.property("project_id", "myproject");
    });

    let point;
    it("should have a single point", () => {
      expect(fiftySeries.points).to.have.lengthOf(1);
      point = fiftySeries.points[0];
    });
    it("should a point with doubleValue of 20", () => {
      expect(point).to.have.property("value");
      expect(point.value).to.have.property("doubleValue").eql(20);
    });

    it("should have an interval without start time and end time as now", () => {
      expect(point).to.have.property("interval");
      expect(point.interval).to.not.have.property("startTime");
      expect(point.interval).to.have.property("endTime");
      expect(point.interval.endTime.seconds).to.eql(Date.now() / 1000);
    });
  });

  describe("the series for the 90th percentile", () => {
    it("should a point with doubleValue of 30", () => {
      const point = ninetySeries.points[0];
      expect(point).to.have.property("value");
      expect(point.value).to.have.property("doubleValue").eql(30);
    });
  });
});

describe("two summaries", () => {
  let summary1, summary2;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    summary1 = client.summary({
      name: "response_time",
      percentiles: [ 0.5 ],
    });
    summary2 = client.summary({
      name: "outbound_time",
      percentiles: [ 0.5 ],
    });
    clock.tick(60 * 1000);
  });

  after(() => clock.restore);

  describe("when no observations have been recorded", () => {
    it("does not push", () => {
      expect(metricsRequests).to.have.lengthOf(0);
    });
  });

  describe("when both summaries have been observed", () => {
    before(() => {
      summary1.observe(10);
      summary2.observe(20);
      clock.tick(60 * 1000);
    });

    it("should push time series for both summaries", () => {
      expect(metricsRequests).to.have.lengthOf(1);
      const request = metricsRequests[0];
      expect(request.timeSeries).to.have.lengthOf(2);
      expect(
        request.timeSeries.find((s) => s.metric.type === "custom.googleapis.com/response_time")
      ).to.not.be.undefined;
      expect(
        request.timeSeries.find((s) => s.metric.type === "custom.googleapis.com/outbound_time")
      ).to.not.be.undefined;
    });
  });

  describe("when only the first summary has been observed", () => {
    before(() => {
      summary1.observe(10);
      clock.tick(60 * 1000);
    });

    it("should push time series only for the first summary", () => {
      expect(metricsRequests).to.have.lengthOf(2);
      const request = metricsRequests[1];
      expect(request.timeSeries).to.have.lengthOf(1);
      expect(request.timeSeries[0].metric).to.have.property(
        "type",
        "custom.googleapis.com/response_time"
      );
    });
  });
});

describe("observed summary created without percentiles specified", () => {
  let summary;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    summary = client.summary({ name: "response_time" });
    summary.observe(10);
    summary.observe(20);
    summary.observe(30);
    clock.tick(60 * 1000);
  });

  it("sends time series for percentiles 50, 90 and 99", () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(3);
    const fiftySeries = metricsRequests[0].timeSeries.find(
      (s) => s.metric.labels.percentile === "50"
    );
    expect(fiftySeries).to.not.be.undefined;
    const ninetySeries = metricsRequests[0].timeSeries.find(
      (s) => s.metric.labels.percentile === "90"
    );
    expect(ninetySeries).to.not.be.undefined;
    const ninetyNineSeries = metricsRequests[0].timeSeries.find(
      (s) => s.metric.labels.percentile === "99"
    );
    expect(ninetyNineSeries).to.not.be.undefined;
  });
});

describe("summary observed with labels", () => {
  let summary;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    summary = client.summary({
      name: "response_time",
      percentiles: [ 0.5 ],
    });
    summary.observe(10, { code: "2" });
    summary.observe(10, { code: "2" });
    summary.observe(20, { code: "3" });
    summary.observe(30, { code: "2", source: "internal" });
    clock.tick(60 * 1000);
  });

  after(() => clock.restore);

  it("sends time series for each unique label combination", () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(3);

    const twoSeries = metricsRequests[0].timeSeries.find(
      (s) => s.metric.labels.percentile === "50" && s.metric.labels.code === "2"
    );
    expect(twoSeries).to.not.be.undefined;
    expect(twoSeries.points[0].value.doubleValue).to.eql(10);

    const threeSeries = metricsRequests[0].timeSeries.find(
      (s) => s.metric.labels.percentile === "50" && s.metric.labels.code === "3"
    );
    expect(threeSeries).to.not.be.undefined;
    expect(threeSeries.points[0].value.doubleValue).to.eql(20);

    const twoInternalSeries = metricsRequests[0].timeSeries.find(
      (s) =>
        s.metric.labels.percentile === "50" &&
        s.metric.labels.code === "2" &&
        s.metric.labels.source === "internal"
    );
    expect(twoInternalSeries).to.not.be.undefined;
    expect(twoInternalSeries.points[0].value.doubleValue).to.eql(30);
  });
});

describe("summary.timer ended after two seconds", () => {
  let summary;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    summary = client.summary({
      name: "response_time",
      percentiles: [ 0.5 ],
    });
    const end = summary.startTimer();
    setTimeout(end, 2000);
    clock.tick(60 * 1000);
  });

  after(() => clock.restore);

  it("sends a time series for the 50th percentile with 2 (ish) as value", () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
    const fiftySeries = metricsRequests[0].timeSeries.find(
      (s) => s.metric.labels.percentile === "50"
    );
    expect(fiftySeries).to.not.be.undefined;
    expect(fiftySeries.points[0].value.doubleValue).to.approximately(2, 0.1);
  });
});

describe("summary.timer with labels ended after two seconds", () => {
  let summary;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    summary = client.summary({
      name: "response_time",
      percentiles: [ 0.5 ],
    });
    const end = summary.startTimer({
      code: "2xx",
      source: "internal",
    });
    setTimeout(end, 2000);
    clock.tick(60 * 1000);
  });

  after(() => clock.restore);

  it("sends a time series with the labels for the 50th percentile with 2 (ish) as value", () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
    const fiftySeries = metricsRequests[0].timeSeries.find(
      (s) =>
        s.metric.labels.percentile === "50" &&
        s.metric.labels.code === "2xx" &&
        s.metric.labels.source === "internal"
    );
    expect(fiftySeries).to.not.be.undefined;
    expect(fiftySeries.points[0].value.doubleValue).to.approximately(2, 0.1);
  });
});
