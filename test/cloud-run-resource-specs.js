"use strict";
import { expect } from "chai";
import { PushClient, CloudRun } from "../index.js";
import fixture from "./helpers/fixture.js";
import nock from "nock";

describe.only("initialized with Cloud Run", () => {
  let clock, metricsRequests, client;
  before(() => {
    ({ clock, metricsRequests } = fixture());
    process.env.K_REVISION = "hello-world.1";
    process.env.K_SERVICE = "hello-world";
    process.env.K_CONFIGURATION = "hello-world";
    process.env.PROJECT_ID = "my_project";
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

    client = PushClient({ resourceProvider: CloudRun });
    client.Counter({ name: "num_requests" });
  });
  after(() => {
    clock.restore();
    delete process.env.K_REVISION;
    delete process.env.K_SERVICE;
    delete process.env.K_CONFIGURATION;
  });

  describe("after the interval", () => {
    before(() => clock.tick(60 * 1000));
    let counterSeries;
    it("should include a resource", () => {
      expect(metricsRequests).to.have.lengthOf(1);
      counterSeries = metricsRequests[0].timeSeries[0];
      expect(counterSeries).to.have.property("resource");
      const resource = counterSeries.resource;
      expect(resource).to.have.property("type", "cloud_run_revision");
      expect(resource).to.have.property("labels");
      const labels = resource.labels;
      expect(labels).to.have.property("project_id", "my_project");
      expect(labels).to.have.property("service_name", "hello-world");
      expect(labels).to.have.property("revision_name", "hello-world.1");
      expect(labels).to.have.property("location", "europe-west1");
      expect(labels).to.have.property("configuration_name", "hello-world");
    });

    it("should push a time series labeled with instance ID", () => {
      expect(counterSeries.timeSeries[0].labels).to.have.property(
        "instance_id",
        "00bf4bf02df8cfe82a1072fc7c3ab93b9fa2a09b029a7533f92ccb2b2c9bdca19a0b50373165a3d8559d0bcb14991feeca400d26e6d21b47571949ef8706"
      );
    });
  });
});
