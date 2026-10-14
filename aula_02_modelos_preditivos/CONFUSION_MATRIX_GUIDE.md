# Confusion Matrix Interpretation for Safety-Critical Applications

## Context: Aviation Maintenance Prediction

In predictive maintenance for aviation, **false negatives are catastrophic** because they represent failures we failed to predict, potentially leading to:
- Equipment failure during operation
- Safety incidents or accidents
- Loss of life
- Regulatory violations

False positives (predicting failure when none occurs) are expensive but safe - they lead to unnecessary maintenance but prevent catastrophic events.

## Understanding Confusion Matrix Terminology

```
{
   "role":"mechanic"
}
```

### The 2x2 Matrix Structure

```
                    PREDICTED
                No Failure    Failure
              ┌──────────────────────┐
ACTUAL        │                      │
No Failure    │   TN          FP     │  ← Actually Safe
              │ (True       (False   │
              │ Negative)   Positive)│
              ├──────────────────────┤
Failure       │   FN          TP     │  ← Actually Dangerous
              │ (False      (True    │
              │ Negative)   Positive)│
              └──────────────────────┘
```

### Definitions
- **True Negative (TN)**: Correctly predicted no failure (machine is safe, we said safe) ✅
- **True Positive (TP)**: Correctly predicted failure (machine will fail, we said fail) ✅
- **False Positive (FP)**: Incorrectly predicted failure (machine is safe, we said fail) ⚠️
  - **Type I Error** / **False Alarm**
  - Cost: Unnecessary maintenance, downtime, labor
- **False Negative (FN)**: Incorrectly predicted no failure (machine will fail, we said safe) ❌
  - **Type II Error** / **Miss**
  - Cost: Catastrophic failure, safety incident, lives

## Orange Data Mining: Four Display Options

### Example Data (from ai4i2020 notebook, TWF prediction)
```
         Predicted
Actual    0      1
0      2964      6
1        10     20
```

### Option 1: Number of Instances (Raw Counts)

**What it shows**: Absolute counts of predictions

```
         Predicted
Actual    0      1
0      2964      6      (TN=2964, FP=6)
1        10     20      (FN=10, TP=20)
```

**When to use**:
- Understanding absolute impact
- Calculating costs: "We missed 10 failures out of 3000 machines"
- Initial exploration

**For False Negatives**:
- **Direct count**: 10 failures were missed
- Clear, unambiguous

**Advantages**:
- Easy to understand
- Shows scale of the problem
- Good for cost calculations

**Disadvantages**:
- Doesn't show proportions or rates
- Hard to compare across different dataset sizes

---

### Option 2: Proportion of Predicted

**What it shows**: Column percentages (each column sums to 100%)

```
         Predicted
Actual       0          1
0         99.66%     23.08%
1          0.34%     76.92%
         ------     ------
         100.0%    100.0%
```

**Interpretation**:
- Of all "No Failure" predictions, 99.66% were correct (TN)
- Of all "No Failure" predictions, 0.34% were wrong (FN) ← False Negative Rate among negative predictions
- Of all "Failure" predictions, 76.92% were correct (TP) ← **Precision**
- Of all "Failure" predictions, 23.08% were wrong (FP)

**When to use**:
- Evaluating precision: "When we predict failure, how often are we right?"
- Understanding false alarm rate among predictions
- Maintenance resource planning

**For False Negatives**:
- Shows FN as proportion of all negative predictions
- **Less intuitive** for safety analysis
- Doesn't directly answer: "Of all actual failures, how many did we miss?"

**Advantages**:
- Shows **Precision** directly (76.92% for failure class)
- Good for understanding prediction reliability

**Disadvantages**:
- **Not ideal for safety**: Doesn't show what fraction of real failures we're missing
- Can be misleading with imbalanced data

---

### Option 3: Proportion of Actual ⭐ **RECOMMENDED FOR SAFETY**

**What it shows**: Row percentages (each row sums to 100%)

```
         Predicted
Actual       0          1      Total
0         99.80%      0.20%   100.0%
1         33.33%     66.67%   100.0%
```

**Interpretation**:
- Of all actual non-failures, 99.80% were correctly identified (TN) ← **Specificity**
- Of all actual non-failures, 0.20% were incorrectly flagged (FP) ← False Positive Rate
- Of all actual failures, 66.67% were correctly identified (TP) ← **Recall/Sensitivity** ✅
- Of all actual failures, 33.33% were missed (FN) ← **Miss Rate** ⚠️ **CRITICAL**

**When to use**:
- **Safety-critical applications** (aviation, medical, nuclear)
- Regulatory compliance reporting
- Risk assessment: "What's our failure detection rate?"

