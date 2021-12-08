import { expect } from "chai";
import { pushClient } from "../index.js";
import fixture from "./helpers/fixture.js";
import globalResourceProvider from "./helpers/globalResourceProvider.js";

describe("initialized and no metrics", () => {
  let clock, metricsRequests;
  before(() => ({ clock, metricsRequests } = fixture()));
  after(() => clock.restore);
  it("does not push after the interval", () => {
    pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    clock.tick(61 * 1000);
    expect(metricsRequests).to.have.lengthOf(0);
  });
});

describe("with a metric", () => {
  let clock, metricsRequests, onPush;

  before(() => {
    ({ clock, metricsRequests, onPush } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    client.counter({ name: "num_requests" });
  });

  after(() => {
    clock.restore();
    process.removeAllListeners("SIGTERM");
  });

  describe("after the interval", () => {
    before(() => clock.tick(60 * 1000));
    it("pushes once to StackDriver", () => {
      expect(metricsRequests).to.have.lengthOf(1);
    });

    it("sends name as the project path", () => {
      expect(metricsRequests[0]).to.have.property("name", "projectpath:myproject");
    });

    it("sends timeSeries", () => {
      expect(metricsRequests[0]).to.have.property("timeSeries").to.be.an("array");
    });

    it("should include a resource", () => {
      const counterSeries = metricsRequests[0].timeSeries[0];
      expect(counterSeries).to.have.property("resource");
      const resource = counterSeries.resource;
      expect(resource).to.have.property("type", "global");
      expect(resource).to.have.property("labels");
      const labels = resource.labels;
      expect(labels).to.have.property("project_id", "myproject");
    });
  });

  describe("when SIGTERM is sent", () => {
    before(() => {
      const push = onPush();
      process.emit("SIGTERM");
      return push;
    });

    it("pushes again to StackDriver", () => {
      expect(metricsRequests).to.have.lengthOf(2);
    });
  });
});

describe("without resourceProvider", () => {
  it("throws an error", () => {
    expect(pushClient).to.throw(/resourceProvider/);
  });
});

describe("with a intervalSeconds set to 120", () => {
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({
      projectId: "myproject",
      intervalSeconds: 120,
      resourceProvider: globalResourceProvider,
    });
    client.counter({ name: "num_requests" });
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
  before(() => {
    fixture();
  });

  it("throws an error", () => {
    const fn = pushClient.bind(null, {
      projectId: "myProject",
      intervalSeconds: 0,
      resourceProvider: globalResourceProvider,
    });
    expect(fn).to.throw(/intervalSeconds/);
  });
});

describe("with a logger", () => {
  const errors = [];
  let clock;

  before(() => {
    const createTimeSeriesStub = function () {
      throw new Error("from client");
    };
    ({ clock } = fixture(createTimeSeriesStub));
    const logger = {
      debug() {},
      error(msg) {
        errors.push(msg);
      },
    };
    const client = pushClient({
      projectId: "myproject",
      logger,
      resourceProvider: globalResourceProvider,
    });
    client.counter({ name: "num_requests" });
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
  it("throws an error", () => {
    const fn = pushClient.bind(null, {
      projectId: "myProject",
      logger: {},
      resourceProvider: globalResourceProvider,
    });
    expect(fn).to.throw(/logger/);
  });
});

describe("with 201 metrics", () => {
  let clock, metricsRequests;

  before(() => {
    ({ clock, metricsRequests } = fixture());
    const client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    for (let i = 1; i < 202; i++) {
      client.counter({ name: `counter${i}` });
    }
  });

  after(() => {
    clock.restore();
    process.removeAllListeners("SIGTERM");
  });

  describe("after the interval", () => {
    before(() => clock.tick(60 * 1000));
    it("pushes twice to StackDriver", () => {
      expect(metricsRequests).to.have.lengthOf(2);
    });
  });
});
