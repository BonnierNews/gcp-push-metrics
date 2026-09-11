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
    // Well beyond the 3 s timeout the provider asks for. Note that nock emits
    // "timeout" as soon as it sees a delay larger than the timeout, so this
    // covers that the event is acted on, not the exact timing of it.
    // Every attempt, including the retries, times out
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
    // Aborting each attempt costs far less than letting all of them run to completion
    expect(elapsed).to.be.below(attempts * delayMs);
  });
});