**For False Negatives**:
- **Directly shows Miss Rate**: 33.33% of real failures are being missed!
- Answers: "Of all machines that will actually fail, what percentage are we failing to catch?"
- This is your **safety risk exposure**

**Advantages**:
- ✅ **Best for safety analysis**
- Shows **Recall/Sensitivity** directly (66.67% for failure detection)
- Shows **Specificity** (99.80% for safe machines)
- Intuitive interpretation for domain experts
- Regulatory-friendly metric

**Disadvantages**:
- Doesn't show precision directly (but that's less critical for safety)

---

### Option 4: Sum of Probabilities

**What it shows**: Sum of predicted probabilities for each cell

```
         Predicted
Actual       0          1
0      2961.3      8.7
1         7.2     22.8
```

**Interpretation**:
- Shows model confidence rather than hard classifications
- Values are not constrained to cell counts
- Useful for model calibration assessment

**When to use**:
- Calibration analysis: "Is the model well-calibrated?"
- Threshold tuning
- Understanding model confidence
- Advanced analysis

**For False Negatives**:
- Shows how confidently the model made FN errors
- Can identify "confident mistakes" vs "uncertain mistakes"

**Advantages**:
- Shows model uncertainty
- Good for threshold optimization
- Identifies calibration issues

**Disadvantages**:
- **Not intuitive** for non-technical stakeholders
- Harder to interpret for safety decisions
- Requires understanding of probability calibration

---

## Recommendation for Aviation Maintenance

### Primary View: **Option 3 - Proportion of Actual**

This is the **most appropriate** because:

1. **Direct Safety Metric**:
   - FN proportion = Miss Rate = "What % of real failures are we missing?"
   - TP proportion = Recall/Sensitivity = "What % of real failures are we catching?"

2. **Risk Communication**:
   ```
   "Of all machines that will fail, we're only detecting 66.67%.
   This means 1 in 3 failures goes undetected - UNACCEPTABLE for aviation safety."
   ```

3. **Regulatory Compliance**: Aviation authorities care about detection rates

4. **Actionable**: Clear target for improvement
   - Current: 66.67% recall
   - Target: >95% recall for safety-critical systems

### Secondary View: **Option 1 - Number of Instances**

Use this to show:
- Absolute impact: "10 failures missed"
- Context: "Out of 30 total actual failures"
- Cost calculations

---

## Key Metrics for Safety-Critical Analysis

### From Confusion Matrix

```
TN = 2964    FP = 6
FN = 10      TP = 20
```

### Calculate These Metrics:

1. **Recall / Sensitivity / True Positive Rate** ⭐⭐⭐
   ```
   Recall = TP / (TP + FN) = 20 / 30 = 66.67%
   ```
   - **Interpretation**: We detect 66.67% of actual failures
   - **Target**: >95% for safety-critical (aviation, medical)
   - **Current Status**: INSUFFICIENT for aviation safety

2. **Miss Rate / False Negative Rate** ⭐⭐⭐
   ```
   Miss Rate = FN / (TP + FN) = 10 / 30 = 33.33%
   ```
   - **Interpretation**: We miss 1 in 3 failures!
   - **This is your safety risk**

3. **Specificity / True Negative Rate**
   ```
   Specificity = TN / (TN + FP) = 2964 / 2970 = 99.80%
   ```
   - **Interpretation**: We correctly identify 99.80% of safe machines
   - **Status**: Excellent (low false alarm rate)

4. **Precision / Positive Predictive Value**
   ```
   Precision = TP / (TP + FP) = 20 / 26 = 76.92%
   ```
   - **Interpretation**: When we predict failure, we're right 76.92% of the time
   - **Impact**: 23% unnecessary maintenance (acceptable cost for safety)

