import http from "http";

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

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "metadata.google.internal",
      port: 80,
      path,
      method: "GET",
      timeout: 200,
      headers: {
        "Metadata-Flavor": "Google",
      },
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
    req.on("error", (err) => {
      reject(err);
    });
    req.end();
  });
}
