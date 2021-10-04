"use strict";

import labelsKey from "./labelsKey.js";
import labelCombinations from "./labelCombinations.js";

// "Base" functionality used by Counter and Gauge
export default function Metric(name, labels) {
  let points = {};

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

  const inc = (labels) => {
    const key = labelsKey(labels);
    if (!points[key]) {
      points[key] = {
        labels,
        value: 0,
      };
    }
    points[labelsKey(labels)].value++;
  };

  const pointsFn = () => {
    return Object.values(points);
  };

  return { name, inc, points, pointsFn };
}
