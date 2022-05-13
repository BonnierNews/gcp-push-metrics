import { expect } from "chai";

import { pushClient } from "../index.js";
import fixture from "./helpers/fixture.js";
import globalResourceProvider from "./helpers/globalResourceProvider.js";

[
  {
    method: (client) => client.counter,
    type: "counter",
  },
  {
    method: (client) => client.gauge,
    type: "gauge",
  },
  {
    method: (client) => client.summary,
    type: "summary",
  },
].forEach((metricType) => {
  describe(metricType.type, () => {
    let client;
    before(() => {
      fixture();
      client = pushClient({ projectId: "myproject", resourceProvider: globalResourceProvider });
    });
    it("should throw when initialized without config", () => {
      expect(metricType.method(client)).to.throw(/config/);
    });

    it("should throw when initialized without name", () => {
      expect(metricType.method(client).bind(null, {})).to.throw(/name.*required/);
    });
  });
});
