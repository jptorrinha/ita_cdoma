(function () {
  "use strict";

  const Core = globalThis.DistributionLab;
  if (!Core) {
    document.body.innerHTML = "<p style='padding:2rem;font-family:system-ui'>Não foi possível carregar <code>distributions.js</code>.</p>";
    throw new Error("DistributionLab is not available.");
  }

  const DEFAULTS = Object.freeze({ mean: 8, vmr: 2, stock: 12, target: 0.9, periods: 120, seed: 274 });
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const controls = {
    mean: $("#mean-control"),
    vmr: $("#vmr-control"),
    stock: $("#stock-control"),
    target: $("#target-control"),
    periods: $("#periods-control"),
    seed: $("#seed-control"),
  };

  const outputs = {
    mean: $("#mean-output"),
    vmr: $("#vmr-output"),
    stock: $("#stock-output"),
    target: $("#target-output"),
    periods: $("#periods-output"),
  };

  const canvases = {
    pmf: $("#pmf-chart"),
    difference: $("#difference-chart"),
    tail: $("#tail-chart"),
    fillRate: $("#fill-rate-chart"),
    ebo: $("#ebo-chart"),
    rate: $("#rate-chart"),
    sample: $("#sample-chart"),
  };

  const tooltip = $("#chart-tooltip");
  const plotMetadata = new WeakMap();
  let computed = null;
  let renderFrame = null;

  const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const oneDecimalFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const threeDecimalFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const percentFormat = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function readState() {
    return {
      mean: Number(controls.mean.value),
      vmr: Number(controls.vmr.value),
      stock: Number(controls.stock.value),
      target: Number(controls.target.value),
      periods: Number(controls.periods.value),
      seed: Math.max(0, Math.trunc(Number(controls.seed.value) || 0)),
    };
  }

  function formatNumber(value, digits = 2) {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }

  function formatProbability(value) {
    if (value === 0) return "0%";
    if (value < 0.000001) return value.toExponential(2).replace(".", ",");
    if (value < 0.001) {
      return new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
    }
    if (value < 0.01) {
      return new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    }
    return percentFormat.format(value);
  }

  function formatCompactProbability(value) {
    if (value === 0) return "0";
    if (value < 0.0001) return value.toExponential(1).replace(".", ",");
    if (value < 0.01) return formatNumber(value, 4);
    return formatNumber(value, 3);
  }

  function signedPoints(value) {
    const points = value * 100;
    const sign = points > 1e-10 ? "+" : "";
    return `${sign}${formatNumber(points, 1)} p.p.`;
  }

  function quantile(probability, mean, vmr, upperHint) {
    const upper = Math.max(upperHint || 0, 16);
    for (let k = 0; k <= upper; k += 1) {
      if (Core.cdf(k, mean, vmr) >= probability) return k;
    }
    let k = upper + 1;
    while (k < 100000 && Core.cdf(k, mean, vmr) < probability) k += 1;
    return k;
  }

  function deriveData(state) {
    const minimumSupport = Math.max(
      state.stock + 5,
      16,
      Math.ceil(state.mean + 6 * Math.sqrt(state.mean * state.vmr)),
    );
    const comparison = Core.buildComparison(state.mean, state.vmr, {
      minK: Math.min(minimumSupport, 500),
      maxK: 1000,
      tailTolerance: 1e-9,
    });

    const stockMetrics = Core.comparisonAtStock(state.stock, state.mean, state.vmr);
    const poissonDescriptor = Core.distributionParameters(state.mean, 1);
    const nbDescriptor = Core.distributionParameters(state.mean, state.vmr);
    const q95Poisson = quantile(0.95, state.mean, 1, comparison.supportMax);
    const q95Nb = quantile(0.95, state.mean, state.vmr, comparison.supportMax);
    const required = Core.requiredStocks(state.mean, state.vmr, state.target, { maxStock: 1000 });

    const curveMax = Math.min(250, Math.max(
      state.stock + 7,
      required.poisson + 5,
      required.negativeBinomial + 5,
      Math.ceil(state.mean + 5 * Math.sqrt(state.mean * state.vmr)),
      18,
    ));
    const curves = Core.stockCurves(state.mean, state.vmr, curveMax);
    const simulation = Core.simulate(state.mean, state.vmr, {
      periods: state.periods,
      seed: state.seed,
      stock: state.stock,
    });

    return {
      state,
      comparison,
      stockMetrics,
      poissonDescriptor,
      nbDescriptor,
      q95Poisson,
      q95Nb,
      required,
      curves,
      simulation,
    };
  }

  function updateControlReadouts(data) {
    const { state } = data;
    outputs.mean.value = oneDecimalFormat.format(state.mean);
    outputs.vmr.value = oneDecimalFormat.format(state.vmr);
    outputs.stock.value = String(state.stock);
    outputs.target.value = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 }).format(state.target);
    outputs.periods.value = String(state.periods);
    controls.stock.max = String(Math.max(80, Math.min(250, data.curves.maxStock + 10)));

    $$(".preset").forEach((button) => {
      const active = Math.abs(Number(button.dataset.vmr) - state.vmr) < 1e-9;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateShapeSummary(data) {
    const { state, nbDescriptor, comparison } = data;
    $("#shared-mean").textContent = `μ = ${oneDecimalFormat.format(state.mean)}`;
    if (state.vmr === 1) {
      $("#nb-parameters").textContent = "limite: ν → ∞ · p → 1";
      $("#shape-insight").innerHTML = "<strong>Coincidência exata.</strong> Com φ = 1, a binomial negativa está no seu limite Poisson: mesma média, mesma variância e a mesma probabilidade para cada valor de k.";
    } else {
      $("#nb-parameters").textContent = `ν = ${formatNumber(nbDescriptor.nu, 2)} · p = ${threeDecimalFormat.format(nbDescriptor.p)}`;
      const p0Poisson = Core.pmf(0, state.mean, 1);
      const p0Nb = Core.pmf(0, state.mean, state.vmr);
      const centralLow = Math.max(0, Math.floor(state.mean - Math.sqrt(state.mean)));
      const centralHigh = Math.ceil(state.mean + Math.sqrt(state.mean));
      const centralPoisson = Core.cdf(centralHigh, state.mean, 1) - Core.cdf(centralLow - 1, state.mean, 1);
      const centralNb = Core.cdf(centralHigh, state.mean, state.vmr) - Core.cdf(centralLow - 1, state.mean, state.vmr);
      const centralDirection = centralNb < centralPoisson ? "retira" : "reorganiza";
      $("#shape-insight").innerHTML =
        `<strong>A média continua em ${oneDecimalFormat.format(state.mean)}, mas a variância é multiplicada por ${oneDecimalFormat.format(state.vmr)}.</strong> ` +
        `A sobredispersão ${centralDirection} massa da região central e reforça os extremos: ` +
        `P(X = 0) passa de ${formatProbability(p0Poisson)} para ${formatProbability(p0Nb)}, ` +
        `e Q<sub>95</sub> passa de ${data.q95Poisson} para ${data.q95Nb}.`;
    }

    $("#pmf-tail-note").textContent =
      `Suporte exibido: k = 0,…,${comparison.supportMax}. Massa à direita não desenhada: ` +
      `Poisson ${comparison.poisson.omittedProbability.toExponential(1)}; ` +
      `BN ${comparison.negativeBinomial.omittedProbability.toExponential(1)}.`;
  }

  function tableRow(label, dotClass, descriptor, metrics, p0, tailAtStock, q95) {
    return `<tr>
      <td><span class="table-model"><i class="series-dot ${dotClass}"></i>${label}</span></td>
      <td>${formatNumber(descriptor.mean, 2)}</td>
      <td>${formatNumber(descriptor.variance, 2)}</td>
      <td>${formatProbability(p0)}</td>
      <td>${formatProbability(metrics.fillRate)}</td>
      <td>${formatProbability(tailAtStock)}</td>
      <td>${formatProbability(metrics.probabilityExistingBackorders)}</td>
      <td>${formatNumber(metrics.expectedBackorders, 3)}</td>
      <td>${q95}</td>
    </tr>`;
  }

  function updateStockSummary(data) {
    const { state, stockMetrics, poissonDescriptor, nbDescriptor, required } = data;
    const poissonTailAtStock = Core.sf(state.stock - 1, state.mean, 1);
    const nbTailAtStock = Core.sf(state.stock - 1, state.mean, state.vmr);
    $("#comparison-stock-title").textContent = `Resultados com s = ${state.stock}`;
    $("#comparison-table-body").innerHTML =
      tableRow("Poisson", "poisson-dot", poissonDescriptor, stockMetrics.poisson, Core.pmf(0, state.mean, 1), poissonTailAtStock, data.q95Poisson) +
      tableRow("Binomial negativa", "nb-dot", nbDescriptor, stockMetrics.negativeBinomial, Core.pmf(0, state.mean, state.vmr), nbTailAtStock, data.q95Nb);

    const targetText = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 }).format(state.target);
    $("#target-card-title").textContent = `Estoque para FR ≥ ${targetText}`;
    $("#poisson-required-stock").textContent = String(required.poisson);
    $("#nb-required-stock").textContent = String(required.negativeBinomial);
    const gap = required.negativeBinomial - required.poisson;
    if (gap === 0) {
      $("#stock-gap").textContent = "Os dois modelos requerem o mesmo estoque para esta meta.";
    } else if (gap > 0) {
      $("#stock-gap").innerHTML = `A sobredispersão requer <strong>${gap} ${gap === 1 ? "unidade adicional" : "unidades adicionais"}</strong> nesta meta.`;
    } else {
      $("#stock-gap").innerHTML = `Neste ponto da CDF, a binomial negativa requer <strong>${Math.abs(gap)} ${gap === -1 ? "unidade a menos" : "unidades a menos"}</strong>. As CDFs cruzam; aumente a meta e observe a cauda direita.`;
    }

    if (state.vmr === 1) {
      $("#stock-insight").innerHTML = "<strong>Sem correção de variância:</strong> fill rate, risco de falta e EBO coincidem em todos os níveis de estoque.";
      return;
    }

    const frDifference = stockMetrics.negativeBinomial.fillRate - stockMetrics.poisson.fillRate;
    const eboDifference = stockMetrics.negativeBinomial.expectedBackorders - stockMetrics.poisson.expectedBackorders;
    const eboBase = stockMetrics.poisson.expectedBackorders;
    const eboPhrase = eboBase > 1e-10
      ? `${formatNumber((eboDifference / eboBase) * 100, 1)}% ${eboDifference >= 0 ? "maior" : "menor"}`
      : `${formatNumber(eboDifference, 3)} unidade(s) diferente`;
    $("#stock-insight").innerHTML =
      `<strong>No estoque s = ${state.stock},</strong> o fill rate da binomial negativa é ` +
      `${signedPoints(frDifference)} em relação à Poisson, enquanto o EBO é ${eboPhrase}. ` +
      `A probabilidade de uma nova demanda esperar é P(X ≥ s), mas a probabilidade de já haver backorder é P(X &gt; s).`;
  }

  function sampleCard(model, quantity, value, theory, dotClass) {
    return `<article class="sample-stat">
      <span><i class="series-dot ${dotClass}"></i> ${model} · ${quantity}</span>
      <strong>${formatNumber(value, 2)}</strong>
      <small>valor teórico: ${formatNumber(theory, 2)}</small>
    </article>`;
  }

  function updateSimulationSummary(data) {
    const sim = data.simulation;
    $("#sample-summary").innerHTML =
      sampleCard("Poisson", "média amostral", sim.poissonSummary.mean, data.state.mean, "poisson-dot") +
      sampleCard("Poisson", "variância amostral", sim.poissonSummary.variance, data.state.mean, "poisson-dot") +
      sampleCard("Binomial negativa", "média amostral", sim.negativeBinomialSummary.mean, data.state.mean, "nb-dot") +
      sampleCard("Binomial negativa", "variância amostral", sim.negativeBinomialSummary.variance, data.state.mean * data.state.vmr, "nb-dot");
  }

  function cssColour(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function palette() {
    return {
      surface: cssColour("--surface"),
      ink: cssColour("--ink"),
      soft: cssColour("--ink-soft"),
      muted: cssColour("--ink-muted"),
      grid: cssColour("--grid"),
      axis: cssColour("--axis"),
      poisson: cssColour("--poisson"),
      poissonSoft: cssColour("--poisson-soft"),
      nb: cssColour("--negative-binomial"),
      nbSoft: cssColour("--negative-binomial-soft"),
      accent: cssColour("--accent"),
    };
  }

  function prepareCanvas(canvas, margins = {}) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, rect.width || canvas.parentElement.clientWidth || 600);
    const height = Math.max(180, rect.height || Number(canvas.getAttribute("height")) || 260);
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const plot = {
      left: margins.left || 53,
      right: width - (margins.right || 14),
      top: margins.top || 15,
      bottom: height - (margins.bottom || 35),
    };
    plot.width = plot.right - plot.left;
    plot.height = plot.bottom - plot.top;
    return { ctx, width, height, plot, colours: palette() };
  }

  function niceStep(span, targetTicks) {
    if (!(span > 0)) return 1;
    const rough = span / targetTicks;
    const power = 10 ** Math.floor(Math.log10(rough));
    const fraction = rough / power;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * power;
  }

  function linearTicks(minimum, maximum, targetTicks = 5) {
    const step = niceStep(maximum - minimum, targetTicks);
    const first = Math.ceil(minimum / step) * step;
    const values = [];
    for (let value = first; value <= maximum + step * 1e-9; value += step) values.push(value);
    return values;
  }

  function integerTicks(maximum, width) {
    const target = width < 460 ? 5 : 9;
    const step = Math.max(1, Math.ceil(niceStep(Math.max(1, maximum), target)));
    const values = [];
    for (let value = 0; value <= maximum; value += step) values.push(value);
    if (values[values.length - 1] !== maximum && maximum - values[values.length - 1] > step * 0.45) values.push(maximum);
    return values;
  }

  function linearScale(domainMin, domainMax, rangeMin, rangeMax) {
    const span = domainMax - domainMin || 1;
    return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
  }

  function logScale(domainMin, domainMax, rangeMin, rangeMax) {
    const logMin = Math.log10(domainMin);
    const logSpan = Math.log10(domainMax) - logMin;
    return (value) => rangeMin + ((Math.log10(Math.max(domainMin, value)) - logMin) / logSpan) * (rangeMax - rangeMin);
  }

  function drawAxes(ctx, plot, scales, options, colours) {
    const xTicks = options.xTicks || [];
    const yTicks = options.yTicks || [];
    ctx.save();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;

    yTicks.forEach((tick) => {
      const y = scales.y(tick);
      ctx.strokeStyle = colours.grid;
      ctx.beginPath();
      ctx.moveTo(plot.left, y);
      ctx.lineTo(plot.right, y);
      ctx.stroke();
      ctx.fillStyle = colours.muted;
      ctx.textAlign = "right";
      ctx.fillText(options.formatY ? options.formatY(tick) : numberFormat.format(tick), plot.left - 8, y);
    });

    ctx.strokeStyle = colours.axis;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.bottom);
    ctx.lineTo(plot.right, plot.bottom);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xTicks.forEach((tick) => {
      const x = scales.x(tick);
      ctx.strokeStyle = colours.axis;
      ctx.beginPath();
      ctx.moveTo(x, plot.bottom);
      ctx.lineTo(x, plot.bottom + 4);
      ctx.stroke();
      ctx.fillStyle = colours.muted;
      ctx.fillText(options.formatX ? options.formatX(tick) : String(tick), x, plot.bottom + 7);
    });

    if (options.xTitle) {
      ctx.fillStyle = colours.soft;
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(options.xTitle, plot.left + plot.width / 2, plot.bottom + 23);
    }
    ctx.restore();
  }

  function drawVerticalRule(ctx, plot, x, colour, label, dashed = true) {
    if (x < plot.left - 1 || x > plot.right + 1) return;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.4;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.font = "700 10px system-ui, sans-serif";
      ctx.fillStyle = colour;
      ctx.textAlign = x > plot.right - 50 ? "right" : "left";
      ctx.textBaseline = "top";
      ctx.fillText(label, x + (x > plot.right - 50 ? -4 : 4), plot.top + 3);
    }
    ctx.restore();
  }

  function drawHorizontalRule(ctx, plot, y, colour, label) {
    if (y < plot.top - 1 || y > plot.bottom + 1) return;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.font = "700 10px system-ui, sans-serif";
      ctx.fillStyle = colour;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, plot.right - 3, y - 3);
    }
    ctx.restore();
  }

  function drawStepLine(ctx, values, scales, colour, lineWidth = 2.1) {
    if (!values.length) return;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(scales.x(0), scales.y(values[0]));
    for (let i = 1; i < values.length; i += 1) {
      const x = scales.x(i);
      ctx.lineTo(x, scales.y(values[i - 1]));
      ctx.lineTo(x, scales.y(values[i]));
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPolyline(ctx, values, scales, colour, options = {}) {
    if (!values.length) return;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.globalAlpha = options.alpha === undefined ? 1 : options.alpha;
    ctx.lineWidth = options.lineWidth || 1.8;
    ctx.setLineDash(options.dash || []);
    ctx.lineJoin = "round";
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = scales.x(index);
      const y = scales.y(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawPoint(ctx, x, y, colour, radius = 4) {
    ctx.save();
    ctx.fillStyle = colour;
    ctx.strokeStyle = cssColour("--surface");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function installTooltip(canvas, metadata) {
    plotMetadata.set(canvas, metadata);
    if (canvas.dataset.tooltipInstalled) return;
    canvas.dataset.tooltipInstalled = "true";
    canvas.addEventListener("mousemove", (event) => {
      const meta = plotMetadata.get(canvas);
      if (!meta) return;
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      if (localX < meta.plot.left || localX > meta.plot.right) {
        hideTooltip();
        return;
      }
      const raw = meta.xMin + ((localX - meta.plot.left) / meta.plot.width) * (meta.xMax - meta.xMin);
      const index = Math.max(meta.xMin, Math.min(meta.xMax, Math.round(raw)));
      tooltip.innerHTML = meta.html(index);
      const maxLeft = globalThis.innerWidth - tooltip.offsetWidth - 14;
      const maxTop = globalThis.innerHeight - tooltip.offsetHeight - 14;
      tooltip.style.left = `${Math.max(8, Math.min(maxLeft, event.clientX + 10))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(maxTop, event.clientY + 10))}px`;
      tooltip.classList.add("visible");
      tooltip.setAttribute("aria-hidden", "false");
    });
    canvas.addEventListener("mouseleave", hideTooltip);
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
    tooltip.setAttribute("aria-hidden", "true");
  }

  function tooltipRow(label, value, colour) {
    return `<div class="tooltip-row"><span>${colour ? `<i style="background:${colour}"></i>` : ""}${label}</span><strong>${value}</strong></div>`;
  }

  function renderPmf(data) {
    const canvas = canvases.pmf;
    const { ctx, plot, colours } = prepareCanvas(canvas, { left: 57, bottom: 39 });
    const rows = data.comparison.rows;
    const maxK = data.comparison.supportMax;
    const maxProbability = Math.max(...rows.map((row) => Math.max(row.poissonPmf, row.negativeBinomialPmf)));
    const yMax = niceStep(maxProbability * 1.13, 5) * Math.ceil((maxProbability * 1.13) / niceStep(maxProbability * 1.13, 5));
    const scales = {
      x: linearScale(0, Math.max(1, maxK), plot.left, plot.right),
      y: linearScale(0, yMax, plot.bottom, plot.top),
    };

    if (data.state.stock <= maxK) {
      const shadeStart = scales.x(Math.max(0, data.state.stock - 0.5));
      ctx.fillStyle = colours.nbSoft;
      ctx.fillRect(shadeStart, plot.top, plot.right - shadeStart, plot.height);
    }

    drawAxes(ctx, plot, scales, {
      xTicks: integerTicks(maxK, plot.width),
      yTicks: linearTicks(0, yMax, 5),
      formatY: formatCompactProbability,
      xTitle: "contagem no pipeline, k",
    }, colours);

    drawVerticalRule(ctx, plot, scales.x(data.state.mean), colours.axis, "μ", true);

    const spacing = plot.width / Math.max(1, maxK);
    const offset = Math.min(2.4, spacing * 0.18);
    rows.forEach((row) => {
      const x = scales.x(row.k);
      const yPoisson = scales.y(row.poissonPmf);
      const yNb = scales.y(row.negativeBinomialPmf);
      ctx.save();
      ctx.globalAlpha = 0.58;
      ctx.lineWidth = spacing < 3 ? 1 : 1.4;
      ctx.strokeStyle = colours.poisson;
      ctx.beginPath();
      ctx.moveTo(x - offset, plot.bottom);
      ctx.lineTo(x - offset, yPoisson);
      ctx.stroke();
      ctx.strokeStyle = colours.nb;
      ctx.beginPath();
      ctx.moveTo(x + offset, plot.bottom);
      ctx.lineTo(x + offset, yNb);
      ctx.stroke();
      ctx.restore();
      if (spacing >= 4) {
        ctx.fillStyle = colours.poisson;
        ctx.beginPath();
        ctx.arc(x - offset, yPoisson, 2.2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = colours.nb;
        ctx.beginPath();
        ctx.arc(x + offset, yNb, 2.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    drawVerticalRule(ctx, plot, scales.x(data.state.stock), colours.soft, `s = ${data.state.stock}`, false);
    installTooltip(canvas, {
      plot,
      xMin: 0,
      xMax: maxK,
      html: (k) => {
        const row = rows[k];
        return `<div class="tooltip-title">X = ${k}</div>` +
          tooltipRow("Poisson", formatProbability(row.poissonPmf), colours.poisson) +
          tooltipRow("Binomial negativa", formatProbability(row.negativeBinomialPmf), colours.nb) +
          tooltipRow("BN − Poisson", signedPoints(row.negativeBinomialPmf - row.poissonPmf));
      },
    });
  }

  function renderDifference(data) {
    const canvas = canvases.difference;
    const { ctx, plot, colours } = prepareCanvas(canvas, { left: 57, bottom: 38 });
    const differences = data.comparison.rows.map((row) => row.negativeBinomialPmf - row.poissonPmf);
    const maxK = differences.length - 1;
    const extent = Math.max(1e-6, ...differences.map(Math.abs));
    const yExtent = Math.ceil(extent / niceStep(extent, 3)) * niceStep(extent, 3);
    const scales = {
      x: linearScale(-0.5, maxK + 0.5, plot.left, plot.right),
      y: linearScale(-yExtent, yExtent, plot.bottom, plot.top),
    };
    drawAxes(ctx, plot, scales, {
      xTicks: integerTicks(maxK, plot.width),
      yTicks: linearTicks(-yExtent, yExtent, 5),
      formatY: formatCompactProbability,
      xTitle: "contagem, k",
    }, colours);
    ctx.strokeStyle = colours.axis;
    ctx.beginPath();
    ctx.moveTo(plot.left, scales.y(0));
    ctx.lineTo(plot.right, scales.y(0));
    ctx.stroke();
    const barWidth = Math.max(1, Math.min(14, plot.width / Math.max(1, differences.length) * 0.72));
    differences.forEach((difference, k) => {
      const x = scales.x(k) - barWidth / 2;
      const y = scales.y(difference);
      const zero = scales.y(0);
      ctx.fillStyle = difference >= 0 ? colours.nb : colours.poisson;
      ctx.globalAlpha = 0.78;
      ctx.fillRect(x, Math.min(y, zero), barWidth, Math.max(1, Math.abs(zero - y)));
    });
    ctx.globalAlpha = 1;
    installTooltip(canvas, {
      plot,
      xMin: 0,
      xMax: maxK,
      html: (k) => `<div class="tooltip-title">X = ${k}</div>` + tooltipRow("BN − Poisson", signedPoints(differences[k]), differences[k] >= 0 ? colours.nb : colours.poisson),
    });
  }

  function renderTail(data) {
    const canvas = canvases.tail;
    const { ctx, plot, colours } = prepareCanvas(canvas, { left: 59, bottom: 38 });
    const maxK = data.comparison.supportMax;
    const poisson = [];
    const nb = [];
    for (let k = 0; k <= maxK; k += 1) {
      poisson.push(Core.sf(k - 1, data.state.mean, 1));
      nb.push(Core.sf(k - 1, data.state.mean, data.state.vmr));
    }
    const smallest = Math.max(1e-9, Math.min(...poisson.concat(nb).filter((value) => value > 0)));
    const yMin = 10 ** Math.floor(Math.log10(smallest));
    const scales = {
      x: linearScale(0, Math.max(1, maxK), plot.left, plot.right),
      y: logScale(yMin, 1, plot.bottom, plot.top),
    };
    const yTicks = [];
    for (let exponent = Math.ceil(Math.log10(yMin)); exponent <= 0; exponent += 1) yTicks.push(10 ** exponent);
    drawAxes(ctx, plot, scales, {
      xTicks: integerTicks(maxK, plot.width),
      yTicks,
      formatY: (value) => value === 1 ? "1" : `1e${Math.round(Math.log10(value))}`,
      xTitle: "limiar, k",
    }, colours);
    drawStepLine(ctx, poisson.map((value) => Math.max(yMin, value)), scales, colours.poisson);
    drawStepLine(ctx, nb.map((value) => Math.max(yMin, value)), scales, colours.nb);
    drawVerticalRule(ctx, plot, scales.x(data.state.stock), colours.soft, `s = ${data.state.stock}`, false);
    if (data.state.stock <= maxK) {
      drawPoint(ctx, scales.x(data.state.stock), scales.y(Math.max(yMin, poisson[data.state.stock])), colours.poisson);
      drawPoint(ctx, scales.x(data.state.stock), scales.y(Math.max(yMin, nb[data.state.stock])), colours.nb);
    }
    installTooltip(canvas, {
      plot,
      xMin: 0,
      xMax: maxK,
      html: (k) => `<div class="tooltip-title">Limiar k = ${k}</div>` +
        tooltipRow("P(X ≥ k) · Poisson", formatProbability(poisson[k]), colours.poisson) +
        tooltipRow("P(X ≥ k) · BN", formatProbability(nb[k]), colours.nb),
    });
  }

  function renderFillRate(data) {
    const canvas = canvases.fillRate;
    const { ctx, plot, colours } = prepareCanvas(canvas, { left: 58, bottom: 39 });
    const maxStock = data.curves.maxStock;
    const scales = {
      x: linearScale(0, Math.max(1, maxStock), plot.left, plot.right),
      y: linearScale(0, 1, plot.bottom, plot.top),
    };
    drawAxes(ctx, plot, scales, {
      xTicks: integerTicks(maxStock, plot.width),
      yTicks: [0, 0.25, 0.5, 0.75, 1],
      formatY: (value) => `${Math.round(value * 100)}%`,
      xTitle: "estoque autorizado, s",
    }, colours);
    drawHorizontalRule(ctx, plot, scales.y(data.state.target), colours.accent, `meta ${Math.round(data.state.target * 100)}%`);
    drawStepLine(ctx, data.curves.poisson.fillRate, scales, colours.poisson);
    drawStepLine(ctx, data.curves.negativeBinomial.fillRate, scales, colours.nb);
    drawVerticalRule(ctx, plot, scales.x(data.state.stock), colours.soft, `s = ${data.state.stock}`, false);
    if (data.state.stock <= maxStock) {
      drawPoint(ctx, scales.x(data.state.stock), scales.y(data.curves.poisson.fillRate[data.state.stock]), colours.poisson);
      drawPoint(ctx, scales.x(data.state.stock), scales.y(data.curves.negativeBinomial.fillRate[data.state.stock]), colours.nb);
    }
    installTooltip(canvas, {
      plot,
      xMin: 0,
      xMax: maxStock,
      html: (stock) => `<div class="tooltip-title">Estoque s = ${stock}</div>` +
        tooltipRow("FR · Poisson", formatProbability(data.curves.poisson.fillRate[stock]), colours.poisson) +
        tooltipRow("FR · Binomial negativa", formatProbability(data.curves.negativeBinomial.fillRate[stock]), colours.nb),
    });
  }

  function renderEbo(data) {
    const canvas = canvases.ebo;
    const { ctx, plot, colours } = prepareCanvas(canvas, { left: 58, bottom: 39 });
    const maxStock = data.curves.maxStock;
    const maxEbo = Math.max(data.state.mean, ...data.curves.negativeBinomial.expectedBackorders, ...data.curves.poisson.expectedBackorders);
    const step = niceStep(maxEbo * 1.05, 5);
    const yMax = Math.max(step, Math.ceil(maxEbo * 1.05 / step) * step);
    const scales = {
      x: linearScale(0, Math.max(1, maxStock), plot.left, plot.right),
      y: linearScale(0, yMax, plot.bottom, plot.top),
    };
    drawAxes(ctx, plot, scales, {
      xTicks: integerTicks(maxStock, plot.width),
      yTicks: linearTicks(0, yMax, 5),
      formatY: (value) => numberFormat.format(value),
      xTitle: "estoque autorizado, s",
    }, colours);
    drawStepLine(ctx, data.curves.poisson.expectedBackorders, scales, colours.poisson);
    drawStepLine(ctx, data.curves.negativeBinomial.expectedBackorders, scales, colours.nb);
    drawVerticalRule(ctx, plot, scales.x(data.state.stock), colours.soft, `s = ${data.state.stock}`, false);
    if (data.state.stock <= maxStock) {
      drawPoint(ctx, scales.x(data.state.stock), scales.y(data.curves.poisson.expectedBackorders[data.state.stock]), colours.poisson);
      drawPoint(ctx, scales.x(data.state.stock), scales.y(data.curves.negativeBinomial.expectedBackorders[data.state.stock]), colours.nb);
    }
    installTooltip(canvas, {
      plot,
      xMin: 0,
      xMax: maxStock,
      html: (stock) => `<div class="tooltip-title">Estoque s = ${stock}</div>` +
        tooltipRow("EBO · Poisson", formatNumber(data.curves.poisson.expectedBackorders[stock], 3), colours.poisson) +
        tooltipRow("EBO · Binomial negativa", formatNumber(data.curves.negativeBinomial.expectedBackorders[stock], 3), colours.nb),
    });
  }

  function renderRates(data) {
    const canvas = canvases.rate;
    const { ctx, plot, colours } = prepareCanvas(canvas, { left: 58, bottom: 39 });
    const rates = data.simulation.gammaRates;
    const maxRate = Math.max(data.state.mean, ...rates);
    const step = niceStep(maxRate * 1.08, 5);
    const yMax = Math.max(step, Math.ceil(maxRate * 1.08 / step) * step);
    const maxIndex = rates.length - 1;
    const scales = {
      x: linearScale(0, Math.max(1, maxIndex), plot.left, plot.right),
      y: linearScale(0, yMax, plot.bottom, plot.top),
    };
    drawAxes(ctx, plot, scales, {
      xTicks: integerTicks(maxIndex, plot.width).map((value) => value),
      yTicks: linearTicks(0, yMax, 5),
      formatX: (value) => String(value + 1),
      xTitle: "janela",
    }, colours);
    drawPolyline(ctx, rates, scales, colours.nb, { lineWidth: 1.6, alpha: 0.9 });
    ctx.save();
    ctx.strokeStyle = colours.poisson;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(plot.left, scales.y(data.state.mean));
    ctx.lineTo(plot.right, scales.y(data.state.mean));
    ctx.stroke();
    ctx.restore();
    installTooltip(canvas, {
      plot,
      xMin: 0,
      xMax: maxIndex,
      html: (index) => `<div class="tooltip-title">Janela ${index + 1}</div>` +
        tooltipRow("Λ · Poisson", formatNumber(data.state.mean, 2), colours.poisson) +
        tooltipRow("Λ · Gamma–Poisson", formatNumber(rates[index], 2), colours.nb),
    });
  }

  function drawCountFacet(ctx, facet, values, colour, label, maxCount, colours, showXLabels, periods) {
    const scales = {
      x: linearScale(0, Math.max(1, periods - 1), facet.left, facet.right),
      y: linearScale(0, maxCount, facet.bottom, facet.top),
    };
    const yTicks = linearTicks(0, maxCount, 3);
    ctx.save();
    ctx.font = "10px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    yTicks.forEach((tick) => {
      const y = scales.y(tick);
      ctx.strokeStyle = colours.grid;
      ctx.beginPath();
      ctx.moveTo(facet.left, y);
      ctx.lineTo(facet.right, y);
      ctx.stroke();
      ctx.fillStyle = colours.muted;
      ctx.textAlign = "right";
      ctx.fillText(String(Math.round(tick)), facet.left - 7, y);
    });
    ctx.fillStyle = colour;
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, facet.left + 4, facet.top + 3);
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.74;
    ctx.lineWidth = periods > 180 ? 1 : 1.5;
    values.forEach((value, index) => {
      const x = scales.x(index);
      ctx.beginPath();
      ctx.moveTo(x, facet.bottom);
      ctx.lineTo(x, scales.y(value));
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colours.axis;
    ctx.beginPath();
    ctx.moveTo(facet.left, facet.top);
    ctx.lineTo(facet.left, facet.bottom);
    ctx.lineTo(facet.right, facet.bottom);
    ctx.stroke();
    if (showXLabels) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "10px system-ui, sans-serif";
      integerTicks(periods - 1, facet.right - facet.left).forEach((index) => {
        const x = scales.x(index);
        ctx.fillStyle = colours.muted;
        ctx.fillText(String(index + 1), x, facet.bottom + 6);
      });
      ctx.fillStyle = colours.soft;
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText("janela", facet.left + (facet.right - facet.left) / 2, facet.bottom + 22);
    }
    ctx.restore();
  }

  function renderSamples(data) {
    const canvas = canvases.sample;
    const { ctx, width, height, colours } = prepareCanvas(canvas, { left: 58, bottom: 39 });
    const poisson = data.simulation.poissonCounts;
    const nb = data.simulation.negativeBinomialCounts;
    const maxCountRaw = Math.max(1, ...poisson, ...nb);
    const step = niceStep(maxCountRaw, 4);
    const maxCount = Math.max(step, Math.ceil(maxCountRaw / step) * step);
    const left = 55;
    const right = width - 14;
    const top = 10;
    const bottom = height - 36;
    const gap = 23;
    const facetHeight = (bottom - top - gap) / 2;
    const topFacet = { left, right, top, bottom: top + facetHeight };
    const bottomFacet = { left, right, top: top + facetHeight + gap, bottom };
    drawCountFacet(ctx, topFacet, poisson, colours.poisson, "Poisson", maxCount, colours, false, poisson.length);
    drawCountFacet(ctx, bottomFacet, nb, colours.nb, "Binomial negativa", maxCount, colours, true, nb.length);
    installTooltip(canvas, {
      plot: { left, right, top, bottom, width: right - left, height: bottom - top },
      xMin: 0,
      xMax: poisson.length - 1,
      html: (index) => `<div class="tooltip-title">Janela ${index + 1}</div>` +
        tooltipRow("X · Poisson", String(poisson[index]), colours.poisson) +
        tooltipRow("X · Binomial negativa", String(nb[index]), colours.nb),
    });
  }

  function activePanelId() {
    return $(".tab[aria-selected='true']").dataset.panel;
  }

  function placeControls() {
    const panel = $(".control-panel");
    const active = activePanelId();
    const key = active ? active.replace(/^panel-/, "") : "shape";
    const slot = document.querySelector(`.control-slot[data-slot="${key}"]`);
    if (panel && slot && panel.parentElement !== slot) {
      slot.appendChild(panel);
    }
  }

  function renderVisibleCharts() {
    if (!computed) return;
    const panel = activePanelId();
    if (panel === "panel-shape") {
      renderPmf(computed);
      renderDifference(computed);
      renderTail(computed);
    } else if (panel === "panel-stock") {
      renderFillRate(computed);
      renderEbo(computed);
    } else if (panel === "panel-mechanism") {
      renderRates(computed);
      renderSamples(computed);
    }
  }

  function refresh() {
    if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      computed = deriveData(readState());
      updateControlReadouts(computed);
      updateShapeSummary(computed);
      updateStockSummary(computed);
      updateSimulationSummary(computed);
      renderVisibleCharts();
    });
  }

  function selectTab(tab, focus = false) {
    $$(".tab").forEach((candidate) => {
      const selected = candidate === tab;
      candidate.classList.toggle("active", selected);
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(candidate.dataset.panel);
      panel.hidden = !selected;
    });
    hideTooltip();
    placeControls();
    if (focus) tab.focus();
    requestAnimationFrame(renderVisibleCharts);
  }

  $$(".tab").forEach((tab, index, tabs) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let targetIndex = null;
      if (event.key === "ArrowRight") targetIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") targetIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") targetIndex = 0;
      if (event.key === "End") targetIndex = tabs.length - 1;
      if (targetIndex !== null) {
        event.preventDefault();
        selectTab(tabs[targetIndex], true);
      }
    });
  });

  const requestedPanel = new URLSearchParams(globalThis.location.search).get("tab");
  const allowedPanels = new Set(["shape", "stock", "mechanism"]);
  const requestedKey = requestedPanel ? requestedPanel.replace(/^panel-/, "") : "";
  const requestedTab = allowedPanels.has(requestedKey)
    ? document.querySelector(`.tab[data-panel="panel-${requestedKey}"]`)
    : null;
  if (requestedTab) selectTab(requestedTab);
  placeControls();

  [controls.mean, controls.vmr, controls.stock, controls.target, controls.periods].forEach((control) => {
    control.addEventListener("input", refresh);
  });
  controls.seed.addEventListener("change", refresh);

  $$(".preset").forEach((button) => {
    button.addEventListener("click", () => {
      controls.vmr.value = button.dataset.vmr;
      refresh();
    });
  });

  $("#new-sample").addEventListener("click", () => {
    controls.seed.value = String((Math.max(0, Math.trunc(Number(controls.seed.value) || 0)) + 1) % 1000000);
    refresh();
  });

  $("#reset-controls").addEventListener("click", () => {
    Object.entries(DEFAULTS).forEach(([key, value]) => {
      controls[key].value = String(value);
    });
    refresh();
  });

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("#theme-toggle").textContent = theme === "dark" ? "◑" : "◐";
    $("#theme-toggle").setAttribute("aria-label", theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
    try { localStorage.setItem("poisson-nb-theme", theme); } catch (_) { /* local file privacy mode */ }
    requestAnimationFrame(renderVisibleCharts);
  }

  let initialTheme = "light";
  try {
    const stored = localStorage.getItem("poisson-nb-theme");
    if (stored === "light" || stored === "dark") initialTheme = stored;
    else if (globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches) initialTheme = "dark";
  } catch (_) { /* local file privacy mode */ }
  setTheme(initialTheme);

  $("#theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  let resizeTimer = null;
  globalThis.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderVisibleCharts, 90);
  });

  refresh();
})();
