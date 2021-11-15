export default function globalResourceProvider() {
  return {
    exit: {
      type: "global",
      labels: {
        project_id: "myproject",
      },
    },
    default: {
      type: "global",
      labels: {
        project_id: "myproject",
      },
    },
  };
}