5. **False Positive Rate / False Alarm Rate**
   ```
   FPR = FP / (TN + FP) = 6 / 2970 = 0.20%
   ```
   - **Interpretation**: Only 0.20% false alarms
   - **Status**: Excellent (won't overwhelm maintenance teams)

6. **F1 Score** (Harmonic mean of Precision and Recall)
   ```
   F1 = 2 × (Precision × Recall) / (Precision + Recall)
      = 2 × (0.7692 × 0.6667) / (0.7692 + 0.6667)
      = 0.7143
   ```
   - Balanced metric, but **not ideal for safety** (treats FN = FP)

7. **F2 Score** ⭐ (Weights Recall 2x more than Precision)
   ```
   F2 = 5 × (Precision × Recall) / (4 × Precision + Recall)
      = 5 × (0.7692 × 0.6667) / (4 × 0.7692 + 0.6667)
      = 0.6897
   ```
   - **Better for safety**: Penalizes FN more than FP

8. **F0.5 Score** (Weights Precision 2x more than Recall)
   ```
   F0.5 = 1.25 × (Precision × Recall) / (0.25 × Precision + Recall)
        = 0.7407
   ```
   - Use when precision matters more (not for aviation safety)

---

## Cost-Sensitive Analysis

### Assign Realistic Costs

For aviation maintenance:
- **Cost of False Negative (FN)**: $1,000,000 - $10,000,000
  - Aircraft damage, accidents, legal liability, lives
- **Cost of False Positive (FP)**: $5,000 - $50,000
  - Unnecessary inspection, maintenance, downtime

### Expected Cost Calculation

```python
cost_FN = 10 × $1,000,000 = $10,000,000   # 10 missed failures
cost_FP = 6 × $10,000      = $60,000      # 6 false alarms

Total Expected Cost = $10,060,000
```

**Conclusion**: Even with low FP rate, the FN cost dominates!

### Cost-Weighted F-Score

```python
# Weight FN 200x more than FP (based on cost ratio)
β = sqrt(200) ≈ 14.14

F_β = (1 + β²) × (Precision × Recall) / (β² × Precision + Recall)
```

This heavily penalizes false negatives, appropriate for safety.

---

## Classroom Teaching Approach

### Step 1: Show All Four Views

Display the same confusion matrix in all four formats and discuss when each is useful.

### Step 2: Focus on Proportion of Actual

Emphasize why this is best for safety:
```
"When 33.33% of real failures are missed, that means 1 in 3 failures
goes undetected. In aviation, this is completely unacceptable."
```

### Step 3: Calculate Safety Metrics

Have students calculate:
- Recall (66.67%) ← Too low!
- Miss Rate (33.33%) ← Too high!
- Specificity (99.80%) ← Good
- FPR (0.20%) ← Good

### Step 4: Cost Analysis

Show the cost difference:
- 10 FN × $1M = $10M in potential catastrophic failures
- 6 FP × $10K = $60K in unnecessary maintenance
- **FN costs are 167x higher!**

### Step 5: Improvement Strategy

Discuss how to improve recall:
1. **Lower threshold**: Accept more FP to catch more TP
2. **Better features**: Add more predictive features
3. **Class weights**: Penalize FN more during training
4. **Ensemble methods**: Combine multiple models
5. **Oversampling**: Balance the dataset

### Step 6: Compare Models

Show multiple models side-by-side:

```
Model               Recall    FPR    F2-Score
─────────────────────────────────────────────
Current (LGBM)     66.67%   0.20%    0.69
Threshold=0.3      90.00%   1.50%    0.85  ← Better for safety
Random Forest      75.00%   0.80%    0.74
Ensemble           93.33%   2.00%    0.88  ← Best for safety
```

**Discussion**: Is 2% FPR acceptable if we catch 93% of failures?

---

## Orange Data Mining: Practical Steps

### Viewing Different Matrix Formats

1. **Connect Confusion Matrix widget** to Test and Score output
2. **Click the gear icon** (⚙️) in Confusion Matrix widget
3. **Select display mode**:
   - Number of instances
   - Proportion of predicted
   - Proportion of actual ← **Recommended**
   - Sum of probabilities

### Extracting Metrics

Orange automatically shows in the Confusion Matrix widget:
- **Precision** (PPV)
- **Recall** (Sensitivity, TPR)
- **F1 Score**
- **Specificity** (TNR)

### Creating Custom Metrics

Use **Python Script** widget:

```python
from sklearn.metrics import fbeta_score, matthews_corrcoef

# Input: evaluation_results
# Output: custom_metrics

# Get predictions and actual values
y_true = evaluation_results.actual
y_pred = evaluation_results.predicted[0]  # First model

# Calculate F2 score (weights recall 2x)
f2 = fbeta_score(y_true, y_pred, beta=2)

# Calculate Matthews Correlation Coefficient
mcc = matthews_corrcoef(y_true, y_pred)

# Calculate miss rate
from sklearn.metrics import confusion_matrix
cm = confusion_matrix(y_true, y_pred)
tn, fp, fn, tp = cm.ravel()
miss_rate = fn / (fn + tp) if (fn + tp) > 0 else 0

# Output as table
import pandas as pd
custom_metrics = pd.DataFrame({
    'Metric': ['F2 Score', 'MCC', 'Miss Rate', 'Recall'],
    'Value': [f2, mcc, miss_rate, tp/(tp+fn)]
})
```

---

## Jupyter Notebook: Adding Safety Metrics

Add this cell after the confusion matrix in `aula_02_exemplo_analise_dados.ipynb`:

```python
# Safety-Critical Metrics Analysis
from sklearn.metrics import recall_score, precision_score, fbeta_score

# Use the explicit confusion-matrix decomposition to avoid swapping TN/TP or FP/FN.
tn, fp, fn, tp = cm.ravel()

# Calculate key metrics
recall = recall_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
miss_rate = fn / (fn + tp) if (fn + tp) > 0 else 0
false_positive_rate = fp / (tn + fp) if (tn + fp) > 0 else 0
f2_score = fbeta_score(y_test, y_pred, beta=2)

# Display results
print("=" * 60)
print("SAFETY-CRITICAL METRICS ANALYSIS")
print("=" * 60)
print(f"\n🎯 PRIMARY SAFETY METRICS:")
print(f"   Recall (Sensitivity):        {recall:.2%}  ← Detection Rate")
print(f"   Miss Rate (1 - Recall):      {miss_rate:.2%}  ← SAFETY RISK ⚠️")
print(f"\n✅ SUPPORTING METRICS:")
print(f"   Specificity:                 {specificity:.2%}  ← Safe Detection")
print(f"   False Positive Rate:         {false_positive_rate:.2%}  ← False Alarms")
print(f"   Precision:                   {precision:.2%}  ← Prediction Accuracy")
print(f"\n📊 COMPOSITE SCORES:")
print(f"   F1 Score (balanced):         {f1_score(y_test, y_pred):.4f}")
print(f"   F2 Score (safety-weighted):  {f2_score:.4f}  ← Preferred for Aviation")
print("=" * 60)

# Cost Analysis
cost_fn = 1_000_000  # $1M per missed failure
cost_fp = 10_000     # $10K per false alarm
fn_count = fn
fp_count = fp

total_cost = (fn_count * cost_fn) + (fp_count * cost_fp)

print(f"\n💰 COST ANALYSIS:")
print(f"   False Negatives: {fn_count:3d} × ${cost_fn:,} = ${fn_count * cost_fn:,}")
print(f"   False Positives: {fp_count:3d} × ${cost_fp:,}   = ${fp_count * cost_fp:,}")
print(f"   {'─' * 50}")
print(f"   Total Expected Cost:              ${total_cost:,}")
print("=" * 60)

# Safety Assessment
print(f"\n⚠️  AVIATION SAFETY ASSESSMENT:")
if recall < 0.90:
    print(f"   ❌ INSUFFICIENT: {recall:.1%} detection rate is too low")
    print(f"      Target: >95% for safety-critical systems")
    print(f"      Action: Adjust decision threshold or retrain model")
elif recall < 0.95:
    print(f"   ⚠️  MARGINAL: {recall:.1%} detection rate is borderline")
    print(f"      Consider improvements to reach >95% target")
else:
    print(f"   ✅ ACCEPTABLE: {recall:.1%} detection rate meets safety standards")

print("=" * 60)
```

---

## Summary: Decision Guide

| Scenario | Best Display Option | Why |
|----------|-------------------|-----|
| **Aviation Safety** | Proportion of Actual | Shows detection rate and miss rate directly |
| **Medical Diagnosis** | Proportion of Actual | Shows sensitivity (disease detection rate) |
| **Spam Filter** | Proportion of Predicted | Shows precision (how accurate predictions are) |
| **Initial Exploration** | Number of Instances | Shows absolute counts, easy to understand |
| **Model Calibration** | Sum of Probabilities | Shows prediction confidence |
| **Cost Analysis** | Number of Instances | Easy to multiply by costs |
| **Regulatory Report** | Proportion of Actual | Standard metrics (sensitivity, specificity) |
| **Academic Paper** | All options | Comprehensive analysis |

---

## Further Reading

- **Cost-Sensitive Learning**: Elkan, C. (2001). "The Foundations of Cost-Sensitive Learning"
- **Aviation Safety**: FAA Advisory Circular AC 120-92B "Safety Management Systems"
- **Imbalanced Data**: Chawla et al. (2002). "SMOTE: Synthetic Minority Over-sampling Technique"
- **Medical Diagnosis**: Altman & Bland (1994). "Diagnostic tests: Sensitivity and specificity"

---

## Teaching Summary

**For your aviation maintenance classroom**:

1. ⭐ **Always use "Proportion of Actual" as primary view**
2. 📊 **Calculate and display Recall, Miss Rate, and F2 Score**
3. 💰 **Show cost analysis to demonstrate FN >> FP in impact**
4. 🎯 **Set safety target: >95% recall for aviation systems**
5. 🔍 **Compare multiple models using F2 Score, not accuracy**

**Key Message**: "In aviation, we prefer 100 false alarms over 1 missed failure!"
