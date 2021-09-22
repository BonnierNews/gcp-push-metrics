"use strict";
import monitoring from "@google-cloud/monitoring";
import { expect } from "chai";
import { clientFactory } from "../index.js";
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
    clientFactory({ projectId: "myproject" });
    clock.tick(61 * 1000);
    expect(metricsRequests).to.have.lengthOf(0);
  });
});

describe("with a metric after the interval", () => {
  before(async () => {
    fixture();
    const client = clientFactory({ projectId: "myproject" });
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
    const client = clientFactory({ projectId: "myproject" });
    counter = client.counter("num_requests");
    clock.tick(60 * 1000);
  });

  let counterSeries;
  it("sends a single timeSeries", async () => {
    expect(metricsRequests).to.have.lengthOf(1);
    expect(metricsRequests[0].timeSeries).to.have.lengthOf(1);
    counterSeries = metricsRequests[0].timeSeries[0];
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
