"use strict";
export default function globalResourceProvider() {
  return {
    type: "global",
    labels: {
      project_id: "myproject",
    },
  };
}
