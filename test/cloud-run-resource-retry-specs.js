import { expect } from "chai";
import nock from "nock";

import { cloudRunResourceProvider } from "../index.js";

const maxRetries = 3;
// The exponential backoff the provider mirrors from gcp-metadata/gaxios,
// i.e. 100 ms before the first retry, then 500 and 1500 ms
const backoffDelay = (retryAttempt) => (retryAttempt === 0 ? 100 : 0) + ((2 ** retryAttempt - 1) / 2) * 1000;
// How long a run that makes the given number of attempts spends sleeping
const backoffBefore = (attempts) =>
  Array.from({ length: attempts - 1 }, (_, retryAttempt) => backoffDelay(retryAttempt)).reduce((sum, ms) => sum + ms, 0);
const connectionRefused = () => Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
const projectIdPath = "/computeMetadata/v1/project/project-id";

function metadataScope() {
  const scope = nock("http://metadata.google.internal", { reqheaders: { "Metadata-Flavor": "Google" } });
  scope
    .get("/computeMetadata/v1/instance/region")
    .reply(200, "projects/385402317761/regions/europe-west1");
  scope.get("/computeMetadata/v1/instance/id").reply(200, "some-instance-id");
  return scope;
}

describe("cloud run resource provider when a metadata request fails intermittently", () => {
  let resources, resolveErr, attempts, elapsed;

  before(async function () {
    this.timeout(10000);
    process.env.K_SERVICE = "hello-world";
    attempts = 0;
    const scope = metadataScope();
    scope.on("request", (req) => {
      if (req.path === projectIdPath) attempts++;
    });
    scope.get(projectIdPath).times(2).replyWithError(connectionRefused());
    scope.get(projectIdPath).reply(200, "my_project");

    const start = Date.now();
    try {
      resources = await cloudRunResourceProvider();
    } catch (e) {
      resolveErr = e;
    }
    elapsed = Date.now() - start;
  });

  after(() => {
    delete process.env.K_SERVICE;
    nock.cleanAll();
  });

  it("retries and resolves with the resource", () => {
    expect(resolveErr, "expected the provider to recover, but it rejected").to.equal(undefined);
    expect(resources.default.labels).to.have.property("project_id", "my_project");
  });

  it("only makes as many requests as it needed", () => {
    expect(attempts).to.equal(3);
  });

  it("backs off exponentially between the attempts it made", () => {
    expect(elapsed).to.be.at.least(backoffBefore(3) * 0.9);
  });
});

describe("cloud run resource provider when a metadata request keeps failing", () => {
  let err, attempts, elapsed;

  before(async function () {
    this.timeout(10000);
    process.env.K_SERVICE = "hello-world";
    attempts = 0;
    const scope = metadataScope();
    scope.on("request", (req) => {
      if (req.path === projectIdPath) attempts++;
    });
    // One for the initial attempt plus one per retry...
    scope.get(projectIdPath).times(maxRetries + 1).replyWithError(connectionRefused());
    // ...and one that would succeed, so retrying too many times is a failure too
    scope.get(projectIdPath).reply(200, "my_project");

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

  it("gives up and rejects", () => {
    expect(err, "expected the provider to reject").to.be.an("error");
  });

  it(`retries ${maxRetries} times before giving up`, () => {
    expect(attempts).to.equal(maxRetries + 1);
  });

  it("backs off before every retry, but does not sleep after the last attempt", () => {
    expect(elapsed).to.be.at.least(backoffBefore(maxRetries + 1) * 0.9);
    expect(elapsed).to.be.below(backoffBefore(maxRetries + 2));
  });
});
