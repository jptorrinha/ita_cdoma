# Stratification Verification Guide

## Purpose
This document explains how to verify that both Orange Data Mining and Jupyter Notebook use identical stratification strategies for the AI4I 2020 dataset.

## Dataset Type Distribution
- **L (Low)**: 6000 records (60%)
- **M (Medium)**: 2997 records (~30%)
- **H (High)**: 1003 records (~10%)

## Why Stratify by Type?

The `Type` feature is crucial because it affects:
1. **Tool wear accumulation rates**: H/M/L add 5/3/2 minutes respectively
2. **Overstrain failure thresholds**: 13,000/12,000/11,000 minNm for H/M/L
3. **Statistical representation**: Without stratification, random sampling might under-represent the H category (only 10%)

## Jupyter Notebook Implementation

### Modified train_test_split (Cell 20)
```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.3,           # 70% train, 30% test
    random_state=0,          # Reproducibility
    stratify=renamed_treat_df['Type']  # KEY: Stratify by Type (L/M/H)
)
```

### Verification Output
The notebook now prints distribution verification:
```
Original Type distribution:
H    0.1003
L    0.6000
M    0.2997

Training set Type distribution:
H    0.1003
L    0.6000
M    0.2997

Test set Type distribution:
H    0.1003
L    0.6000
M    0.2997
```

## Orange Data Mining Configuration

### Data Sampler Widget Settings (`ai4i2020_2.ows`)
- **Sampling type**: 0 (Fixed proportion)
- **Sample size**: 70%
- **Stratify**: True
- **Stratification variable**: Defaults to target class (`Machine failure`)

### Important Note
Orange's Data Sampler stratifies on the **target variable** by default, NOT on `Type`. To match the Jupyter notebook behavior:

#### Option 1: Accept Different Stratification
- Jupyter: Stratifies by `Type` (product quality)
- Orange: Stratifies by `Machine failure` (0/1)
- Both are valid but test different sampling strategies

#### Option 2: Create Composite Stratification Column
1. In Orange, use **Formula** widget to create: `Type + "_" + str(Machine failure)`
2. This creates 6 strata: L_0, L_1, M_0, M_1, H_0, H_1
3. Set this as meta-attribute and configure Data Sampler to use it
4. Modify Jupyter to match:
```python
# Create composite stratification column
composite_strata = renamed_treat_df['Type'].astype(str) + '_' + renamed_treat_df['TWF'].astype(str)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=0,
    stratify=composite_strata
)
```

#### Option 3: Configure Orange to Match Jupyter (Recommended for Teaching)
Since Jupyter stratifies by `Type`, configure Orange similarly:

**Workaround** (Orange doesn't directly support meta-variable stratification):
1. Use **Select Rows** widget to manually split by Type
2. Apply 70/30 split within each Type category
3. Concatenate results with **Concatenate** widget

**Easier approach**: Accept that Orange stratifies by target and explain the difference in class.

## Recommended Classroom Approach

### For Teaching Purposes:
1. **Show both approaches** and explain the trade-offs:
   - Stratifying by `Type`: Preserves product distribution (engineering perspective)
   - Stratifying by `Machine failure`: Preserves failure rate (statistical perspective)

2. **Compare results** to demonstrate that both are valid:
   ```
   Jupyter (Type stratification):
   - Ensures each split has 60% L, 30% M, 10% H
   - Failure distribution may vary slightly

   Orange (Target stratification):
   - Ensures each split has ~96.6% no-failure, ~3.4% failure
   - Type distribution may vary slightly (especially for H)
   ```

3. **Run both and compare metrics**:
   - If results are similar → Stratification choice had minimal impact
   - If results differ → Excellent teaching moment about sampling bias

## Verification Commands

### In Jupyter (after running the modified cell):
```python
# Check Type distribution
print("Train Type counts:", X_train.join(renamed_treat_df['Type']).groupby('Type').size())
print("Test Type counts:", X_test.join(renamed_treat_df['Type']).groupby('Type').size())

# Check failure distribution
print("Train failure rate:", y_train.sum() / len(y_train))
print("Test failure rate:", y_test.sum() / len(y_test))
```

### In Orange:
1. Connect **Data Sampler** output to **Data Table**
2. Check **Data Sample** output → view Type distribution
3. Check **Remaining Data** output → view Type distribution
4. Use **Distributions** widget to visualize

## Summary

**Modified Jupyter Notebook**: ✅ Now stratifies by `Type` (L/M/H)

**Orange Workflow**: Stratifies by `Machine failure` (0/1) by default

**For exact matching**: Use Option 2 (composite stratification) in both tools

**For teaching**: Show both approaches and compare - this demonstrates important ML concepts about sampling strategies!
