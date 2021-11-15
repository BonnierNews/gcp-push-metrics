import labelsKey from "./labelsKey.js";
import labelCombinations from "./labelCombinations.js";

// "Base" functionality used by Counter and Gauge
export default function Metric(name, labels) {
  if (!name) {
    throw new Error("name is required");
  }

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

  const inc = (incLabels, value) => {
    if (incLabels !== Object(incLabels)) {
      value = incLabels;
      incLabels = null;
    }
    if (value === null || value === undefined) {
      value = 1;
    }

    const key = labelsKey(incLabels);
    if (!points[key]) {
      points[key] = {
        labels: incLabels,
        value: 0,
      };
    }
    points[labelsKey(incLabels)].value += value;
  };

  const pointsFn = () => Object.values(points);

  return { name, inc, points, pointsFn };
}
