import * as ss from "simple-statistics";
import type { StatsSummary } from "../types";

const LANCZOS_COEFFICIENTS = [
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7,
];

function logGamma(value: number): number {
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  let x = 0.9999999999998099;
  const z = value - 1;

  for (let i = 0; i < LANCZOS_COEFFICIENTS.length; i += 1) {
    x += LANCZOS_COEFFICIENTS[i] / (z + i + 1);
  }

  const t = z + LANCZOS_COEFFICIENTS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedIncompleteBetaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 200;
  const epsilon = 3e-12;
  const tiny = 1e-30;

  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;

  if (Math.abs(d) < tiny) {
    d = tiny;
  }

  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let numerator = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }
    d = 1 / d;
    h *= d * c;

    numerator = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < epsilon) {
      break;
    }
  }

  return h;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0;
  }

  if (x >= 1) {
    return 1;
  }

  const logBeta =
    logGamma(a + b) -
    logGamma(a) -
    logGamma(b) +
    a * Math.log(x) +
    b * Math.log(1 - x);
  const front = Math.exp(logBeta);

  if (x < (a + 1) / (a + b + 2)) {
    return (front * regularizedIncompleteBetaContinuedFraction(a, b, x)) / a;
  }

  return 1 - (front * regularizedIncompleteBetaContinuedFraction(b, a, 1 - x)) / b;
}

export function twoTailedPValueFromTStatistic(tStatistic: number, degreesOfFreedom: number): number | null {
  if (!Number.isFinite(tStatistic) || degreesOfFreedom <= 0) {
    return null;
  }

  if (tStatistic === 0) {
    return 1;
  }

  const x = degreesOfFreedom / (degreesOfFreedom + tStatistic * tStatistic);
  const pValue = regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5);
  return Math.min(1, Math.max(0, pValue));
}

export function calculateRegressionSummary(dataPoints: Array<[number, number]>): StatsSummary {
  const regression = ss.linearRegression(dataPoints);
  const n = dataPoints.length;
  let rSquared = 0;
  let pValue: number | null = null;
  let pValueMethod: StatsSummary["pValueMethod"] = "unavailable";

  try {
    const xValues = dataPoints.map(([x]) => x);
    const yValues = dataPoints.map(([, y]) => y);
    const correlation = ss.sampleCorrelation(xValues, yValues);

    if (Number.isFinite(correlation)) {
      rSquared = correlation * correlation;

      if (n > 2) {
        if (Math.abs(correlation) === 1) {
          pValue = 0;
          pValueMethod = "student-t";
        } else {
          const tStatistic =
            Math.abs(correlation) * Math.sqrt((n - 2) / Math.max(1e-12, 1 - correlation * correlation));
          pValue = twoTailedPValueFromTStatistic(tStatistic, n - 2);
          pValueMethod = pValue == null ? "unavailable" : "student-t";
        }
      }
    }
  } catch {
    rSquared = 0;
    pValue = null;
    pValueMethod = "unavailable";
  }

  return {
    coefficients: {
      intercept: regression.b,
      pm25: regression.m,
    },
    rSquared: Number.isFinite(rSquared) ? rSquared : 0,
    pValue,
    pValueMethod,
    n,
  };
}
