/* eslint-disable no-unused-expressions */
import { expect } from "chai";
import { PushClient } from "../index.js";
import fixture from "./helpers/fixture.js";
import globalResourceProvider from "./helpers/globalResourceProvider.js";

describe("counter", () => {
  let timeOfInit;
  let counter;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    timeOfInit = Date.now() / 1000;
    const client = PushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    counter = client.Counter({ name: "num_requests" });
    clock.tick(60 * 1000);
  });

  after(() => clock.restore);

  let counterSeries;
  it("sends a single timeSeries", async () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
    counterSeries = metricsRequests[0].timeSeries[0];
  });

  it("sends name as the project path", async () => {
    expect(metricsRequests[0]).to.have.property("name", "projectpath:myproject");
  });

  describe("sent time series", () => {
    it("should include a metric type as 'custom.googleapis.com/${the_counter_name}", () => {
      expect(counterSeries).to.have.property("metric");
      expect(counterSeries.metric).to.have.property("type", "custom.googleapis.com/num_requests");
    });

    it("should include a metricKind as 'CUMULATIVE'", () => {
      expect(counterSeries).to.have.property("metricKind", "CUMULATIVE");
    });

    let point;
    it("should include a single point", () => {
      expect(counterSeries).to.have.property("points").to.be.an("array").to.have.lengthOf(1);
      point = counterSeries.points[0];
    });

    describe("sent point", () => {
      it("should have a int64Value of 0", () => {
        expect(point).to.have.property("value");
        expect(point.value).to.have.property("int64Value").eql(0);
      });

      it("should have an interval from time of creating the metric to now", () => {
        expect(point).to.have.property("interval");
        expect(point.interval).to.have.property("startTime");
        expect(point.interval.startTime.seconds).to.eql(timeOfInit);
        expect(point.interval).to.have.property("endTime");
        expect(point.interval.endTime.seconds).to.eql(Date.now() / 1000);
      });
    });
  });

  describe("when another interval has passed", () => {
    before(() => {
      clock.tick(60 * 1000);
    });

    it("should have pushed a second time", () => {
      expect(metricsRequests).to.have.lengthOf(2);
    });

    describe("sent time series", () => {
      it("should have an interval from when the metric was created to now", () => {
        const interval = metricsRequests[1].timeSeries[0].points[0].interval;
        expect(interval.startTime.seconds).to.eql(timeOfInit);
        expect(interval.endTime.seconds).to.eql(Date.now() / 1000);
      });
    });
  });

  describe("when the counter has been incremented twice and another interval has passed", () => {
    before(() => {
      counter.inc();
      counter.inc();
      clock.tick(60 * 1000);
    });

    it("should have pushed a third time", () => {
      expect(metricsRequests).to.have.lengthOf(3);
    });

    it("should have pushed the metric with 2 as value", () => {
      expect(metricsRequests[2].timeSeries[0].points[0].value.int64Value).to.eql(2);
    });
  });

  describe("when the counter has been incremented once and another interval has passed", () => {
    before(() => {
      counter.inc();
      clock.tick(60 * 1000);
    });

    it("should have pushed a fourth time", () => {
      expect(metricsRequests).to.have.lengthOf(4);
    });

    it("should have pushed the metric with 3 as value", () => {
      expect(metricsRequests[3].timeSeries[0].points[0].value.int64Value).to.eql(3);
    });
  });

  describe("when the counter has been incremented with 3 as value and another interval has passed", () => {
    before(() => {
      counter.inc(3);
      clock.tick(60 * 1000);
    });

    it("should have pushed a fifth time", () => {
      expect(metricsRequests).to.have.lengthOf(5);
    });

    it("should have pushed the metric with 6 as value", () => {
      expect(metricsRequests[4].timeSeries[0].points[0].value.int64Value).to.eql(6);
    });
  });
});

