import { expect } from "chai";
import nock from "nock";

import { cloudRunResourceProvider } from "../index.js";

describe("cloud run resource provider when the metadata server is slow", () => {
  const delayMs = 3500;
  const attempts = 4;
  let err, elapsed;

  before(async function () {
    this.timeout(10000);
    process.env.K_SERVICE = "hello-world";
    const scope = nock("http://metadata.google.internal", { reqheaders: { "Metadata-Flavor": "Google" } });
    scope
      .get("/computeMetadata/v1/instance/region")
      .reply(200, "projects/385402317761/regions/europe-west1");
    scope.get("/computeMetadata/v1/instance/id").reply(200, "some-instance-id");
    scope
      .get("/computeMetadata/v1/project/project-id")
      .times(attempts)
      .delayConnection(delayMs)
      .reply(200, "my_project");

    const start = Date.now();
    try {
      await cloudRunResourceProvider();
    } catch (e) {
      err = e;
    }
    elapsed = Date.now() - start;
  });

  after(() => {
    delete process.env.K_SERVICE;
    nock.cleanAll();
  });

  it("rejects rather than resolving with a partial resource", () => {
    expect(err, "expected the provider to reject").to.be.an("error");
  });

  it("gives up instead of waiting out the slow requests", () => {
    expect(elapsed).to.be.below(attempts * delayMs);
  });
});
