"use strict";
import monitoring from "@google-cloud/monitoring";
import { expect } from "chai";
import { PushClient } from "../index.js";
import sinon from "sinon";
const sandbox = sinon.createSandbox();
const metricsRequests = [];
let clock;

function fixture() {
  metricsRequests.length = 0;
  sandbox.restore();
  clock = sinon.useFakeTimers();
  const stub = sandbox.stub(monitoring.MetricServiceClient.prototype);
  stub.projectPath = (path) => {
    return `projectpath:${path}`;
  };
  stub.createTimeSeries = async (request) => {
    metricsRequests.push(request);
    return "something";
  };
}

after(() => clock.restore);

describe("initialized and no metrics", () => {
  before(fixture);
  it("does not push after the interval", async () => {
    PushClient({ projectId: "myproject" });
    clock.tick(61 * 1000);
    expect(metricsRequests).to.have.lengthOf(0);
  });
});

describe("with a metric after the interval", () => {
  before(async () => {
    fixture();
    const client = PushClient({ projectId: "myproject" });
    client.counter("num_requests");
    clock.tick(60 * 1000);
  });

  it("pushes once to StackDriver", async () => {
    expect(metricsRequests).to.have.lengthOf(1);
  });

  it("sends name as the project path", async () => {
    expect(metricsRequests[0]).to.have.property("name", "projectpath:myproject");
  });

  it("sends timeSeries", async () => {
    expect(metricsRequests[0]).to.have.property("timeSeries").to.be.an("array");
  });
});

describe("with a single counter", () => {
  let timeOfInit;
  let counter;
  before(() => {
    fixture();
    timeOfInit = Date.now();
    const client = PushClient({ projectId: "myproject" });
    counter = client.counter("num_requests");
    clock.tick(60 * 1000);
  });

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

    it("should include a resource", () => {
      expect(counterSeries).to.have.property("resource");
      const resource = counterSeries.resource;
      expect(resource).to.have.property("labels");
      const labels = resource.labels;
      expect(labels).to.have.property("project_id", "myproject");
      expect(labels).to.have.property("node_id").to.be.a("string");
      expect(labels.node_id.length).to.be.gt(8);
      expect(labels).to.have.property("location", "global");
      expect(labels).to.have.property("namespace", "na");
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

      it("should have an interval from time of creating the client to now", () => {
        expect(point).to.have.property("interval");
        expect(point.interval).to.have.property("startTime");
        expect(Date.parse(point.interval.startTime)).to.eql(timeOfInit);
        expect(point.interval).to.have.property("endTime");
        expect(Date.parse(point.interval.endTime)).to.eql(Date.now());
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
      it("should have an interval from time of the previous sending to now", () => {
        const interval = metricsRequests[1].timeSeries[0].points[0].interval;
        expect(Date.parse(interval.startTime)).to.eql(timeOfInit + 60 * 1000);
        expect(Date.parse(interval.endTime)).to.eql(Date.now());
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

    it("should have pushed the metric with 1 as value", () => {
      expect(metricsRequests[3].timeSeries[0].points[0].value.int64Value).to.eql(1);
    });
  });
});

describe("gauge", () => {
  let timeOfInit;
  let gauge;
  before(() => {
    fixture();
    timeOfInit = Date.now();
    const client = PushClient({ projectId: "myproject" });
    gauge = client.gauge("outgoing_requests");
    clock.tick(60 * 1000);
  });

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

    it("should include a resource", () => {
      expect(counterSeries).to.have.property("resource");
      const resource = counterSeries.resource;
      expect(resource).to.have.property("labels");
      const labels = resource.labels;
      expect(labels).to.have.property("project_id", "myproject");
      expect(labels).to.have.property("node_id").to.be.a("string");
      expect(labels.node_id.length).to.be.gt(8);
      expect(labels).to.have.property("location", "global");
      expect(labels).to.have.property("namespace", "na");
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

      it("should have an interval from time of creating the client to now", () => {
        expect(point).to.have.property("interval");
        expect(point.interval).to.have.property("startTime");
        expect(Date.parse(point.interval.startTime)).to.eql(timeOfInit);
        expect(point.interval).to.have.property("endTime");
        expect(Date.parse(point.interval.endTime)).to.eql(Date.now());
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
});

describe("labels", () => {
  [
    {
      method: (client) => client.counter,
      type: "counter",
    },
    {
      method: (client) => client.gauge,
      type: "gauge",
    },
  ].forEach((metricType) => {
    describe(`single ${metricType.type} created without labels object, not incremented`, () => {
      before(() => {
        fixture();
        const client = PushClient({ projectId: "myproject" });
        metricType.method(client)("num_purchases");
        clock.tick(60 * 1000);
      });

      it("pushes a time series", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
      });
    });

    describe(`single ${metricType.type} created with empty labels object, not incremented`, () => {
      before(() => {
        fixture();
        const client = PushClient({ projectId: "myproject" });
        metricType.method(client)("responses", {});
        clock.tick(60 * 1000);
      });

      it("does not push", () => {
        expect(metricsRequests).to.have.lengthOf(0);
      });
    });

    describe(`one ${metricType.type} with empty labels object, one ${metricType.type} without labels object, neither incremeneted`, () => {
      before(() => {
        fixture();
        const client = PushClient({ projectId: "myproject" });
        metricType.method(client)("responses", {});
        metricType.method(client)("num_purchases");
        clock.tick(60 * 1000);
      });

      it("pushes a single time series for the ${metricType.type} created labels object", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
        const series = metricsRequests[0].timeSeries[0];
        expect(series.metric.type).to.include("num_purchases");
      });
    });

    describe(`${metricType.type} created with two labels with two values, not incremented`, () => {
      before(() => {
        fixture();
        const client = PushClient({ projectId: "myproject" });
        metricType.method(client)("responses", {
          code: ["2xx", "3xx"],
          source: ["cdn", "internal"],
        });
        clock.tick(60 * 1000);
      });

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
        fixture();
        const client = PushClient({ projectId: "myproject" });
        const metric = metricType.method(client)("responses", { code: ["2xx", "3xx"] });
        metric.inc();
        clock.tick(60 * 1000);
      });

      it("pushes three time series, one without labels", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        expect(metricsRequests[0].timeSeries).to.have.lengthOf(3);
        const series = metricsRequests[0].timeSeries;
        expect(series.find((s) => !s.metric.labels)).to.not.be.undefined;
      });
    });
  });
});

// TODO:
// * Felhantering, om det inte går att skicka, om det går att skicka och inkrementering sker under tiden
// * Loggning
// * SIGTERM
// * projectID från env-variabel
// * Konfigurerbart intervall?
// * Titta på att inte behöva skapa metricdescriptors
// * Egen/bättre funktion iställer för uuidv4
