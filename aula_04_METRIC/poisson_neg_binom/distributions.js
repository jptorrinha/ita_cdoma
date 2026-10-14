/*
 * Probability engine for the Poisson versus negative-binomial teaching app.
 *
 * The two distributions always have the same mean.  The negative binomial is
 * parameterised by its variance-to-mean ratio (VMR):
 *
 *     nu = mean / (VMR - 1),       p = 1 / VMR.
 *
 * With this convention E[X] = mean and Var[X] = mean * VMR.  VMR === 1 is
 * handled as an exact Poisson branch; it is not replaced by an epsilon test.
 */
(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DistributionLab = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_TAIL_TOLERANCE = 1e-10;
  const DEFAULT_MAX_K = 100000;
  const DEFAULT_SEED = 0x6d2b79f5;
  const TAIL_SUM_TOLERANCE = 8 * Number.EPSILON;
  const MAX_TAIL_TERMS = 5000000;

  function assertFiniteNonnegative(value, name) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a finite number greater than or equal to zero.`);
    }
  }

  function assertVmr(vmr) {
    if (!Number.isFinite(vmr) || vmr < 1) {
      throw new RangeError("vmr must be a finite number greater than or equal to one.");
    }
  }

  function assertStock(stock) {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new RangeError("stock must be a nonnegative integer.");
    }
  }

  function clampProbability(value) {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  }

  function distributionParameters(mean, vmr = 1) {
    assertFiniteNonnegative(mean, "mean");
    assertVmr(vmr);

    if (vmr === 1) {
      return Object.freeze({
        kind: "poisson",
        mean,
        mu: mean,
        variance: mean,
        vmr: 1,
        nu: Infinity,
        p: 1,
        overdispersion: 0,
        degenerate: mean === 0,
      });
    }

    const overdispersion = vmr - 1;
    return Object.freeze({
      kind: "negative-binomial",
      mean,
      mu: mean,
      variance: mean * vmr,
      vmr,
      nu: mean / overdispersion,
      p: 1 / vmr,
      overdispersion,
      degenerate: mean === 0,
    });
  }

  /* P(X=k+1) / P(X=k).  The NB expression avoids multiplying a very large
     nu by a very small (1-p), which matters when VMR is just above one. */
  function recurrenceRatio(k, descriptor) {
    if (descriptor.kind === "poisson") {
      return descriptor.mean / (k + 1);
    }
    return (
      descriptor.mean / descriptor.vmr +
      k * (descriptor.overdispersion / descriptor.vmr)
    ) / (k + 1);
  }

  function modeOf(descriptor) {
    if (descriptor.mean === 0) return 0;
    if (descriptor.kind === "poisson") return Math.floor(descriptor.mean);
    return Math.floor(Math.max(0, descriptor.mean - descriptor.overdispersion));
  }

  function logProbabilityZero(descriptor) {
    if (descriptor.mean === 0) return 0;
    if (descriptor.kind === "poisson") return -descriptor.mean;

    // nu*log(p) written in a form that has the correct, stable VMR -> 1 limit.
    const d = descriptor.overdispersion;
    return -descriptor.mean * (Math.log1p(d) / d);
  }

  /*
   * Obtain log P(X=k) by accumulating the PMF recurrence in log space.  This
   * is slower than a factorial formula for a single point, but remains stable
   * for non-integer nu and for VMR extremely close to one.
   */
  function logPmf(k, descriptor) {
    if (descriptor.mean === 0) return k === 0 ? 0 : -Infinity;

    let answer = logProbabilityZero(descriptor);
    for (let j = 0; j < k; j += 1) {
      const ratio = recurrenceRatio(j, descriptor);
      if (!(ratio > 0)) return -Infinity;
      answer += Math.log(ratio);
    }
    return answer;
  }

  function pmf(k, mean, vmr = 1) {
    assertFiniteNonnegative(mean, "mean");
    assertVmr(vmr);
    if (!Number.isInteger(k) || k < 0) return 0;

    const descriptor = distributionParameters(mean, vmr);
    return Math.exp(logPmf(k, descriptor));
  }

  function poissonPmf(k, mean) {
    return pmf(k, mean, 1);
  }

  function negativeBinomialPmf(k, mean, vmr) {
    assertVmr(vmr);
    return pmf(k, mean, vmr);
  }

  function kahanAdd(state, value) {
    const adjusted = value - state.correction;
    const next = state.sum + adjusted;
    state.correction = (next - state.sum) - adjusted;
    state.sum = next;
  }

  function leftTail(k, descriptor) {
    if (k < 0) return 0;
    if (descriptor.mean === 0) return 1;

    let probability = Math.exp(logPmf(k, descriptor));
    if (probability === 0) return 0;

    const total = { sum: 0, correction: 0 };
    for (let j = k; j >= 0; j -= 1) {
      kahanAdd(total, probability);
      if (j > 0) {
        probability /= recurrenceRatio(j - 1, descriptor);
      }
    }
    return clampProbability(total.sum);
  }

  function futureRatioUpperBound(k, descriptor) {
    const current = recurrenceRatio(k, descriptor);
    if (descriptor.kind === "poisson") return current;
    const limitingRatio = descriptor.overdispersion / descriptor.vmr;
    return Math.max(current, limitingRatio);
  }

  function rightTail(k, descriptor) {
    if (k < 0) return 1;
    if (descriptor.mean === 0) return 0;

    let x = k + 1;
    let probability = Math.exp(logPmf(x, descriptor));
    if (probability === 0) return 0;

    const total = { sum: 0, correction: 0 };
    for (let terms = 0; terms < MAX_TAIL_TERMS; terms += 1) {
      kahanAdd(total, probability);

      const ratio = recurrenceRatio(x, descriptor);
      const next = probability * ratio;
      if (next === 0) break;

      const ratioBound = futureRatioUpperBound(x, descriptor);
      if (ratioBound < 1) {
        const remainderBound = next / (1 - ratioBound);
        if (remainderBound <= TAIL_SUM_TOLERANCE * Math.max(1, total.sum)) {
          break;
        }
      }

      probability = next;
      x += 1;
    }
    return clampProbability(total.sum);
  }

  function cdf(k, mean, vmr = 1) {
    assertFiniteNonnegative(mean, "mean");
    assertVmr(vmr);
    if (Number.isNaN(k)) throw new RangeError("k must be a number.");
    if (!Number.isFinite(k)) return k === Infinity ? 1 : 0;

    const cutoff = Math.floor(k);
    if (cutoff < 0) return 0;
    const descriptor = distributionParameters(mean, vmr);
    if (descriptor.mean === 0) return 1;

    const mode = modeOf(descriptor);
    return cutoff < mode
      ? leftTail(cutoff, descriptor)
      : clampProbability(1 - rightTail(cutoff, descriptor));
  }

  /* Standard discrete survival function: SF(k) = P(X > k). */
  function sf(k, mean, vmr = 1) {
    assertFiniteNonnegative(mean, "mean");
    assertVmr(vmr);
    if (Number.isNaN(k)) throw new RangeError("k must be a number.");
    if (!Number.isFinite(k)) return k === Infinity ? 0 : 1;

    const cutoff = Math.floor(k);
    if (cutoff < 0) return 1;
    const descriptor = distributionParameters(mean, vmr);
    if (descriptor.mean === 0) return 0;

    const mode = modeOf(descriptor);
    return cutoff < mode
      ? clampProbability(1 - leftTail(cutoff, descriptor))
      : rightTail(cutoff, descriptor);
  }

  /* Immediate-demand fill rate under the (s-1,s) convention. */
  function fillRate(stock, mean, vmr = 1) {
    assertStock(stock);
    // Validate distribution arguments even though FR(0) is identically zero.
    distributionParameters(mean, vmr);
    return stock === 0 ? 0 : cdf(stock - 1, mean, vmr);
  }

  /* Probability that the backorder random variable (X-s)+ is positive. */
  function probabilityExistingBackorders(stock, mean, vmr = 1) {
    assertStock(stock);
    return sf(stock, mean, vmr);
  }

  function lowerExpectedShortfall(stock, descriptor) {
    if (stock === 0) return 0;

    let x = stock - 1;
    let probability = Math.exp(logPmf(x, descriptor));
    const total = { sum: 0, correction: 0 };
    while (x >= 0 && probability > 0) {
      kahanAdd(total, (stock - x) * probability);
      if (x > 0) probability /= recurrenceRatio(x - 1, descriptor);
      x -= 1;
    }
    return total.sum;
  }

  function upperExpectedExcess(stock, descriptor) {
    let x = stock + 1;
    let probability = Math.exp(logPmf(x, descriptor));
    if (probability === 0) return 0;

    const total = { sum: 0, correction: 0 };
    for (let terms = 0; terms < MAX_TAIL_TERMS; terms += 1) {
      kahanAdd(total, (x - stock) * probability);

      const probabilityRatio = recurrenceRatio(x, descriptor);
      const nextProbability = probability * probabilityRatio;
      if (nextProbability === 0) break;

      const nextWeight = x + 1 - stock;
      const currentWeight = x - stock;
      const weightedRatio = probabilityRatio * (nextWeight / currentWeight);
      const limitingRatio = descriptor.kind === "poisson"
        ? probabilityRatio
        : descriptor.overdispersion / descriptor.vmr;
      const ratioBound = Math.max(weightedRatio, limitingRatio);
      if (ratioBound < 1) {
        const nextTerm = nextWeight * nextProbability;
        const remainderBound = nextTerm / (1 - ratioBound);
        if (
          remainderBound <=
          TAIL_SUM_TOLERANCE * Math.max(1, descriptor.mean, total.sum)
        ) {
          break;
        }
      }

      probability = nextProbability;
      x += 1;
    }
    return Math.max(0, total.sum);
  }

  /* EBO(s) = E[(X-s)+]. */
  function expectedBackorders(stock, mean, vmr = 1) {
    assertStock(stock);
    const descriptor = distributionParameters(mean, vmr);
    if (descriptor.mean === 0) return 0;
    if (stock === 0) return descriptor.mean;

    const mode = modeOf(descriptor);
    if (stock <= mode) {
      return Math.max(
        0,
        descriptor.mean - stock + lowerExpectedShortfall(stock, descriptor),
      );
    }
    return upperExpectedExcess(stock, descriptor);
  }

  function remainingTailUpperBound(k, probabilityAtK, descriptor) {
    if (k < modeOf(descriptor)) return 1;
    const next = probabilityAtK * recurrenceRatio(k, descriptor);
    if (next === 0) return 0;
    const ratioBound = futureRatioUpperBound(k, descriptor);
    return ratioBound < 1 ? next / (1 - ratioBound) : 1;
  }

  function parseSupportOptions(options) {
    const config = options || {};
    const tailTolerance = config.tailTolerance === undefined
      ? DEFAULT_TAIL_TOLERANCE
      : config.tailTolerance;
    const maxK = config.maxK === undefined ? DEFAULT_MAX_K : config.maxK;
    const minK = config.minK === undefined ? 0 : config.minK;

    if (!(tailTolerance > 0 && tailTolerance < 1) || !Number.isFinite(tailTolerance)) {
      throw new RangeError("tailTolerance must lie strictly between zero and one.");
    }
    if (!Number.isInteger(maxK) || maxK < 0) {
      throw new RangeError("maxK must be a nonnegative integer.");
    }
    if (!Number.isInteger(minK) || minK < 0 || minK > maxK) {
      throw new RangeError("minK must be a nonnegative integer no greater than maxK.");
    }
    return { tailTolerance, maxK, minK };
  }

  /*
   * Build P(0),...,P(K) around the mode, then extend K until a geometric
   * upper bound on P(X>K) reaches the requested tolerance.  The returned
   * omittedProbability and omittedMean explicitly account for the part not
   * drawn by a finite chart.
   */
  function buildDistribution(mean, vmr = 1, options = {}) {
    const descriptor = distributionParameters(mean, vmr);
    const config = parseSupportOptions(options);

    if (descriptor.mean === 0) {
      const supportMax = config.minK;
      const probabilities = new Array(supportMax + 1).fill(0);
      probabilities[0] = 1;
      const cumulative = new Array(supportMax + 1).fill(1);
      const survival = new Array(supportMax + 1).fill(0);
      const points = probabilities.map((probability, k) => ({
        k,
        pmf: probability,
        cdf: cumulative[k],
        sf: survival[k],
      }));
      return {
        ...descriptor,
        supportMin: 0,
        supportMax,
        k: points.map((point) => point.k),
        probabilities,
        pmf: probabilities,
        cumulative,
        cdf: cumulative,
        survival,
        sf: survival,
        points,
        includedProbability: 1,
        rawProbabilitySum: 1,
        omittedProbability: 0,
        omittedTail: 0,
        includedMean: 0,
        omittedMean: 0,
        tailUpperBound: 0,
        massBalanceError: 0,
        tailTolerance: config.tailTolerance,
        reachedTolerance: true,
        truncated: false,
      };
    }

    const mode = modeOf(descriptor);
    const anchor = Math.min(mode, config.maxK);
    const probabilities = new Array(anchor + 1).fill(0);
    probabilities[anchor] = Math.exp(logPmf(anchor, descriptor));

    for (let x = anchor; x > 0; x -= 1) {
      probabilities[x - 1] = probabilities[x] / recurrenceRatio(x - 1, descriptor);
    }

    let supportMax = anchor;
    let probability = probabilities[anchor];
    let tailBound = remainingTailUpperBound(supportMax, probability, descriptor);
    while (
      supportMax < config.maxK &&
      (supportMax < config.minK || tailBound > config.tailTolerance)
    ) {
      const next = probability * recurrenceRatio(supportMax, descriptor);
      supportMax += 1;
      probability = next;
      probabilities.push(probability);
      tailBound = remainingTailUpperBound(supportMax, probability, descriptor);
    }

    const probabilitySum = { sum: 0, correction: 0 };
    const meanSum = { sum: 0, correction: 0 };
    const cumulative = new Array(probabilities.length);
    const survival = new Array(probabilities.length);
    for (let x = 0; x < probabilities.length; x += 1) {
      kahanAdd(probabilitySum, probabilities[x]);
      kahanAdd(meanSum, x * probabilities[x]);
      cumulative[x] = clampProbability(probabilitySum.sum);
      survival[x] = clampProbability(1 - probabilitySum.sum);
    }

    const omittedProbability = sf(supportMax, mean, vmr);
    const includedProbability = clampProbability(1 - omittedProbability);
    const includedMean = Math.max(0, meanSum.sum);
    const omittedMean = Math.max(0, descriptor.mean - includedMean);
    const reachedTolerance = tailBound <= config.tailTolerance;
    const points = probabilities.map((pointProbability, k) => ({
      k,
      pmf: pointProbability,
      cdf: cumulative[k],
      sf: survival[k],
    }));

    return {
      ...descriptor,
      mode,
      supportMin: 0,
      supportMax,
      k: points.map((point) => point.k),
      probabilities,
      pmf: probabilities,
      cumulative,
      cdf: cumulative,
      survival,
      sf: survival,
      points,
      includedProbability,
      rawProbabilitySum: probabilitySum.sum,
      omittedProbability,
      omittedTail: omittedProbability,
      includedMean,
      omittedMean,
      tailUpperBound: tailBound,
      massBalanceError: probabilitySum.sum + omittedProbability - 1,
      tailTolerance: config.tailTolerance,
      reachedTolerance,
      truncated: !reachedTolerance,
    };
  }

  function buildComparison(mean, vmr, options = {}) {
    assertVmr(vmr);
    const initialPoisson = buildDistribution(mean, 1, options);
    const initialNegativeBinomial = buildDistribution(mean, vmr, options);
    const commonMax = Math.max(
      initialPoisson.supportMax,
      initialNegativeBinomial.supportMax,
    );
    const commonOptions = { ...options, minK: commonMax };
    const poisson = initialPoisson.supportMax === commonMax
      ? initialPoisson
      : buildDistribution(mean, 1, commonOptions);
    const negativeBinomial = initialNegativeBinomial.supportMax === commonMax
      ? initialNegativeBinomial
      : buildDistribution(mean, vmr, commonOptions);

    const rows = [];
    for (let k = 0; k <= commonMax; k += 1) {
      rows.push({
        k,
        poissonPmf: poisson.probabilities[k],
        negativeBinomialPmf: negativeBinomial.probabilities[k],
        poissonCdf: poisson.cumulative[k],
        negativeBinomialCdf: negativeBinomial.cumulative[k],
        poissonSf: poisson.survival[k],
        negativeBinomialSf: negativeBinomial.survival[k],
      });
    }

    return {
      mean,
      vmr,
      supportMin: 0,
      supportMax: commonMax,
      k: rows.map((row) => row.k),
      rows,
      poisson,
      negativeBinomial,
      nb: negativeBinomial,
    };
  }

  function metricsAtStock(stock, mean, vmr = 1) {
    assertStock(stock);
    const existing = probabilityExistingBackorders(stock, mean, vmr);
    const rate = fillRate(stock, mean, vmr);
    return {
      stock,
      mean,
      vmr,
      pmfAtStock: pmf(stock, mean, vmr),
      cdfAtStock: cdf(stock, mean, vmr),
      sfAtStock: existing,
      fillRate: rate,
      probabilityExistingBackorders: existing,
      existingBackorderProbability: existing,
      expectedBackorders: expectedBackorders(stock, mean, vmr),
    };
  }

  function comparisonAtStock(stock, mean, vmr) {
    return {
      stock,
      mean,
      vmr,
      poisson: metricsAtStock(stock, mean, 1),
      negativeBinomial: metricsAtStock(stock, mean, vmr),
    };
  }

  function requiredStockForTargetFR(target, mean, vmr = 1, options = {}) {
    if (!Number.isFinite(target) || target < 0 || target > 1) {
      throw new RangeError("target must lie between zero and one.");
    }
    const descriptor = distributionParameters(mean, vmr);
    const maxStock = options.maxStock === undefined ? DEFAULT_MAX_K : options.maxStock;
    if (!Number.isInteger(maxStock) || maxStock < 0) {
      throw new RangeError("maxStock must be a nonnegative integer.");
    }
    if (target === 0) return 0;
    if (descriptor.mean === 0) return maxStock >= 1 ? 1 : Infinity;
    if (target === 1) return Infinity;
    if (maxStock === 0) return Infinity;

    let lower = 0;
    let upper = Math.min(1, maxStock);
    while (upper < maxStock && fillRate(upper, mean, vmr) < target) {
      lower = upper;
      upper = Math.min(maxStock, upper * 2);
    }
    if (fillRate(upper, mean, vmr) < target) return Infinity;

    while (lower + 1 < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (fillRate(middle, mean, vmr) >= target) upper = middle;
      else lower = middle;
    }
    return upper;
  }

  function requiredStocks(mean, vmr, target, options = {}) {
    return {
      target,
      poisson: requiredStockForTargetFR(target, mean, 1, options),
      negativeBinomial: requiredStockForTargetFR(target, mean, vmr, options),
    };
  }

  function stockCurves(mean, vmr, maxStockOrOptions = 20) {
    const options = typeof maxStockOrOptions === "number"
      ? { maxStock: maxStockOrOptions }
      : (maxStockOrOptions || {});
    const maxStock = options.maxStock === undefined ? 20 : options.maxStock;
    if (!Number.isInteger(maxStock) || maxStock < 0) {
      throw new RangeError("maxStock must be a nonnegative integer.");
    }

    const rows = [];
    for (let stock = 0; stock <= maxStock; stock += 1) {
      rows.push(comparisonAtStock(stock, mean, vmr));
    }
    return {
      mean,
      vmr,
      maxStock,
      stocks: rows.map((row) => row.stock),
      rows,
      poisson: {
        fillRate: rows.map((row) => row.poisson.fillRate),
        probabilityExistingBackorders: rows.map(
          (row) => row.poisson.probabilityExistingBackorders,
        ),
        expectedBackorders: rows.map((row) => row.poisson.expectedBackorders),
      },
      negativeBinomial: {
        fillRate: rows.map((row) => row.negativeBinomial.fillRate),
        probabilityExistingBackorders: rows.map(
          (row) => row.negativeBinomial.probabilityExistingBackorders,
        ),
        expectedBackorders: rows.map(
          (row) => row.negativeBinomial.expectedBackorders,
        ),
      },
    };
  }

  function hashSeed(seed) {
    if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
    const text = String(seed);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /* Mulberry32: compact, deterministic and identical in browser and Node. */
  function createSeededRng(seed = DEFAULT_SEED) {
    const initialSeed = hashSeed(seed);
    let state = initialSeed;
    const rng = function () {
      state = (state + 0x6d2b79f5) | 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    rng.seed = initialSeed;
    return rng;
  }

  function standardNormal(rng) {
    let u;
    let v;
    let squaredRadius;
    do {
      u = 2 * rng() - 1;
      v = 2 * rng() - 1;
      squaredRadius = u * u + v * v;
    } while (squaredRadius === 0 || squaredRadius >= 1);
    return u * Math.sqrt(-2 * Math.log(squaredRadius) / squaredRadius);
  }

  /* Marsaglia-Tsang gamma sampler; scale defaults to one. */
  function sampleGamma(shape, scale = 1, rng = Math.random) {
    if (typeof scale === "function") {
      rng = scale;
      scale = 1;
    }
    if (!Number.isFinite(shape) || shape <= 0) {
      throw new RangeError("shape must be a finite number greater than zero.");
    }
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new RangeError("scale must be a finite number greater than zero.");
    }

    if (shape < 1) {
      const uniform = Math.max(rng(), Number.MIN_VALUE);
      return sampleGamma(shape + 1, scale, rng) * Math.pow(uniform, 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      const normal = standardNormal(rng);
      const base = 1 + c * normal;
      if (base <= 0) continue;
      const cube = base * base * base;
      const uniform = rng();
      if (uniform < 1 - 0.0331 * normal ** 4) return scale * d * cube;
      if (
        Math.log(Math.max(uniform, Number.MIN_VALUE)) <
        0.5 * normal * normal + d * (1 - cube + Math.log(cube))
      ) {
        return scale * d * cube;
      }
    }
  }

  function logGamma(z) {
    const coefficients = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.984369578019572e-6,
      1.5056327351493116e-7,
    ];
    if (z < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    const shifted = z - 1;
    let series = coefficients[0];
    for (let i = 1; i < coefficients.length; i += 1) {
      series += coefficients[i] / (shifted + i);
    }
    const t = shifted + 7.5;
    return (
      0.5 * Math.log(2 * Math.PI) +
      (shifted + 0.5) * Math.log(t) -
      t +
      Math.log(series)
    );
  }

  function samplePoisson(lambda, rng = Math.random) {
    assertFiniteNonnegative(lambda, "lambda");
    if (lambda === 0) return 0;

    if (lambda < 30) {
      const limit = Math.exp(-lambda);
      let product = 1;
      let count = 0;
      do {
        count += 1;
        product *= rng();
      } while (product > limit);
      return count - 1;
    }

    // PTRS transformed rejection (Hoermann), exact up to floating-point error.
    const sqrtLambda = Math.sqrt(lambda);
    const b = 0.931 + 2.53 * sqrtLambda;
    const a = -0.059 + 0.02483 * b;
    const inverseAlpha = 1.1239 + 1.1328 / (b - 3.4);
    const vR = 0.9277 - 3.6224 / (b - 2);
    while (true) {
      const u = rng() - 0.5;
      const v = rng();
      const us = 0.5 - Math.abs(u);
      const k = Math.floor((2 * a / us + b) * u + lambda + 0.43);
      if (us >= 0.07 && v <= vR) return k;
      if (k < 0 || (us < 0.013 && v > us)) continue;

      const lhs = Math.log(v * inverseAlpha / (a / (us * us) + b));
      const rhs = -lambda + k * Math.log(lambda) - logGamma(k + 1);
      if (lhs <= rhs) return k;
    }
  }

  function sampleDemand(mean, vmr = 1, rng = Math.random) {
    const descriptor = distributionParameters(mean, vmr);
    if (descriptor.mean === 0) return 0;
    if (descriptor.kind === "poisson") return samplePoisson(mean, rng);
    const rate = sampleGamma(descriptor.nu, descriptor.overdispersion, rng);
    return samplePoisson(rate, rng);
  }

  function sampleSummary(values, stock) {
    const n = values.length;
    let sum = 0;
    let immediate = 0;
    let existing = 0;
    let backorders = 0;
    for (let i = 0; i < n; i += 1) {
      const value = values[i];
      sum += value;
      if (stock !== undefined) {
        if (value < stock) immediate += 1;
        if (value > stock) existing += 1;
        backorders += Math.max(value - stock, 0);
      }
    }
    const sampleMean = sum / n;
    let squaredDeviations = 0;
    for (let i = 0; i < n; i += 1) {
      const difference = values[i] - sampleMean;
      squaredDeviations += difference * difference;
    }
    const variance = squaredDeviations / n;
    const summary = {
      mean: sampleMean,
      variance,
      vmr: sampleMean === 0 ? 0 : variance / sampleMean,
    };
    if (stock !== undefined) {
      summary.fillRate = immediate / n;
      summary.probabilityExistingBackorders = existing / n;
      summary.expectedBackorders = backorders / n;
    }
    return summary;
  }

  /*
   * simulate(mean, vmr, periods, seed)
   * simulate(mean, vmr, { periods, seed, stock })
   *
   * Poisson uses a fixed rate.  NB first draws a gamma rate and then a
   * Poisson count, exposing both layers so students can see the mixture.
   */
  function simulate(mean, vmr = 1, periodsOrOptions = 1000, seedArgument) {
    const descriptor = distributionParameters(mean, vmr);
    const options = typeof periodsOrOptions === "object" && periodsOrOptions !== null
      ? periodsOrOptions
      : { periods: periodsOrOptions, seed: seedArgument };
    const periods = options.periods === undefined
      ? (options.draws === undefined ? 1000 : options.draws)
      : options.periods;
    const seed = options.seed === undefined ? DEFAULT_SEED : options.seed;
    if (!Number.isInteger(periods) || periods <= 0) {
      throw new RangeError("periods must be a positive integer.");
    }
    if (options.stock !== undefined) assertStock(options.stock);

    const normalizedSeed = hashSeed(seed);
    // Separate streams keep the Poisson control unchanged when only VMR moves.
    const poissonRng = createSeededRng((normalizedSeed ^ 0x9e3779b9) >>> 0);
    const negativeBinomialRng = createSeededRng((normalizedSeed ^ 0x243f6a88) >>> 0);
    const fixedRates = new Array(periods).fill(mean);
    const gammaRates = new Array(periods);
    const poissonCounts = new Array(periods);
    const negativeBinomialCounts = new Array(periods);

    for (let i = 0; i < periods; i += 1) {
      const poissonCount = samplePoisson(mean, poissonRng);
      poissonCounts[i] = poissonCount;

      if (descriptor.kind === "poisson" || descriptor.mean === 0) {
        gammaRates[i] = mean;
        negativeBinomialCounts[i] = poissonCount;
      } else {
        const rate = sampleGamma(
          descriptor.nu,
          descriptor.overdispersion,
          negativeBinomialRng,
        );
        gammaRates[i] = rate;
        negativeBinomialCounts[i] = samplePoisson(rate, negativeBinomialRng);
      }
    }

    const poissonSummary = sampleSummary(poissonCounts, options.stock);
    const negativeBinomialSummary = sampleSummary(
      negativeBinomialCounts,
      options.stock,
    );

    return {
      mean,
      vmr,
      periods,
      draws: periods,
      seed,
      normalizedSeed,
      streamSeeds: {
        poisson: poissonRng.seed,
        negativeBinomial: negativeBinomialRng.seed,
      },
      fixedRates,
      gammaRates,
      poissonCounts,
      negativeBinomialCounts,
      rates: {
        poisson: fixedRates,
        negativeBinomial: gammaRates,
      },
      counts: {
        poisson: poissonCounts,
        negativeBinomial: negativeBinomialCounts,
      },
      summaries: {
        poisson: poissonSummary,
        negativeBinomial: negativeBinomialSummary,
      },
      poissonSummary,
      negativeBinomialSummary,
    };
  }

  return Object.freeze({
    DEFAULT_TAIL_TOLERANCE,
    DEFAULT_MAX_K,
    distributionParameters,
    parameters: distributionParameters,
    pmf,
    poissonPmf,
    negativeBinomialPmf,
    cdf,
    sf,
    fillRate,
    probabilityExistingBackorders,
    probExistingBackorders: probabilityExistingBackorders,
    expectedBackorders,
    ebo: expectedBackorders,
    buildDistribution,
    adaptiveSupport: buildDistribution,
    buildComparison,
    comparisonSeries: buildComparison,
    metricsAtStock,
    comparisonAtStock,
    stockCurves,
    requiredStockForTargetFR,
    requiredStocks,
    createSeededRng,
    sampleGamma,
    samplePoisson,
    sampleDemand,
    simulate,
  });
});
