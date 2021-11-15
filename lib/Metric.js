import labelsKey from "./labelsKey.js";
import labelCombinations from "./labelCombinations.js";

// "Base" functionality used by Counter and Gauge
export default function Metric(name, labels) {
  const points = {};

  if (labels) {
    //Add a point for each unique combination of labels
    const combinations = labelCombinations(labels);
    combinations.forEach((combo) => {
      const key = labelsKey(combo);
      points[key] = {
        labels: combo,
        value: 0,
      };
    });
  } else {
    points[labelsKey()] = {
      labels: null,
      value: 0,
    };
  }

  const inc = (incLabels) => {
    const key = labelsKey(incLabels);
    if (!points[key]) {
      points[key] = {
        incLabels,
        value: 0,
      };
    }
    points[labelsKey(incLabels)].value++;
  };

  const pointsFn = () => Object.values(points);

  return { name, inc, points, pointsFn };
}
