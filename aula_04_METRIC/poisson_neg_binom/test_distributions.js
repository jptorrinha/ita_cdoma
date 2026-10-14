"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const lab = require("./distributions.js");

function close(actual, expected, tolerance = 1e-12, message = "") {
  const error = Math.abs(actual - expected);
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    error <= tolerance * scale,
    message || `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function exactNb2Pmf(k) {
  // mean=2, VMR=2 gives nu=2 and p=1/2.
  return (k + 1) / 2 ** (k + 2);
}

function exactNb2Sf(k) {
  return (k + 3) / 2 ** (k + 2);
}

test("exports one API through CommonJS and the browser global", () => {
  assert.equal(globalThis.DistributionLab, lab);
  assert.equal(typeof lab.buildDistribution, "function");
  assert.equal(typeof lab.simulate, "function");

  const source = fs.readFileSync(path.join(__dirname, "distributions.js"), "utf8");
  const browser = {};
  vm.runInNewContext(source, browser, { filename: "distributions.js" });
  assert.equal(typeof browser.DistributionLab, "object");
  close(browser.DistributionLab.pmf(2, 2, 2), 3 / 16);
});

test("uses the stipulated parameters and an exact VMR=1 branch", () => {
  const poisson = lab.distributionParameters(8, 1);
  assert.equal(poisson.kind, "poisson");
  assert.equal(poisson.variance, 8);
  assert.equal(poisson.nu, Infinity);
  assert.equal(poisson.p, 1);

  const nb = lab.distributionParameters(8, 2.5);
  assert.equal(nb.kind, "negative-binomial");
  close(nb.nu, 8 / 1.5);
  close(nb.p, 0.4);
  close(nb.variance, 20);

  const nextFloat = 1 + Number.EPSILON;
  const nearPoisson = lab.distributionParameters(8, nextFloat);
  assert.equal(nearPoisson.kind, "negative-binomial");
  assert.ok(Number.isFinite(nearPoisson.nu));

  for (let k = 0; k <= 20; k += 1) {
    assert.equal(lab.pmf(k, 8, 1), lab.poissonPmf(k, 8));
  }
});

test("rejects invalid distribution, stock and target parameters", () => {
  assert.throws(() => lab.pmf(0, -1, 1), /mean/);
  assert.throws(() => lab.cdf(0, 1, 0.99), /vmr/);
  assert.throws(() => lab.cdf(Number.NaN, 1, 1), /k/);
  assert.throws(() => lab.fillRate(0, -1, 1), /mean/);
  assert.throws(() => lab.fillRate(1.5, 2, 1), /stock/);
  assert.throws(() => lab.requiredStockForTargetFR(1.01, 2, 1), /target/);
  assert.throws(
    () => lab.buildDistribution(2, 1, { tailTolerance: 0 }),
    /tailTolerance/,
  );
});

test("recursive Poisson PMF matches closed-form reference values", () => {
  const mean = 2;
  const expected = [
    Math.exp(-2),
    2 * Math.exp(-2),
    2 * Math.exp(-2),
    (4 / 3) * Math.exp(-2),
    (2 / 3) * Math.exp(-2),
  ];
  expected.forEach((oracle, k) => close(lab.pmf(k, mean, 1), oracle, 2e-14));

  for (let k = 0; k < 30; k += 1) {
    close(
      lab.pmf(k + 1, mean, 1) / lab.pmf(k, mean, 1),
      mean / (k + 1),
      2e-14,
    );
  }
  assert.equal(lab.pmf(-1, mean, 1), 0);
  assert.equal(lab.pmf(1.2, mean, 1), 0);
});

test("recursive NB PMF matches an exact rational oracle", () => {
  let total = 0;
  for (let k = 0; k <= 40; k += 1) {
    const probability = lab.pmf(k, 2, 2);
    close(probability, exactNb2Pmf(k), 2e-14);
    total += probability;
    if (k < 40) {
      close(
        lab.pmf(k + 1, 2, 2) / probability,
        (k + 2) / (2 * (k + 1)),
        2e-14,
      );
    }
  }
  close(total + exactNb2Sf(40), 1, 2e-14);
});

test("CDF and SF retain their distinct, off-by-one-safe meanings", () => {
  for (let k = 0; k <= 20; k += 1) {
    const exactSurvival = exactNb2Sf(k);
    close(lab.sf(k, 2, 2), exactSurvival, 5e-14);
    close(lab.cdf(k, 2, 2), 1 - exactSurvival, 5e-14);
    close(lab.cdf(k, 2, 2) + lab.sf(k, 2, 2), 1, 2e-15);
  }

  const stock = 3;
  close(lab.fillRate(stock, 2, 2), 0.6875);
  close(lab.probabilityExistingBackorders(stock, 2, 2), 0.1875);
  close(1 - lab.fillRate(stock, 2, 2), 0.3125); // P(X >= s)
  assert.notEqual(
    lab.probabilityExistingBackorders(stock, 2, 2),
    1 - lab.fillRate(stock, 2, 2),
  );
});

test("Poisson and NB stock metrics match independent numerical oracles", () => {
  const poisson = lab.metricsAtStock(12, 8, 1);
  close(poisson.fillRate, 0.88807599898148, 2e-13);
  close(poisson.probabilityExistingBackorders, 0.0637971967365631, 2e-13);
  close(poisson.expectedBackorders, 0.129825647309405, 2e-13);

  const nb = lab.metricsAtStock(12, 8, 2);
  close(nb.fillRate, 0.8203582763671875, 2e-13);
  close(nb.probabilityExistingBackorders, 0.1315879821777344, 2e-13);
  close(nb.expectedBackorders, 0.434722900390625, 2e-13);
});

test("EBO is E[(X-s)+] and obeys its tail recurrence", () => {
  for (let stock = 0; stock <= 20; stock += 1) {
    const exactEbo = (stock + 4) / 2 ** (stock + 1);
    close(lab.expectedBackorders(stock, 2, 2), exactEbo, 5e-14);

    const decrement =
      lab.expectedBackorders(stock, 2, 2) -
      lab.expectedBackorders(stock + 1, 2, 2);
    close(decrement, lab.sf(stock, 2, 2), 5e-14);
  }

  close(lab.expectedBackorders(0, 5.7, 1), 5.7);
  close(lab.expectedBackorders(0, 5.7, 3), 5.7);
});

test("overdispersion does not get encoded as a false pointwise ordering", () => {
  // At low stock NB has more mass near zero, even though its EBO is larger.
  assert.ok(lab.fillRate(1, 2, 2) > lab.fillRate(1, 2, 1));
  assert.ok(
    lab.probabilityExistingBackorders(1, 2, 2) <
      lab.probabilityExistingBackorders(1, 2, 1),
  );
  assert.ok(lab.expectedBackorders(1, 2, 2) > lab.expectedBackorders(1, 2, 1));
});

test("adaptive support reports the probability and mean that it omits", () => {
  const truncated = lab.buildDistribution(2, 2, {
    tailTolerance: 1e-12,
    maxK: 2,
  });
  assert.equal(truncated.supportMax, 2);
  assert.equal(truncated.truncated, true);
  assert.deepEqual(truncated.probabilities, [0.25, 0.25, 0.1875]);
  close(truncated.rawProbabilitySum, 0.6875);
  close(truncated.omittedProbability, 0.3125);
  close(truncated.includedMean, 0.625);
  close(truncated.omittedMean, 1.375);
  close(truncated.rawProbabilitySum + truncated.omittedProbability, 1);

  const adaptive = lab.buildDistribution(2, 2, { tailTolerance: 1e-12 });
  assert.equal(adaptive.reachedTolerance, true);
  assert.equal(adaptive.truncated, false);
  assert.ok(adaptive.omittedProbability <= 1e-12);
  assert.ok(adaptive.omittedProbability <= adaptive.tailUpperBound);
  assert.ok(Math.abs(adaptive.massBalanceError) < 5e-14);
  assert.ok(Math.abs(adaptive.includedMean - 2) < 5e-10);

  const secondMoment = adaptive.points.reduce(
    (sum, point) => sum + point.k * point.k * point.pmf,
    0,
  );
  const representedVariance = secondMoment - adaptive.includedMean ** 2;
  assert.ok(Math.abs(representedVariance - 4) < 2e-8);
});

test("mode-anchored recursion remains usable when exp(-mean) underflows", () => {
  const distribution = lab.buildDistribution(1000, 1, {
    tailTolerance: 1e-12,
    maxK: 2000,
  });
  assert.ok(distribution.probabilities[0] === 0); // exp(-1000) underflows.
  close(distribution.probabilities[1000], 0.0126146113487215, 1e-12);
  assert.ok(distribution.rawProbabilitySum > 0.99999999999);
  assert.ok(distribution.omittedProbability < 1e-12);
  assert.ok(Math.abs(distribution.massBalanceError) < 1e-11);
});

test("comparison series shares one support and preserves equal-VMR identity", () => {
  const comparison = lab.buildComparison(8, 2, { tailTolerance: 1e-9 });
  assert.equal(comparison.poisson.supportMax, comparison.supportMax);
  assert.equal(comparison.negativeBinomial.supportMax, comparison.supportMax);
  assert.equal(comparison.rows.length, comparison.supportMax + 1);
  assert.ok(comparison.negativeBinomial.supportMax > 20);

  const identical = lab.buildComparison(4, 1, { tailTolerance: 1e-11 });
  assert.deepEqual(identical.poisson.probabilities, identical.nb.probabilities);
  assert.deepEqual(identical.poisson.survival, identical.nb.survival);
});

test("required stock returns the smallest s satisfying FR(s) >= target", () => {
  assert.deepEqual(lab.requiredStocks(8, 2, 0.9), {
    target: 0.9,
    poisson: 13,
    negativeBinomial: 14,
  });
  assert.deepEqual(lab.requiredStocks(8, 2, 0.95), {
    target: 0.95,
    poisson: 14,
    negativeBinomial: 16,
  });

  for (const vmr of [1, 1.2, 2, 5]) {
    const stock = lab.requiredStockForTargetFR(0.95, 3, vmr);
    assert.ok(lab.fillRate(stock, 3, vmr) >= 0.95);
    assert.ok(lab.fillRate(stock - 1, 3, vmr) < 0.95);
  }
  assert.equal(lab.requiredStockForTargetFR(0, 3, 2), 0);
  assert.equal(lab.requiredStockForTargetFR(1, 3, 2), Infinity);
  assert.equal(
    lab.requiredStockForTargetFR(0.1, 2, 2, { maxStock: 0 }),
    Infinity,
  );
});

test("zero mean is represented as a degenerate random variable", () => {
  assert.equal(lab.pmf(0, 0, 3), 1);
  assert.equal(lab.pmf(1, 0, 3), 0);
  assert.equal(lab.cdf(0, 0, 3), 1);
  assert.equal(lab.sf(0, 0, 3), 0);
  assert.equal(lab.fillRate(0, 0, 3), 0); // Literal P(X < 0).
  assert.equal(lab.fillRate(1, 0, 3), 1);
  assert.equal(lab.expectedBackorders(0, 0, 3), 0);
  assert.equal(lab.requiredStockForTargetFR(0.99, 0, 3), 1);
});

test("Mulberry32 seed is reproducible against a pinned reference stream", () => {
  const rng = lab.createSeededRng(123);
  const oracle = [
    0.7872516233474016,
    0.1785435655619949,
    0.49531551403924823,
    0.23136196262203157,
    0.375791602069512,
  ];
  oracle.forEach((expected) => assert.equal(rng(), expected));

  const first = lab.simulate(2, 2, 100, "turma");
  const second = lab.simulate(2, 2, 100, "turma");
  assert.deepEqual(first.gammaRates, second.gammaRates);
  assert.deepEqual(first.poissonCounts, second.poissonCounts);
  assert.deepEqual(first.negativeBinomialCounts, second.negativeBinomialCounts);
});

test("simulation exposes fixed and gamma rates using controlled streams", () => {
  const vmr15 = lab.simulate(8, 1.5, 1000, 90210);
  const vmr3 = lab.simulate(8, 3, 1000, 90210);
  assert.deepEqual(vmr15.poissonCounts, vmr3.poissonCounts);
  assert.ok(vmr15.fixedRates.every((rate) => rate === 8));
  assert.ok(vmr15.gammaRates.some((rate) => rate !== 8));
  assert.equal(vmr15.counts.poisson, vmr15.poissonCounts);
  assert.equal(vmr15.counts.negativeBinomial, vmr15.negativeBinomialCounts);

  const exactPoisson = lab.simulate(8, 1, 1000, 90210);
  assert.deepEqual(exactPoisson.gammaRates, exactPoisson.fixedRates);
  assert.deepEqual(exactPoisson.negativeBinomialCounts, exactPoisson.poissonCounts);
});

test("seeded gamma-Poisson simulation recovers mean and VMR", () => {
  const simulation = lab.simulate(8, 2, { periods: 100000, seed: 12345 });
  const poisson = simulation.summaries.poisson;
  const nb = simulation.summaries.negativeBinomial;
  assert.ok(Math.abs(poisson.mean - 8) < 0.08);
  assert.ok(Math.abs(poisson.variance - 8) < 0.2);
  assert.ok(Math.abs(poisson.vmr - 1) < 0.025);
  assert.ok(Math.abs(nb.mean - 8) < 0.1);
  assert.ok(Math.abs(nb.variance - 16) < 0.35);
  assert.ok(Math.abs(nb.vmr - 2) < 0.04);
});

test("simulation covers small gamma shapes and the large-Poisson PTRS path", () => {
  // mean=.5, VMR=5 implies gamma shape nu=.125 (<1).
  const dispersed = lab.simulate(0.5, 5, { periods: 100000, seed: 12345 });
  const nb = dispersed.negativeBinomialSummary;
  assert.ok(Math.abs(nb.mean - 0.5) < 0.02);
  assert.ok(Math.abs(nb.variance - 2.5) < 0.12);
  assert.ok(Math.abs(nb.vmr - 5) < 0.2);

  // lambda=30 takes the transformed-rejection sampler rather than Knuth's loop.
  const large = lab.simulate(30, 1, { periods: 100000, seed: 12345 });
  assert.ok(large.poissonCounts.every(Number.isInteger));
  assert.ok(large.poissonCounts.every((count) => count >= 0));
  assert.ok(Math.abs(large.poissonSummary.mean - 30) < 0.12);
  assert.ok(Math.abs(large.poissonSummary.variance - 30) < 0.35);
});