describe("gauge", () => {
  let gauge;
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = PushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    gauge = client.Gauge({ name: "outgoing_requests" });
    clock.tick(60 * 1000);
  });

  after(() => clock.restore);

  let counterSeries;
  it("sends a single timeSeries", async () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
    counterSeries = metricsRequests[0].timeSeries[0];
  });

  describe("sent time series", () => {
    it("should include a metric type as 'custom.googleapis.com/${the_gauge_name}", () => {
      expect(counterSeries).to.have.property("metric");
      expect(counterSeries.metric).to.have.property(
        "type",
        "custom.googleapis.com/outgoing_requests"
      );
    });

    it("should include a metricKind as 'GAUGE'", () => {
      expect(counterSeries).to.have.property("metricKind", "GAUGE");
    });

    it("should include a resource", () => {
      expect(counterSeries).to.have.property("resource");
      const resource = counterSeries.resource;
      expect(resource).to.have.property("type", "global");
      expect(resource).to.have.property("labels");
      const labels = resource.labels;
      expect(labels).to.have.property("project_id", "myproject");
    });

    let point;
    it("should include a single point", () => {
      expect(counterSeries).to.have.property("points").to.be.an("array").to.have.lengthOf(1);
      point = counterSeries.points[0];
    });

    describe("sent point", () => {
      it("should have a int64Value of 0", () => {
        expect(point).to.have.property("value");
        expect(point.value).to.have.property("int64Value").eql(0);
      });

      it("should have an interval without startTime and now as endTime", () => {
        expect(point).to.have.property("interval");
        expect(point.interval).to.not.have.property("startTime");
        expect(point.interval).to.have.property("endTime");
        expect(point.interval.endTime.seconds).to.eql(Date.now() / 1000);
      });
    });
  });

  describe("when the gauge has been incremented once and another interval has passed", () => {
    before(() => {
      gauge.inc();
      clock.tick(60 * 1000);
    });

    it("should have pushed a second time", () => {
      expect(metricsRequests).to.have.lengthOf(2);
    });

    it("should have pushed the metric with 1 as value", () => {
      expect(metricsRequests[1].timeSeries[0].points[0].value.int64Value).to.eql(1);
    });
  });

  describe("when the gauge has been incremented twice more and another interval has passed", () => {
    before(() => {
      gauge.inc();
      gauge.inc();
      clock.tick(60 * 1000);
    });

    it("should have pushed a third time", () => {
      expect(metricsRequests).to.have.lengthOf(3);
    });

    it("should have pushed the metric with 3 as value", () => {
      expect(metricsRequests[2].timeSeries[0].points[0].value.int64Value).to.eql(3);
    });
  });

  describe("when the gauge has been decremented twice and incremented once and another interval has passed", () => {
    before(() => {
      gauge.dec();
      gauge.dec();
      gauge.inc();
      clock.tick(60 * 1000);
    });

    it("should have pushed a fourth time", () => {
      expect(metricsRequests).to.have.lengthOf(4);
    });

    it("should have pushed the metric with 2 as value", () => {
      expect(metricsRequests[3].timeSeries[0].points[0].value.int64Value).to.eql(2);
    });
  });

  describe("when the gauge has been incremented with 4 as value and decremented with 2 as value and another interval has passed", () => {
    before(() => {
      gauge.inc(4);
      gauge.dec(2);
      clock.tick(60 * 1000);
    });

    it("should have pushed a fifth time", () => {
      expect(metricsRequests).to.have.lengthOf(5);
    });

    it("should have pushed the metric with 4 as value", () => {
      expect(metricsRequests[4].timeSeries[0].points[0].value.int64Value).to.eql(4);
    });
  });
});

