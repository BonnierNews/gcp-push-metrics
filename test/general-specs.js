"use strict";
import { expect } from "chai";
import PushClient from "../index.js";
import fixture from "./helpers/fixture.js";

describe("initialized and no metrics", () => {
  let clock, metricsRequests;
  before(() => ({ clock, metricsRequests } = fixture()));
  after(() => clock.restore);
  it("does not push after the interval", async () => {
    PushClient({ projectId: "myproject" });
    clock.tick(61 * 1000);
    expect(metricsRequests).to.have.lengthOf(0);
  });
});

describe("with a metric", () => {
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = PushClient({ projectId: "myproject" });
    client.Counter({ name: "num_requests" });
  });

  after(() => clock.restore);

  describe("after the interval", () => {
    before(() => clock.tick(60 * 1000));
    it("pushes once to StackDriver", async () => {
      expect(metricsRequests).to.have.lengthOf(1);
    });

    it("sends name as the project path", async () => {
      expect(metricsRequests[0]).to.have.property("name", "projectpath:myproject");
    });

    it("sends timeSeries", async () => {
      expect(metricsRequests[0]).to.have.property("timeSeries").to.be.an("array");
    });

    it("should include a resource", () => {
      const counterSeries = metricsRequests[0].timeSeries[0];
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
  });

  describe("when SIGTERM is sent", () => {
    before(() => process.emit("SIGTERM"));

    it("pushes again to StackDriver", async () => {
      expect(metricsRequests).to.have.lengthOf(2);
    });

    it("should append '-exit' to the node_id of the resource", () => {
      const counterSeries = metricsRequests[1].timeSeries[0];
      const resource = counterSeries.resource;
      const labels = resource.labels;
      expect(labels.node_id).to.have.string("-exit");
    });
  });
});

describe("with projectId not set in options but exists in from env.PROJECT_ID", () => {
  let clock, metricsRequests;

  before(async () => {
    ({ clock, metricsRequests } = fixture());
    process.env.PROJECT_ID = "projectFromEnv";
    const client = PushClient();
    client.Counter({ name: "num_requests" });
    clock.tick(60 * 1000);
  });

  after(() => {
    delete process.env.PROJECT_ID;
    clock.restore();
  });

  it("uses project ID from env", async () => {
    expect(metricsRequests[0]).to.have.property("name", "projectpath:projectFromEnv");
    expect(metricsRequests[0].timeSeries[0].resource.labels).to.have.property(
      "project_id",
      "projectFromEnv"
    );
  });
});

describe("without projectId", () => {
  it("throws an error", async () => {
    expect(PushClient).to.throw(/project ID/);
  });
});

describe("with a intervalSeconds set to 120", () => {
  let clock, metricsRequests;

  before(async () => {
    ({ clock, metricsRequests } = fixture());
    const client = PushClient({ projectId: "myproject", intervalSeconds: 120 });
    client.Counter({ name: "num_requests" });
  });

  after(() => clock.restore);

  describe("after 60 seconds", () => {
    before(() => clock.tick(60 * 1000));
    it("should not have pushed", () => {
      expect(metricsRequests).to.have.lengthOf(0);
    });
  });

  describe("after 60 more seconds", () => {
    before(() => clock.tick(60 * 1000));
    it("should have pushed", () => {
      expect(metricsRequests).to.have.lengthOf(1);
    });
  });
});

describe("with a intervalSeconds set to 0", () => {
  before(async () => {
    fixture();
  });

  it("throws an error", async () => {
    const fn = PushClient.bind(null, { projectId: "myProject", intervalSeconds: 0 });
    expect(fn).to.throw(/intervalSeconds/);
  });
});

describe("with a logger", () => {
  const errors = [];
  let clock;

  before(() => {
    const createTimeSeriesStub = async function () {
      throw new Error("from client");
    };
    ({ clock } = fixture(createTimeSeriesStub));
    const logger = {
      debug() {},
      error(msg) {
        errors.push(msg);
      },
    };
    const client = PushClient({ projectId: "myproject", logger: logger });
    client.Counter({ name: "num_requests" });
  });

  after(() => clock.restore);

  describe("log error when pushing fails", () => {
    before(() => clock.tick(60 * 1000));
    it("should log error", () => {
      expect(errors).to.have.lengthOf(1);
    });
  });
});

describe("with invalid logger", () => {
  it("throws an error", async () => {
    const fn = PushClient.bind(null, { projectId: "myProject", logger: {} });
    expect(fn).to.throw(/logger/);
  });
});
