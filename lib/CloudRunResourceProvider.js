import http from "http";

export default async function CloudRunResourceProvider() {
  const project_id = await request("/computeMetadata/v1/project/project-id");
  const locationResponse = await request("/computeMetadata/v1/instance/region");
  const instance_id = await request("/computeMetadata/v1/instance/id");
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
