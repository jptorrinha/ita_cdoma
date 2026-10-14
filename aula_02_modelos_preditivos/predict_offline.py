"""
Sistema de falhas aeronauticas — uso offline do modelo treinado.

Carrega o modelo LightGBM salvo em model/lgbm_aviation_model.pkl e a
configuracao de decisao em model/model_config.json (gerados pela ultima
celula de modelo_preditivo.ipynb) e aplica o veredito GO / NO-GO a novos
registros, sem precisar abrir o Jupyter nem re-treinar nada.

Uso:
    python predict_offline.py caminho/para/novos_dados.csv
    python predict_offline.py            # roda uma demo com dados de exemplo
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODEL_DIR = Path(__file__).parent / "model"


def load_system(model_dir: Path = MODEL_DIR):
    model = joblib.load(model_dir / "lgbm_aviation_model.pkl")
    config = json.loads((model_dir / "model_config.json").read_text())
    return model, config


def aviation_failure_system(model, config, df: pd.DataFrame, threshold: float | None = None) -> pd.DataFrame:
    """Aplica o sistema a um DataFrame com as colunas de `config['features']`."""
    features = config["features"]
    missing = [f for f in features if f not in df.columns]
    if missing:
        raise ValueError(f"Faltam colunas necessarias: {missing}")

    threshold = threshold if threshold is not None else config["recommended_threshold"]
    proba = model.predict_proba(df[features])[:, 1]
    verdict = np.where(proba >= threshold, "NO-GO - inspecionar", "GO - liberar operacao")
    return pd.DataFrame({
        "failure_probability": proba,
        "threshold": threshold,
        "verdict": verdict,
    }, index=df.index)


def _demo(model, config):
    # Um registro tranquilo e um registro em zona de risco, so para mostrar o formato esperado.
    demo_df = pd.DataFrame([
        {"air_temp_k": 298.5, "process_temp_k": 309.0, "speed_rpm": 1500, "torque_nm": 40.0, "tool_wear_min": 50},
        {"air_temp_k": 300.0, "process_temp_k": 309.5, "speed_rpm": 1350, "torque_nm": 65.0, "tool_wear_min": 220},
    ])
    demo_df["mec_power_w"] = demo_df["torque_nm"] * demo_df["speed_rpm"] * 2 * np.pi / 60
    return demo_df


def main():
    model, config = load_system()
    print(f"Modelo carregado. Limiar recomendado: {config['recommended_threshold']:.4f} "
          f"(meta: recall >= 95%)")

    if len(sys.argv) > 1:
        df = pd.read_csv(sys.argv[1], encoding="utf-8-sig")
    else:
        print("Nenhum CSV informado — rodando com dados de demonstracao.\n")
        df = _demo(model, config)

    result = aviation_failure_system(model, config, df)
    print(result.to_string())
    print()
    print(result["verdict"].value_counts().to_string())


if __name__ == "__main__":
    main()
