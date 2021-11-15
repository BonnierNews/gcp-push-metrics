import { expect } from "chai";
import { PushClient, CloudRunResourceProvider } from "../index.js";
import fixture from "./helpers/fixture.js";
import nock from "nock";

[
  {
    method: (client) => client.Counter,
    type: "counter",
    observe: () => {},
  },
  {
    method: (client) => client.Gauge,
    type: "gauge",
    observe: () => {},
  },
  {
    method: (client) => client.Summary,
    type: "summary",
    observe: (metric) => {
      metric.observe(1);
    },
  },
].forEach((metricType) => {
  describe(`initialized with Cloud Run, ${metricType.type} `, () => {
    let clock, metricsRequests, onPush, client, metric;
    before(() => {
      ({ clock, metricsRequests, onPush } = fixture());
      process.env.K_REVISION = "hello-world.1";
      process.env.K_SERVICE = "hello-world";
      process.env.K_CONFIGURATION = "hello-world";
      const scope = nock("http://metadata.google.internal", {
        reqheaders: { "Metadata-Flavor": "Google" },
      });
      scope
        .get("/computeMetadata/v1/instance/region")
        .reply(200, "projects/385402317761/regions/europe-west1");
      scope
        .get("/computeMetadata/v1/instance/id")
        .reply(
          200,
          "00bf4bf02df8cfe82a1072fc7c3ab93b9fa2a09b029a7533f92ccb2b2c9bdca19a0b50373165a3d8559d0bcb14991feeca400d26e6d21b47571949ef8706"
        );
      scope.get("/computeMetadata/v1/project/project-id").reply(200, "my_project");

      client = PushClient({
        resourceProvider: CloudRunResourceProvider,
      });
      metric = metricType.method(client)({ name: "num_requests" });
      metricType.observe(metric);
    });
    after(() => {
      clock.restore();
      delete process.env.K_REVISION;
      delete process.env.K_SERVICE;
      delete process.env.K_CONFIGURATION;
      process.removeAllListeners("SIGTERM");
    });

    describe("after the interval", () => {
      before(() => {
        clock.tick(60 * 1000);
        return onPush();
      });
      let counterSeries;
      it("should include a resource", () => {
        expect(metricsRequests).to.have.lengthOf(1);
        counterSeries = metricsRequests[0].timeSeries[0];
        expect(counterSeries).to.have.property("resource");
        const resource = counterSeries.resource;
        expect(resource).to.have.property("type", "generic_node");
        const labels = resource.labels;
        expect(labels).to.have.property("project_id", "my_project");
        expect(labels).to.have.property("namespace", "hello-world");
        expect(labels).to.have.property(
          "node_id",
          "00bf4bf02df8cfe82a1072fc7c3ab93b9fa2a09b029a7533f92ccb2b2c9bdca19a0b50373165a3d8559d0bcb14991feeca400d26e6d21b47571949ef8706"
        );
        expect(labels).to.have.property("location", "europe-west1");
      });
    });

    describe("when SIGTERM is sent", () => {
      before(() => {
        const push = onPush();
        metricType.observe(metric);
        process.emit("SIGTERM");
        return push;
      });

      it("pushes again", async () => {
        expect(metricsRequests).to.have.lengthOf(2);
      });

      it("should append '-exit' to the node_id label", () => {
        const counterSeries = metricsRequests[1].timeSeries[0];
        expect(counterSeries.resource.labels).to.have.property(
          "node_id",
          "00bf4bf02df8cfe82a1072fc7c3ab93b9fa2a09b029a7533f92ccb2b2c9bdca19a0b50373165a3d8559d0bcb14991feeca400d26e6d21b47571949ef8706-exit"
        );
      });
    });
  });
});
