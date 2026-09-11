import http from "http";
import { setTimeout as sleep } from "timers/promises";

export default async function cloudRunResourceProvider() {
  /* eslint-disable camelcase*/
  const [ project_id, locationResponse, instance_id ] = await Promise.all([
    request("/computeMetadata/v1/project/project-id"),
    request("/computeMetadata/v1/instance/region"),
    request("/computeMetadata/v1/instance/id"),
  ]);
  const splitLocation = locationResponse.split("/");
  const location = splitLocation[splitLocation.length - 1];
  return {
    default: {
      type: "generic_node",
      labels: {
        project_id,
        namespace: process.env.K_SERVICE,
        node_id: instance_id,
        location,
      },
    },
    exit: {
      type: "generic_node",
      labels: {
        project_id,
        namespace: process.env.K_SERVICE,
        node_id: `${instance_id}-exit`,
        location,
      },
    },
  };
  /* eslint-enable camelcase*/
}

// http params
const maxRetries = 3;
const retryDelayMs = 300;
const requestTimeoutMs = 3000;

// 300 + 600 + 1200 ms, the same ~2.1 s budget gcp-metadata spends on retries
function backoffDelay(retryAttempt) {
  return retryDelayMs * 2 ** retryAttempt;
}

async function request(path) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(backoffDelay(attempt - 1));
    }
    try {
      return await attemptRequest(path);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function attemptRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "metadata.google.internal",
      port: 80,
      path,
      method: "GET",
      timeout: requestTimeoutMs,
      headers: { "Metadata-Flavor": "Google" },
    };
    const req = http.request(options, (resp) => {
      let data = "";
      resp.on("data", (chunk) => {
        data += chunk;
      });

      resp.on("end", () => {
        resolve(data);
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`timeout when requesting ${path} from the metadata server`));
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.end();
  });
}
