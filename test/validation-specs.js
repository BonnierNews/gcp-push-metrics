import { expect } from "chai";
import { PushClient } from "../index.js";
import fixture from "./helpers/fixture.js";
import globalResourceProvider from "./helpers/globalResourceProvider.js";

[
  {
    method: (client) => client.Counter,
    type: "counter",
  },
  {
    method: (client) => client.Gauge,
    type: "gauge",
  },
  {
    method: (client) => client.Summary,
    type: "summary",
  },
].forEach((metricType) => {
  describe(metricType.type, () => {
    let client;
    before(() => {
      fixture();
      client = PushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    });
    it("should throw when initialized without config", () => {
      expect(metricType.method(client)).to.throw(/config/);
    });

    it("should throw when initialized without name", () => {
      expect(metricType.method(client).bind(null, {})).to.throw(/name.*required/);
    });
  });
});