[
  {
    method: (client) => client.Counter,
    type: "counter",
  },
  {
    method: (client) => client.Gauge,
    type: "gauge",
  },
].forEach((metricType) => {
  describe(`${metricType.type} with labels`, () => {
    let clock, metricsRequests;
    describe(`single ${metricType.type} created without labels object, not incremented`, () => {
      before(() => {
        ({ clock, metricsRequests } = fixture());
        const client = PushClient({
          projectId: "myproject",
          resourceProvider: globalResourceProvider,
        });
        metricType.method(client)({ name: "num_purchases" });
        clock.tick(60 * 1000);
      });

      after(() => clock.restore);

      it("pushes a time series", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
      });
    });

    describe(`single ${metricType.type} created with empty labels object, not incremented`, () => {
      before(() => {
        ({ clock, metricsRequests } = fixture());
        const client = PushClient({
          projectId: "myproject",
          resourceProvider: globalResourceProvider,
        });
        metricType.method(client)({ name: "responses", labels: {} });
        clock.tick(60 * 1000);
      });

      after(() => clock.restore);

      it("does not push", () => {
        expect(metricsRequests).to.have.lengthOf(0);
      });
    });

    describe(`one ${metricType.type} with empty labels object, one ${metricType.type} without labels object, neither incremeneted`, () => {
      before(() => {
        ({ clock, metricsRequests } = fixture());
        const client = PushClient({
          projectId: "myproject",
          resourceProvider: globalResourceProvider,
        });
        metricType.method(client)({ name: "responses", labels: {} });
        metricType.method(client)({ name: "num_purchases" });
        clock.tick(60 * 1000);
      });

      after(() => clock.restore);

      it("pushes a single time series for the ${metricType.type} created without labels object", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
        const series = metricsRequests[0].timeSeries[0];
        expect(series.metric.type).to.include("num_purchases");
      });
    });

    describe(`${metricType.type} created with two labels with two values, not incremented`, () => {
      before(() => {
        ({ clock, metricsRequests } = fixture());
        const client = PushClient({
          projectId: "myproject",
          resourceProvider: globalResourceProvider,
        });
        metricType.method(client)({
          name: "responses",
          labels: {
            code: ["2xx", "3xx"],
            source: ["cdn", "internal"],
          },
        });
        clock.tick(60 * 1000);
      });

      after(() => clock.restore);

      it("pushes four time series", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(4);
        const series = metricsRequests[0].timeSeries;
        expect(
          series.find((s) => s.metric.labels.code === "2xx" && s.metric.labels.source === "cdn")
        ).to.not.be.undefined;
        expect(
          series.find(
            (s) => s.metric.labels.code === "2xx" && s.metric.labels.source === "internal"
          )
        ).to.not.be.undefined;
        expect(
          series.find((s) => s.metric.labels.code === "3xx" && s.metric.labels.source === "cdn")
        ).to.not.be.undefined;
        expect(
          series.find(
            (s) => s.metric.labels.code === "3xx" && s.metric.labels.source === "internal"
          )
        ).to.not.be.undefined;
      });
    });

    describe(`${metricType.type} created with one label with two values, incremented without labels`, () => {
      before(() => {
        ({ clock, metricsRequests } = fixture());
        const client = PushClient({
          projectId: "myproject",
          resourceProvider: globalResourceProvider,
        });
        const metric = metricType.method(client)({
          name: "responses",
          labels: { code: ["2xx", "3xx"] },
        });
        metric.inc();
        clock.tick(60 * 1000);
      });

      after(() => clock.restore);

      it("pushes three time series, one without labels", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(3);
        const series = metricsRequests[0].timeSeries;
        expect(series.find((s) => !s.metric.labels)).to.not.be.undefined;
      });
    });

    describe(`${metricType.type} created without labels, incremented with labels`, () => {
      before(() => {
        ({ clock, metricsRequests } = fixture());
        const client = PushClient({
          projectId: "myproject",
          resourceProvider: globalResourceProvider,
        });
        const metric = metricType.method(client)({
          name: "responses",
        });
        metric.inc({ code: "2xx" });
        clock.tick(60 * 1000);
      });

      after(() => clock.restore);

      it("pushes two time series, one without labels and one with", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(2);
        const series = metricsRequests[0].timeSeries;
        expect(series.find((s) => !s.metric.labels)).to.not.be.undefined;
        expect(series.find((s) => s.metric.labels && s.metric.labels.code === "2xx")).to.not.be
          .undefined;
      });
    });
  });
});
